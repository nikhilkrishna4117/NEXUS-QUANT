import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional, List
# pyrefly: ignore[missing-import]
from sqlalchemy.orm import Session  # type: ignore
# pyrefly: ignore[missing-import]
from sqlalchemy import desc  # type: ignore

from backend.config import settings
from backend.models.risk import RiskConfig, RiskAuditLog
from backend.models.trading import PaperAccount, Position, Order
from backend.services.forex_factory_service import forex_factory_service

logger = logging.getLogger(__name__)

class RiskEngine:
    """
    Institutional risk engine enforcing strict pre-trade and portfolio-level risk limits.
    Guarantees null-safe calculations, zero offset-naive/aware datetime collisions,
    and strict institutional discipline guardrails.
    """

    @staticmethod
    def get_or_create_config(db: Session) -> RiskConfig:
        config = db.query(RiskConfig).first()
        if not config:
            config = RiskConfig(
                max_risk_per_trade_pct=getattr(settings, "DEFAULT_MAX_RISK_PER_TRADE_PCT", 1.0),
                max_portfolio_drawdown_pct=getattr(settings, "DEFAULT_MAX_PORTFOLIO_DRAWDOWN_PCT", 10.0),
                max_daily_loss_pct=getattr(settings, "DEFAULT_MAX_DAILY_LOSS_PCT", 3.0),
                max_open_positions=getattr(settings, "DEFAULT_MAX_OPEN_POSITIONS", 5),
                max_leverage=getattr(settings, "DEFAULT_MAX_LEVERAGE", 1.0),
                max_consecutive_losses=4,
                kill_switch_active=False,
                require_stop_loss=True,
                min_risk_reward_ratio=1.5
            )
            db.add(config)
            try:
                db.commit()
                db.refresh(config)
            except Exception:
                db.rollback()
                config = db.query(RiskConfig).first()
        return config

    @classmethod
    def validate_proposed_order(
        cls,
        account: PaperAccount,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        stop_loss: Optional[float],
        take_profit: Optional[float],
        db: Session
    ) -> Tuple[bool, str]:
        """
        Server-Side Pre-Trade Discipline Firewall.
        All orders (manual or autonomous algo) must pass through these non-negotiable checks:
        1. Emergency Kill Switch State
        2. Account Discipline Lock Status
        3. Portfolio Max Drawdown Circuit Breaker
        4. Daily Loss Cap (USD & %)
        5. Daily Profit Cap (Lock in Daily Target)
        6. Max Trades Per Day (Overtrading Guard)
        7. Anti-Revenge Trading & Consecutive Loss Cooldown
        8. Mandatory Stop Loss Existence & Direction
        9. Session Windows (Killzones for FX/TradFi; Crypto is 24/7)
        10. Maximum Open Positions Limit
        11. Risk Sizing & Asymmetry (Risk:Reward)
        12. Available Margin / Cash
        """
        config = cls.get_or_create_config(db)

        # Null-safe equity computation
        cash = float(account.cash_balance or 0.0)
        margin = float(account.margin_used or 0.0)
        unrealized = float(account.unrealized_pnl or 0.0)
        total_equity = cash + margin + unrealized
        initial_balance = float(account.initial_balance or 100000.0)

        # 1. Emergency Kill Switch Check
        kill_active = bool(getattr(config, "kill_switch_active", False) or getattr(config, "emergency_kill_active", False))
        if kill_active:
            reason = "CRITICAL: Emergency Kill Switch is ACTIVE. All new order submissions are halted."
            cls._log_audit(db, symbol, "KILL_SWITCH", False, reason)
            return False, reason

        # 2. Account Discipline Lock Status
        if getattr(config, "is_locked", False):
            reason = f"DISCIPLINE LOCK ACTIVE: {config.lock_reason or 'Trading disabled by discipline rules.'}"
            cls._log_audit(db, symbol, "DISCIPLINE_LOCK", False, reason)
            return False, reason

        # 3. Portfolio Max Drawdown Circuit Breaker
        drawdown_pct = ((initial_balance - total_equity) / initial_balance * 100.0) if initial_balance > 0 else 0.0
        max_dd = getattr(config, "max_portfolio_drawdown_pct", None)
        if max_dd is not None and drawdown_pct >= max_dd:
            reason = f"PORTFOLIO RISK BREACH: Drawdown ({drawdown_pct:.1f}%) exceeds max threshold ({max_dd}%)."
            cls._log_audit(db, symbol, "DRAWDOWN_CHECK", False, reason)
            return False, reason

        # 4. Daily Loss Cap (USD & %)
        # Use timezone-naive UTC midnight to match SQLAlchemy DateTime storage
        today_start_naive = datetime.now(timezone.utc).replace(tzinfo=None, hour=0, minute=0, second=0, microsecond=0)
        recent_closed = db.query(Position).filter(
            Position.account_id == account.id,
            Position.is_open == False,
            Position.closed_at >= today_start_naive
        ).all()
        today_realized_loss = sum(abs(p.unrealized_pnl or 0.0) for p in recent_closed if (p.unrealized_pnl or 0.0) < 0)
        daily_loss_pct = (today_realized_loss / initial_balance * 100.0) if initial_balance > 0 else 0.0

        max_loss_usd = getattr(config, "max_daily_loss_usd", None)
        if max_loss_usd and today_realized_loss >= max_loss_usd:
            reason = f"DAILY LOSS CAP HIT: Realized loss today (${today_realized_loss:,.2f}) hit maximum allowed limit (${max_loss_usd:,.2f}). Trading locked for the day."
            config.is_locked = True
            config.lock_reason = reason
            try:
                db.commit()
            except Exception:
                db.rollback()
            cls._log_audit(db, symbol, "DAILY_LOSS_CHECK", False, reason)
            return False, reason

        max_loss_pct = getattr(config, "max_daily_loss_pct", None)
        if max_loss_pct and daily_loss_pct >= max_loss_pct:
            reason = f"DAILY LOSS CAP HIT: Realized loss today ({daily_loss_pct:.2f}%) reached maximum limit of {max_loss_pct}%. Trading locked for the day."
            config.is_locked = True
            config.lock_reason = reason
            try:
                db.commit()
            except Exception:
                db.rollback()
            cls._log_audit(db, symbol, "DAILY_LOSS_CHECK", False, reason)
            return False, reason

        # 5. Daily Profit Target Lock (Protect Gains)
        today_realized_profit = sum((p.unrealized_pnl or 0.0) for p in recent_closed if (p.unrealized_pnl or 0.0) > 0)
        profit_cap_usd = getattr(config, "max_daily_profit_cap_usd", None)
        if profit_cap_usd and profit_cap_usd > 0 and today_realized_profit >= profit_cap_usd:
            reason = f"DAILY TARGET SECURED: Profit today (${today_realized_profit:,.2f}) reached target cap (${profit_cap_usd:,.2f}). Trading locked to protect gains."
            cls._log_audit(db, symbol, "PROFIT_CAP_CHECK", False, reason)
            return False, reason

        # 6. Max Trades Per Day (Anti-Overtrading Guard)
        today_orders_count = db.query(Order).filter(
            Order.account_id == account.id,
            Order.created_at >= today_start_naive
        ).count()
        max_trades = getattr(config, "max_trades_per_day", None)
        if max_trades and today_orders_count >= max_trades:
            reason = f"OVERTRADING PROTOCOL: Reached daily maximum of {max_trades} trades today. Further execution locked."
            cls._log_audit(db, symbol, "FREQUENCY_CHECK", False, reason)
            return False, reason

        # 7. Anti-Revenge Trading & Consecutive Loss Cooldown
        consec_losses_limit = getattr(config, "max_consecutive_losses", 3) or 3
        last_positions = db.query(Position).filter(
            Position.account_id == account.id,
            Position.is_open == False
        ).order_by(desc(Position.closed_at)).limit(consec_losses_limit).all()

        if len(last_positions) >= consec_losses_limit:
            all_losses = all((p.unrealized_pnl or 0.0) < 0 for p in last_positions)
            if all_losses:
                reason = f"ANTI-REVENGE LOCKOUT: {len(last_positions)} consecutive losing trades detected. Mandatory psychological reset active."
                cls._log_audit(db, symbol, "REVENGE_TRADING_CHECK", False, reason)
                return False, reason

        # 8. Forex Factory High-Impact News Lockout Window
        news_buffer = getattr(config, "news_lockout_buffer_minutes", 0)
        if news_buffer and news_buffer > 0:
            is_news_locked, news_reason = forex_factory_service.is_symbol_news_locked(
                symbol,
                buffer_minutes=news_buffer
            )
            if is_news_locked and news_reason:
                cls._log_audit(db, symbol, "NEWS_LOCKOUT", False, news_reason)
                return False, news_reason

        # 9. Mandatory Stop-Loss Validation (Strict Discipline Protocol)
        req_sl = getattr(config, "require_stop_loss", True)
        if req_sl and not stop_loss:
            reason = "RISK PROTOCOL VIOLATION: A valid Stop-Loss price is mandatory for every order submission."
            cls._log_audit(db, symbol, "STOP_LOSS_CHECK", False, reason)
            return False, reason

        # 10. Session Windows (Killzone Verification - applies to FX/TradFi; Crypto trades 24/7)
        is_crypto = any(c in symbol.upper() for c in ["BTC", "ETH", "SOL", "USDT"])
        session_windows = getattr(config, "allowed_session_windows", None)
        if not is_crypto and session_windows and len(session_windows) > 0:
            current_utc_hour = datetime.now(timezone.utc).hour
            # London: 07:00 - 16:00 UTC | New York: 12:00 - 21:00 UTC | Asian: 00:00 - 08:00 UTC
            session_active = False
            for sess in session_windows:
                s_upper = str(sess).upper()
                if "LONDON" in s_upper and 7 <= current_utc_hour < 16:
                    session_active = True
                elif ("NEW_YORK" in s_upper or "NY" in s_upper) and 12 <= current_utc_hour < 21:
                    session_active = True
                elif ("ASIA" in s_upper or "TOKYO" in s_upper) and 0 <= current_utc_hour < 8:
                    session_active = True

            if not session_active:
                reason = f"SESSION FILTER VIOLATION: Current time ({current_utc_hour:02d}:00 UTC) is outside permitted institutional killzones {session_windows}."
                cls._log_audit(db, symbol, "SESSION_CHECK", False, reason)
                return False, reason

        # 11. Maximum Open Positions Limit
        open_positions_count = db.query(Position).filter(
            Position.account_id == account.id,
            Position.is_open == True
        ).count()
        max_pos = getattr(config, "max_open_positions", None)
        if max_pos and open_positions_count >= max_pos:
            reason = f"EXPOSURE LIMIT: Open positions ({open_positions_count}) reached maximum limit of {max_pos}."
            cls._log_audit(db, symbol, "EXPOSURE_CHECK", False, reason)
            return False, reason

        # 12. Stop-Loss Distance & Direction Check
        if stop_loss:
            if side.upper() == "BUY" and stop_loss >= price:
                reason = f"INVALID STOP-LOSS: Long order stop-loss ({stop_loss}) must be strictly below entry price ({price})."
                cls._log_audit(db, symbol, "STOP_LOSS_CHECK", False, reason)
                return False, reason
            elif side.upper() == "SELL" and stop_loss <= price:
                reason = f"INVALID STOP-LOSS: Short order stop-loss ({stop_loss}) must be strictly above entry price ({price})."
                cls._log_audit(db, symbol, "STOP_LOSS_CHECK", False, reason)
                return False, reason

            # Calculate risk per trade in dollar and percentage terms
            risk_per_unit = abs(price - stop_loss)
            dollar_risk = risk_per_unit * quantity
            risk_pct = (dollar_risk / total_equity) * 100.0 if total_equity > 0 else 100.0

            max_risk_pct = getattr(config, "max_risk_per_trade_pct", 1.0)
            if max_risk_pct is not None and risk_pct > (max_risk_pct + 0.1):  # 0.1% tolerance
                reason = f"POSITION SIZING EXCEEDED: Proposed risk ({risk_pct:.2f}% of equity) exceeds maximum allowed {max_risk_pct}%."
                cls._log_audit(db, symbol, "RISK_SIZING_CHECK", False, reason)
                return False, reason

        # 13. Minimum Risk-to-Reward Ratio Check
        min_rr = getattr(config, "min_risk_reward_ratio", None)
        if stop_loss and take_profit and min_rr is not None:
            risk_dist = abs(price - stop_loss)
            reward_dist = abs(take_profit - price)
            rr_ratio = reward_dist / (risk_dist + 1e-10)
            if rr_ratio < (min_rr - 0.05):
                reason = f"SUBOPTIMAL ASYMMETRY: Risk-Reward ratio ({rr_ratio:.2f}) is below minimum requirement of {min_rr}."
                cls._log_audit(db, symbol, "RR_RATIO_CHECK", False, reason)
                return False, reason

        # 14. Available Margin / Cash Check
        order_cost = price * quantity
        if order_cost > cash:
            reason = f"INSUFFICIENT FUNDS: Required order capital (${order_cost:.2f}) exceeds available cash (${cash:.2f})."
            cls._log_audit(db, symbol, "MARGIN_CHECK", False, reason)
            return False, reason

        # All checks passed
        cls._log_audit(db, symbol, "TRADE_VALIDATION", True, "Approved all risk filters.")
        return True, "Risk validation passed."

    @staticmethod
    def _log_audit(db: Session, symbol: str, action: str, passed: bool, reason: str):
        try:
            now_iso = datetime.now(timezone.utc).isoformat()
            audit = RiskAuditLog(
                symbol=symbol,
                action_type=action,
                passed=passed,
                reason=reason,
                proposed_order={"symbol": symbol, "time": now_iso},
                portfolio_state={"timestamp": now_iso}
            )
            db.add(audit)
            db.flush()
        except Exception as e:
            logger.warning(f"Failed to record risk audit log: {e}")

    @classmethod
    def get_risk_dashboard_summary(cls, account: PaperAccount, db: Session) -> Dict[str, Any]:
        """Aggregate real-time portfolio risk metrics for the risk dashboard."""
        config = cls.get_or_create_config(db)
        open_positions = db.query(Position).filter(
            Position.account_id == account.id,
            Position.is_open == True
        ).all()

        total_margin_used = sum((p.margin_used or 0.0) for p in open_positions)
        total_unrealized_pnl = sum((p.unrealized_pnl or 0.0) for p in open_positions)
        cash = float(account.cash_balance or 0.0)
        total_equity = cash + total_margin_used + total_unrealized_pnl

        initial_bal = float(account.initial_balance or 100000.0)
        peak_equity = max(initial_bal, total_equity)
        drawdown_pct = ((peak_equity - total_equity) / peak_equity * 100.0) if peak_equity > 0 else 0.0

        daily_pnl = total_unrealized_pnl + float(account.realized_pnl or 0.0)
        daily_pnl_pct = (daily_pnl / initial_bal * 100.0) if initial_bal > 0 else 0.0
        exposure_pct = (total_margin_used / total_equity * 100.0) if total_equity > 0 else 0.0

        # Recent risk audit logs
        recent_audits = db.query(RiskAuditLog).order_by(RiskAuditLog.timestamp.desc()).limit(10).all()

        return {
            "account_equity": round(total_equity, 2),
            "available_capital": round(cash, 2),
            "used_margin": round(total_margin_used, 2),
            "exposure_pct": round(exposure_pct, 2),
            "unrealized_pnl": round(total_unrealized_pnl, 2),
            "realized_pnl": round(float(account.realized_pnl or 0.0), 2),
            "daily_pnl": round(daily_pnl, 2),
            "daily_pnl_pct": round(daily_pnl_pct, 2),
            "current_drawdown_pct": round(drawdown_pct, 2),
            "max_drawdown_limit_pct": config.max_portfolio_drawdown_pct,
            "max_daily_loss_limit_pct": config.max_daily_loss_pct,
            "max_risk_per_trade_pct": config.max_risk_per_trade_pct,
            "open_positions_count": len(open_positions),
            "max_open_positions": config.max_open_positions,
            "kill_switch_active": bool(config.kill_switch_active),
            "live_trading_enabled": getattr(settings, "LIVE_TRADING_ENABLED", False),
            "recent_audit_logs": [
                {
                    "id": a.id,
                    "timestamp": a.timestamp.isoformat() if hasattr(a.timestamp, "isoformat") else str(a.timestamp),
                    "symbol": a.symbol,
                    "action_type": a.action_type,
                    "passed": a.passed,
                    "reason": a.reason
                }
                for a in recent_audits
            ]
        }

risk_engine = RiskEngine()
