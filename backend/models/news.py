from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from backend.database import Base

class ForexFactoryNewsEvent(Base):
    """
    Forex Factory Real Economic Calendar & Manipulation Event Model.
    Tracks live economic events, 5-hour pre-event triggers, actual-vs-forecast bias,
    and Judas swing / stop-hunt retail manipulation alerts.
    """
    __tablename__ = "forex_factory_news"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    title = Column(String(128), nullable=False)
    country = Column(String(10), nullable=False)      # USD, EUR, GBP, JPY, CAD, AUD
    currency = Column(String(10), nullable=False)
    date_time_utc = Column(DateTime, nullable=False, index=True)
    impact = Column(String(10), nullable=False)       # HIGH, MEDIUM, LOW
    
    forecast = Column(String(32), nullable=True)
    previous = Column(String(32), nullable=True)
    actual = Column(String(32), nullable=True)
    
    # Quantitative News Bias
    bias_direction = Column(String(20), default="NEUTRAL") # BULLISH, BEARISH, NEUTRAL
    bias_confidence_pct = Column(Float, default=0.0)
    deviation_score = Column(Float, default=0.0)
    
    # 5-Hour Pre-News Trigger
    is_five_hour_alert_active = Column(Boolean, default=False)
    alert_triggered_at = Column(DateTime, nullable=True)
    trade_blocking_enforced = Column(Boolean, default=False)
    
    # Retail Manipulation / Judas Swing Detector
    manipulation_detected = Column(Boolean, default=False)
    manipulation_type = Column(String(64), default="NONE") # JUDAS_SWING, LIQUIDITY_SWEEP, WICK_EXPANSION
    manipulation_details = Column(Text, nullable=True)
    liquidity_levels_swept = Column(JSON, nullable=True)   # Equal Highs / Lows swept
    
    affected_pairs = Column(JSON, nullable=True)           # e.g. ["EURUSD", "GBPUSD", "XAUUSD", "US30"]
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
