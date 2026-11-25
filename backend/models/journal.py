from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from backend.database import Base

class AutomatedJournalEntry(Base):
    """
    Automated Post-Trade Journal Model.
    Captures every trade automatically when closed. Protected immutable storage
    that cannot be altered or deleted by automated AI processes.
    """
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    journal_id = Column(String(64), unique=True, index=True, nullable=False)
    trade_id = Column(String(64), index=True, nullable=False)
    symbol = Column(String(32), index=True, nullable=False)
    asset_class = Column(String(32), default="CRYPTO") # FOREX, CRYPTO, METALS, INDICES, STOCKS
    direction = Column(String(10), nullable=False)      # BUY / SELL
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    lot_size = Column(Float, nullable=False)
    slippage_bps = Column(Float, default=0.0)
    net_pnl = Column(Float, nullable=False)
    r_multiple = Column(Float, default=0.0)             # Realized R-Multiple (e.g. +3.5R, -1.0R)
    strategy_used = Column(String(64), nullable=False)  # Price Action, SMC, ICT, Custom
    chart_snapshot_url = Column(String(255), nullable=True)
    
    # Trader Behavioral & Psychological Tags
    emotion_tag = Column(String(32), default="DISCIPLINED") # CONFIDENT, FOMO, REVENGE, ANXIOUS, DISCIPLINED
    user_notes = Column(Text, nullable=True)
    voice_reflection = Column(Text, nullable=True)
    plan_compliance = Column(Boolean, default=True)      # Did trade follow active Edge Trade Plan?
    compliance_score = Column(Float, default=100.0)      # 0 to 100 discipline rating
    
    # Execution Environment
    execution_mode = Column(String(10), default="PAPER") # PAPER / LIVE
    broker = Column(String(32), default="INTERNAL")      # cTrader, TradeLocker, CCXT, Internal
    
    # Protection Guard: True = immutable user record
    is_immutable = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, default=datetime.utcnow)
