import uuid
import logging
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.models.journal import AutomatedJournalEntry
from backend.models.trading import Position, Order
from backend.models.trade_plan import ActiveTradePlan

logger = logging.getLogger(__name__)

class AutomatedJournalListener:
    """
    Automated Post-Trade Journal Listener.
    Intercepts every closed position the exact millisecond it executes (manual, TP, SL, or algo exit),
    calculates realized R-multiples, verifies active Edge Trade Plan compliance,
    and logs an immutable post-trade journal entry.
    """

    @classmethod
    def record_closed_position(
        cls,
        position: Position,
        closed_price: float,
        net_pnl: float,
        reason: str,
        db: Session
    ) -> AutomatedJournalEntry:
        """
        Processes a closed position into an immutable journal entry.
        """
        # 1. Determine Asset Class
        sym = position.symbol.upper()
        if any(c in sym for c in ["USDT", "BTC", "ETH", "SOL"]):
            asset_class = "CRYPTO"
        elif any(c in sym for c in ["XAU", "GOLD", "SILVER"]):
            asset_class = "METALS"
        elif any(c in sym for c in ["EUR", "GBP", "JPY", "USD", "AUD", "CAD"]):
            asset_class = "FOREX"
        elif any(c in sym for c in ["US30", "SPX", "NAS", "NIFTY", "^"]):
            asset_class = "INDICES"
        else:
            asset_class = "EQUITIES"

        # 2. Calculate Initial Risk and Realized R-Multiple
        # R = Net P&L / Initial Risk Dollars
        r_multiple = 0.0
        initial_risk_dollars = 0.0
        if position.stop_loss and position.entry_price:
            stop_distance = abs(position.entry_price - position.stop_loss)
            initial_risk_dollars = stop_distance * position.quantity
            if initial_risk_dollars > 0:
                r_multiple = round(net_pnl / initial_risk_dollars, 2)
        else:
            # Fallback estimation if no SL (1% nominal risk)
            initial_risk_dollars = (position.entry_price * position.quantity) * 0.01
            if initial_risk_dollars > 0:
                r_multiple = round(net_pnl / initial_risk_dollars, 2)

        # 3. Check Edge Trade Plan Compliance
        # Query active plan for this symbol or global active plan
        active_plan = db.query(ActiveTradePlan).filter(
            ActiveTradePlan.is_active == True
        ).first()

        plan_compliance = True
        compliance_score = 100.0
        strategy_used = "DISCRETIONARY_MANUAL"

        if active_plan:
            strategy_used = getattr(active_plan, "title", None) or getattr(active_plan, "name", "ACTIVE_EDGE_PLAN")
            # If trade closed early via manual panic exit without hitting SL/TP, penalize compliance
            if "MANUAL" in reason.upper() and net_pnl < 0:
                plan_compliance = False
                compliance_score = 65.0
        elif "STOP_LOSS" in reason.upper():
            strategy_used = "HARD_STOP_PROTECTION"
            compliance_score = 95.0 # Executed predefined risk protocol
        elif "TAKE_PROFIT" in reason.upper():
            strategy_used = "ALGO_TARGET_TAKE_PROFIT"
            compliance_score = 100.0

        # 4. Behavioral & Emotion Tagging
        if "STOP_LOSS" in reason.upper():
            emotion_tag = "DISCIPLINED"
        elif "TAKE_PROFIT" in reason.upper():
            emotion_tag = "CONFIDENT"
        elif "KILL_SWITCH" in reason.upper():
            emotion_tag = "REVENGE_HALTED"
        elif net_pnl < 0 and "MANUAL" in reason.upper():
            emotion_tag = "ANXIOUS"
        else:
            emotion_tag = "DISCIPLINED"

        # 5. Create Immutable Journal Entry
        entry = AutomatedJournalEntry(
            journal_id=f"JRN-{uuid.uuid4().hex[:12].upper()}",
            trade_id=f"TRD-POS-{position.id}",
            symbol=position.symbol,
            asset_class=asset_class,
            direction="BUY" if position.side == "LONG" else "SELL",
            entry_price=round(position.entry_price, 2),
            exit_price=round(closed_price, 2),
            lot_size=round(position.quantity, 4),
            slippage_bps=0.0,
            net_pnl=round(net_pnl, 2),
            r_multiple=r_multiple,
            strategy_used=strategy_used,
            emotion_tag=emotion_tag,
            user_notes=f"Auto-journaled via {reason}. Realized R-Multiple: {r_multiple:+.2f}R.",
            plan_compliance=plan_compliance,
            compliance_score=compliance_score,
            execution_mode="PAPER",
            is_immutable=True,
            created_at=position.opened_at or datetime.utcnow(),
            closed_at=datetime.utcnow()
        )

        db.add(entry)
        db.commit()
        db.refresh(entry)
        logger.info(f"Automated Journal Entry logged: {entry.journal_id} for {position.symbol} ({entry.r_multiple:+.2f}R)")
        return entry

journal_listener = AutomatedJournalListener()
