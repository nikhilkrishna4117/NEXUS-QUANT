from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from backend.database import Base

class RiskConfig(Base):
    """
    Discipline Guardrails Configuration Model.
    Enforces server-side pre-trade firewall limits before orders reach broker APIs.
    """
    __tablename__ = "risk_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    # Dollar & Percentage Limits
    max_risk_per_trade_pct = Column(Float, default=1.0)
    max_portfolio_drawdown_pct = Column(Float, default=10.0)
    max_daily_loss_pct = Column(Float, default=3.0)
    max_daily_loss_usd = Column(Float, default=1500.0)
    max_daily_profit_cap_usd = Column(Float, default=5000.0)
    
    # Trade & Execution Frequency Controls
    max_trades_per_day = Column(Integer, default=5)
    max_open_positions = Column(Integer, default=3)
    max_leverage = Column(Float, default=1.0)
    max_consecutive_losses = Column(Integer, default=3)
    
    # Session Windows & News Lockout
    allowed_session_windows = Column(JSON, default=lambda: ["LONDON", "NEW_YORK"])
    news_lockout_buffer_minutes = Column(Integer, default=15) # 15m before/after High Impact news
    
    # State Enforcement
    is_locked = Column(Boolean, default=False)
    lock_reason = Column(String(255), nullable=True)
    emergency_kill_active = Column(Boolean, default=False)
    kill_switch_active = Column(Boolean, default=False)
    allow_shorting = Column(Boolean, default=True)
    require_stop_loss = Column(Boolean, default=True)
    min_risk_reward_ratio = Column(Float, default=2.0)
    
    # Daily Tracking Cache
    current_daily_loss_usd = Column(Float, default=0.0)
    current_daily_profit_usd = Column(Float, default=0.0)
    trades_executed_today = Column(Integer, default=0)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RiskAuditLog(Base):
    __tablename__ = "risk_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    symbol = Column(String(32), nullable=False)
    action_type = Column(String(30), nullable=False)  # TRADE_VALIDATION, DRAWDOWN_CHECK, KILL_SWITCH, NEWS_LOCK
    passed = Column(Boolean, nullable=False)
    reason = Column(Text, nullable=False)
    proposed_order = Column(JSON, nullable=True)
    portfolio_state = Column(JSON, nullable=True)
