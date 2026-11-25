from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from backend.database import Base

class ActiveTradePlan(Base):
    """
    Edge Active Trade Plan Model.
    Pinned beside live charts to enforce pre-trade discipline, invalidation rules,
    setup checklists, and trade compliance tracking.
    """
    __tablename__ = "active_trade_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(128), nullable=False)
    symbol = Column(String(32), index=True, nullable=False)
    bias = Column(String(10), nullable=False)           # BULLISH / BEARISH
    framework = Column(String(32), default="SMC")       # PRICE_ACTION, SMC, ICT, CUSTOM
    timeframe_bias = Column(String(10), default="4H")   # HTF bias timeframe
    timeframe_entry = Column(String(10), default="5m")  # LTF entry timeframe
    
    entry_zone_high = Column(Float, nullable=False)
    entry_zone_low = Column(Float, nullable=False)
    invalidation_price = Column(Float, nullable=False)  # Stop loss invalidation
    target_price_1 = Column(Float, nullable=False)      # Primary TP (1:3 / 1:5)
    target_price_final = Column(Float, nullable=False)  # HTF Liquidity Run (1:10 - 1:30)
    
    # Pre-Trade Execution Checklist (JSON array of { item: str, checked: bool })
    checklist_items = Column(JSON, nullable=False)
    risk_percentage = Column(Float, default=1.0)        # Planned risk %
    
    is_active = Column(Boolean, default=True)           # Only 1 Active Plan pinned per symbol
    status = Column(String(20), default="WAITING_FOR_TRIGGER") # WAITING_FOR_TRIGGER, TRIGGERED, INVALIDATED, COMPLETED
    compliance_score = Column(Float, default=100.0)
    
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
