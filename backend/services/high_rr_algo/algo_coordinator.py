import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.services.high_rr_algo.price_action import price_action_engine
from backend.services.high_rr_algo.smc_engine import smc_engine
from backend.services.high_rr_algo.ict_engine import ict_engine
from backend.services.high_rr_algo.mtf_confluence import mtf_confluence_engine
from backend.services.high_rr_algo.trade_manager import trade_manager
from backend.services.broker_adapters.execution_manager import execution_manager
from backend.services.market_data_service import market_data_service
from backend.database import SessionLocal

logger = logging.getLogger(__name__)

class AlgoCoordinator:
    """
    Central High-R:R Autonomous Trading Algo Coordinator.
    Oversees:
    - 3 Pre-Built Institutional Frameworks: Price Action, SMC, ICT Silver Bullet.
    - Real-Time Multi-Timeframe Scan (4H Bias -> 5m/1m Sniper Entry).
    - Immediate Execution via Broker Routing & Pre-Trade Firewall.
    - Milestone Trailing & Breakeven Management (1:3 -> 1:5 -> 1:10-1:30 Runner).
    """

    def __init__(self):
        self.bots: Dict[str, Dict[str, Any]] = {
            "PA_SNIPER": {
                "id": "PA_SNIPER",
                "name": "Price Action Sniper (MSS + S/R Flips)",
                "framework": "PRICE_ACTION",
                "target_rr": 10.0,
                "risk_per_trade_pct": 1.0,
                "is_active": True,
                "trades_count": 0,
                "win_count": 0,
                "total_pnl": 0.0,
                "last_signal": None
            },
            "SMC_INSTITUTIONAL": {
                "id": "SMC_INSTITUTIONAL",
                "name": "Smart Money Concepts (OB + Liquidity Sweeps)",
                "framework": "SMC",
                "target_rr": 15.0,
                "risk_per_trade_pct": 1.0,
                "is_active": True,
                "trades_count": 0,
                "win_count": 0,
                "total_pnl": 0.0,
                "last_signal": None
            },
            "ICT_SILVER_BULLET": {
                "id": "ICT_SILVER_BULLET",
                "name": "ICT Silver Bullet (FVG + OTE 0.705 + Killzones)",
                "framework": "ICT",
                "target_rr": 20.0,
                "risk_per_trade_pct": 1.0,
                "is_active": True,
                "trades_count": 0,
                "win_count": 0,
                "total_pnl": 0.0,
                "last_signal": None
            }
        }
        self.active_signals: List[Dict[str, Any]] = []
        self.managed_positions_state: Dict[str, Dict[str, Any]] = {}

    def get_bots_status(self) -> List[Dict[str, Any]]:
        return list(self.bots.values())

    def toggle_bot(self, bot_id: str, active: Optional[bool] = None) -> Dict[str, Any]:
        if bot_id not in self.bots:
            raise ValueError(f"Bot {bot_id} not found. Available: {list(self.bots.keys())}")
        bot = self.bots[bot_id]
        bot["is_active"] = not bot["is_active"] if active is None else active
        logger.info(f"Bot {bot_id} active status set to: {bot['is_active']}")
        return bot

    async def scan_and_execute(self, symbol: str = "BTCUSDT", db: Session = None) -> Optional[Dict[str, Any]]:
        """
        Scans live market feeds for the symbol across 1h (HTF) and 15m (LTF).
        If an institutional setup triggers on an active bot, executes immediately via ExecutionManager.
        """
        # Fetch real candles from market data service
        htf_candles = await market_data_service.get_historical_candles(symbol, timeframe="1h", limit=50, db=db)
        ltf_candles = await market_data_service.get_historical_candles(symbol, timeframe="15m", limit=50, db=db)

        if not htf_candles or not ltf_candles or len(ltf_candles) < 20:
            return None

        # Check MTF Confluence
        signal = mtf_confluence_engine.scan_mtf_confluence(
            htf_candles=htf_candles,
            ltf_candles=ltf_candles,
            equity=100000.0,
            risk_pct=1.0
        )

        if not signal:
            return None

        # Match with active bot
        strat = signal["strategy"]
        bot_key = "PA_SNIPER"
        if "SMC" in strat:
            bot_key = "SMC_INSTITUTIONAL"
        elif "ICT" in strat:
            bot_key = "ICT_SILVER_BULLET"

        bot = self.bots.get(bot_key)
        if not bot or not bot["is_active"]:
            logger.info(f"Signal ignored because bot {bot_key} is disabled.")
            return None

        # Record signal
        signal["bot_id"] = bot_key
        signal["timestamp"] = datetime.now(timezone.utc).isoformat()
        bot["last_signal"] = signal
        self.active_signals.insert(0, signal)
        if len(self.active_signals) > 30:
            self.active_signals.pop()

        # Execute Order via Server-Side Risk Firewall and Broker Router
        curr_price = float(ltf_candles[-1]["close"])
        execution_res = execution_manager.route_order(
            symbol=signal["symbol"],
            side=signal["side"],
            quantity=signal["lot_size"],
            price=curr_price,
            stop_loss=signal["stop_loss"],
            take_profit=signal["take_profit_3"],
            order_type="MARKET",
            strategy_id=None,
            db=db
        )

        if execution_res.get("success"):
            bot["trades_count"] += 1
            signal["execution_status"] = "FILLED"
            signal["fill_details"] = execution_res
            logger.info(f"HIGH-R:R ALGO FILL: {bot_key} executed {signal['side']} {signal['lot_size']} {signal['symbol']} @ ${curr_price:,.2f} (Target R:R 1:{signal['risk_reward_ratio']})")
        else:
            signal["execution_status"] = "BLOCKED_BY_FIREWALL"
            signal["reject_reason"] = execution_res.get("reason")
            logger.warning(f"HIGH-R:R ALGO BLOCKED: {execution_res.get('reason')}")

        return signal

    def check_trailing_and_milestones(self, position: Dict[str, Any], current_price: float, db: Session) -> Dict[str, Any]:
        """
        Polls open positions managed by autonomous bots, triggers breakeven and milestone partials.
        """
        pos_id = str(position.get("id"))
        state = self.managed_positions_state.setdefault(pos_id, {
            "tp1_hit": False,
            "tp2_hit": False,
            "tp3_hit": False,
            "be_moved": False
        })

        res = trade_manager.evaluate_position_milestones(
            side=position.get("side", "LONG"),
            entry_price=float(position.get("entry_price", current_price)),
            current_price=current_price,
            initial_sl=float(position.get("stop_loss", current_price * 0.98)),
            current_sl=float(position.get("stop_loss", current_price * 0.98)),
            remaining_qty=float(position.get("quantity", 0.1)),
            state=state
        )

        # Execute any triggered actions (e.g. update SL in database)
        for act in res.get("actions", []):
            if "BREAKEVEN" in act["type"] or "TRAIL" in act["type"]:
                new_sl = act.get("new_stop_loss")
                from backend.models.trading import Position
                db_pos = db.query(Position).filter(Position.id == position.get("id")).first()
                if db_pos and new_sl:
                    db_pos.stop_loss = new_sl
                    db.commit()
                    logger.info(f"Position {pos_id} Stop-Loss updated to ${new_sl:,.2f} via {act['type']}")

        return res

algo_coordinator = AlgoCoordinator()
