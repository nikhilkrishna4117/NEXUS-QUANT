from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Index
from backend.database import Base

class Instrument(Base):
    __tablename__ = "instruments"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(32), unique=True, index=True, nullable=False)  # e.g. BTCUSDT, XAUUSD, RELIANCE.NS
    name = Column(String(100), nullable=False)
    asset_class = Column(String(32), nullable=False)  # crypto, commodity, forex, equity
    base_asset = Column(String(16), nullable=False)
    quote_asset = Column(String(16), nullable=False)
    provider = Column(String(32), nullable=False)  # binance, coinbase, yahoo_finance
    is_active = Column(Boolean, default=True)
    min_quantity = Column(Float, default=0.0001)
    price_precision = Column(Integer, default=2)
    quantity_precision = Column(Integer, default=4)
    created_at = Column(DateTime, default=datetime.utcnow)

class Candle(Base):
    __tablename__ = "candles"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(32), index=True, nullable=False)
    timeframe = Column(String(8), index=True, nullable=False)  # 1m, 5m, 15m, 1h, 4h, 1d
    timestamp = Column(DateTime, index=True, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    turnover = Column(Float, default=0.0)
    provider = Column(String(32), default="binance")
    is_closed = Column(Boolean, default=True)
    
    __table_args__ = (
        Index("idx_symbol_tf_timestamp", "symbol", "timeframe", "timestamp", unique=True),
    )

class ProviderStatus(Base):
    __tablename__ = "provider_statuses"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_name = Column(String(32), unique=True, nullable=False)
    status = Column(String(20), default="operational")  # operational, degraded, offline
    last_ping = Column(DateTime, default=datetime.utcnow)
    last_data_timestamp = Column(DateTime, nullable=True)
    active_symbols = Column(String(255), default="BTCUSDT")
    latency_ms = Column(Float, default=0.0)
    error_count = Column(Integer, default=0)
    last_error_message = Column(String(255), nullable=True)
