from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from backend.database import Base

class Strategy(Base):
    __tablename__ = "strategies"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="trend_following")  # trend_following, mean_reversion, breakout, momentum, multi_indicator
    symbol = Column(String(32), default="BTCUSDT")
    timeframe = Column(String(8), default="1h")
    
    # Strategy definition & rules stored cleanly in structured JSON
    config = Column(JSON, nullable=False)
    # Status and evaluation
    is_active = Column(Boolean, default=False)  # For paper trading runner
    is_ai_generated = Column(Boolean, default=False)
    evaluation_label = Column(String(50), default="Unverified")  # Strong research candidate, Promising but requires further validation, Inconsistent performance, High risk, Rejected
    evaluation_score = Column(Float, default=0.0)
    evaluation_details = Column(JSON, nullable=True)
    
    version = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class StrategyRule(Base):
    __tablename__ = "strategy_rules"
    
    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, index=True, nullable=False)
    rule_type = Column(String(20), nullable=False)  # entry_long, exit_long, entry_short, exit_short, stop_loss, take_profit
    indicator_name = Column(String(50), nullable=False)  # rsi, macd, ema_fast, ema_slow, bb_upper, etc.
    operator = Column(String(20), nullable=False)  # cross_above, cross_below, greater_than, less_than
    threshold_value = Column(Float, nullable=True)
    secondary_indicator = Column(String(50), nullable=True)
    parameters = Column(JSON, nullable=True)
