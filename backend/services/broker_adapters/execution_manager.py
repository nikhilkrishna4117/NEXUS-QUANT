import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.config import settings
from backend.services.broker_adapters.base import BaseBrokerAdapter
from backend.services.broker_adapters.paper_adapter import PaperBrokerAdapter
from backend.services.broker_adapters.ccxt_adapter import CCXTBrokerAdapter
from backend.services.broker_adapters.ctrader_adapter import CTraderBrokerAdapter
from backend.services.broker_adapters.tradelocker_adapter import TradeLockerBrokerAdapter
from backend.services.risk_engine import risk_engine
from backend.services.paper_trading_service import paper_trading_service
from backend.models.risk import RiskConfig

logger = logging.getLogger(__name__)

class ExecutionManager:
    """
    Unified Multi-Broker Execution Manager & Pre-Trade Routing Engine.
    Enforces Demo-First Architecture, Server-Side Risk Firewall,
    Auto-Split Large Position logic, and Emergency Kill Switch Liquidation.
    """

    MAX_SINGLE_ORDER_CHUNKS = 5.0  # Max lots per single child order before auto-splitting

    def __init__(self):
        self.adapters: Dict[str, BaseBrokerAdapter] = {
            "paper": PaperBrokerAdapter(is_live=False),
            "ccxt": CCXTBrokerAdapter(exchange_id="binance", is_live=False),
            "ctrader": CTraderBrokerAdapter(is_live=False),
            "tradelocker": TradeLockerBrokerAdapter(is_live=False)
        }
        self.active_broker = "paper"
        self.execution_mode = "PAPER"  # PAPER or LIVE

    def set_execution_mode(self, mode: str) -> str:
        """Sets global execution mode with safety check."""
        clean_mode = mode.upper()
        if clean_mode == "LIVE":
            if not settings.LIVE_TRADING_ENABLED:
                raise ValueError("LIVE trading is disabled in system config. Toggle LIVE_TRADING_ENABLED to proceed.")
            self.execution_mode = "LIVE"
        else:
            self.execution_mode = "PAPER"
        logger.info(f"ExecutionManager mode switched to: {self.execution_mode}")
        return self.execution_mode

    def set_active_broker(self, broker_name: str) -> BaseBrokerAdapter:
        key = broker_name.lower()
        if key not in self.adapters:
            raise ValueError(f"Unknown broker adapter: {broker_name}. Available: {list(self.adapters.keys())}")
        self.active_broker = key
        return self.adapters[key]

    def get_active_adapter(self) -> BaseBrokerAdapter:
        if self.execution_mode == "PAPER":
            return self.adapters["paper"]
        return self.adapters.get(self.active_broker, self.adapters["paper"])

    def route_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        order_type: str = "MARKET",
        strategy_id: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Routes order through the mandatory Pre-Trade Risk Firewall before broker dispatch.
        Supports automatic splitting of large orders into broker-friendly child chunks.
        """
        account = paper_trading_service.get_or_create_account(db)

        # 1. Server-Side Pre-Trade Firewall Audit
        passed, reason = risk_engine.validate_proposed_order(
            account=account,
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            db=db
        )

        if not passed:
            logger.warning(f"Order rejected by Server-Side Risk Firewall: {reason}")
            return {
                "success": False,
                "reason": reason,
                "firewall_rejected": True
            }

        # 2. Check for Position Auto-Splitting (for oversized lot orders)
        adapter = self.get_active_adapter()
        chunks = []
        if quantity > self.MAX_SINGLE_ORDER_CHUNKS:
            num_chunks = int(quantity // self.MAX_SINGLE_ORDER_CHUNKS)
            rem = quantity % self.MAX_SINGLE_ORDER_CHUNKS
            for _ in range(num_chunks):
                chunks.append(self.MAX_SINGLE_ORDER_CHUNKS)
            if rem > 0:
                chunks.append(round(rem, 4))
        else:
            chunks = [quantity]

        child_fills = []
        for chunk_qty in chunks:
            fill = adapter.submit_order(
                symbol=symbol,
                side=side,
                quantity=chunk_qty,
                price=price,
                stop_loss=stop_loss,
                take_profit=take_profit,
                order_type=order_type
            )
            child_fills.append(fill)

        return {
            "success": True,
            "execution_mode": self.execution_mode,
            "broker": adapter.name,
            "symbol": symbol,
            "side": side,
            "total_quantity": quantity,
            "chunks_count": len(chunks),
            "fills": child_fills,
            "executed_price": price
        }

    def emergency_kill_switch_flatten(self, db: Session) -> Dict[str, Any]:
        """
        Emergency Kill Switch:
        1. Activates hard kill switch in RiskConfig.
        2. Liquidates and flattens all open positions across all adapters.
        3. Halts all autonomous algos immediately.
        """
        config = risk_engine.get_or_create_config(db)
        config.kill_switch_active = True
        config.emergency_kill_active = True
        config.is_locked = True
        config.lock_reason = "CRITICAL: EMERGENCY KILL SWITCH ACTIVATED BY TRADER. ALL POSITIONS FLATTENED."
        db.commit()

        # Flatten positions on all adapters
        flatten_results = {}
        for name, adapter in self.adapters.items():
            try:
                res = adapter.flatten_all_positions()
                flatten_results[name] = res
            except Exception as e:
                flatten_results[name] = {"error": str(e)}

        logger.critical("EMERGENCY KILL SWITCH: All active broker positions flattened and trading halted.")
        return {
            "kill_switch_active": True,
            "message": "EMERGENCY KILL SWITCH EXECUTED: All positions liquidated and algos halted.",
            "adapter_results": flatten_results
        }

execution_manager = ExecutionManager()
