from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.services.broker_adapters.base import BaseBrokerAdapter
from backend.services.paper_trading_service import paper_trading_service
from backend.models.trading import Position
from backend.database import SessionLocal

class PaperBrokerAdapter(BaseBrokerAdapter):
    """
    Paper Trading Simulation Adapter.
    Routes execution to the multi-account paper engine with simulated slippage,
    commissions, and mark-to-market markups.
    """

    def __init__(self, is_live: bool = False):
        super().__init__(name="PAPER_SIMULATOR", is_live=False)
        self.is_connected = True

    def connect(self, credentials: Optional[Dict[str, Any]] = None) -> bool:
        self.is_connected = True
        return True

    def get_account_balance(self) -> Dict[str, Any]:
        with SessionLocal() as db:
            summary = paper_trading_service.get_portfolio_summary(db)
            return {
                "account_number": summary["account_number"],
                "account_name": summary.get("account_name", "Paper Master"),
                "cash_balance": summary["cash_balance"],
                "equity": summary["equity"],
                "margin_used": summary["margin_used"],
                "realized_pnl": summary["realized_pnl"],
                "unrealized_pnl": summary["unrealized_pnl"]
            }

    def get_open_positions(self) -> List[Dict[str, Any]]:
        with SessionLocal() as db:
            summary = paper_trading_service.get_portfolio_summary(db)
            return summary.get("open_positions", [])

    def submit_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        order_type: str = "MARKET"
    ) -> Dict[str, Any]:
        with SessionLocal() as db:
            return paper_trading_service.place_order(
                symbol=symbol,
                side=side,
                quantity=quantity,
                price=price,
                order_type=order_type,
                stop_loss=stop_loss,
                take_profit=take_profit,
                db=db
            )

    def close_position(self, position_id: Any, symbol: str, quantity: float, price: float) -> Dict[str, Any]:
        with SessionLocal() as db:
            return paper_trading_service.close_position(
                position_id=int(position_id),
                reason="MANUAL_BROKER_CLOSE",
                price=price,
                db=db
            )

    def flatten_all_positions(self) -> Dict[str, Any]:
        with SessionLocal() as db:
            open_pos = db.query(Position).filter(Position.is_open == True).all()
            results = []
            for p in open_pos:
                res = paper_trading_service.close_position(
                    position_id=p.id,
                    reason="KILL_SWITCH_FLATTEN",
                    price=p.current_price or p.entry_price,
                    db=db
                )
                results.append(res)
            return {"success": True, "flattened_count": len(results), "positions": results}
