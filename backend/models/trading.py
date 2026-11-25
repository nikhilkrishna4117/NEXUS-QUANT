from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from backend.database import Base

class PaperAccount(Base):
    __tablename__ = "paper_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    account_number = Column(String(32), unique=True, nullable=False, default="ACC-PAPER-001")
    name = Column(String(64), default="Master Trading Account")
    account_type = Column(String(32), default="STANDARD")  # STANDARD, PROP_FIRM, CHALLENGE, SCALPER, SWING
    initial_balance = Column(Float, default=100000.0)
    cash_balance = Column(Float, default=100000.0)
    realized_pnl = Column(Float, default=0.0)
    unrealized_pnl = Column(Float, default=0.0)
    margin_used = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    currency = Column(String(10), default="USD")
    last_reset_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    client_order_id = Column(String(64), unique=True, index=True, nullable=False)
    account_id = Column(Integer, default=1, index=True)
    strategy_id = Column(Integer, nullable=True)
    symbol = Column(String(32), index=True, nullable=False)
    side = Column(String(10), nullable=False)  # BUY / SELL
    order_type = Column(String(20), default="MARKET")  # MARKET, LIMIT, STOP_LOSS
    quantity = Column(Float, nullable=False)
    price = Column(Float, nullable=True)
    stop_price = Column(Float, nullable=True)
    take_profit_price = Column(Float, nullable=True)
    status = Column(String(20), default="PENDING")  # PENDING, FILLED, REJECTED, CANCELLED
    reject_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Position(Base):
    __tablename__ = "positions"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, default=1, index=True)
    symbol = Column(String(32), index=True, nullable=False)
    side = Column(String(10), nullable=False)  # LONG / SHORT
    quantity = Column(Float, nullable=False)
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=True)
    take_profit = Column(Float, nullable=True)
    unrealized_pnl = Column(Float, default=0.0)
    unrealized_pnl_pct = Column(Float, default=0.0)
    margin_used = Column(Float, default=0.0)
    is_open = Column(Boolean, default=True, index=True)
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

class Execution(Base):
    __tablename__ = "executions"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, index=True, nullable=False)
    symbol = Column(String(32), nullable=False)
    side = Column(String(10), nullable=False)
    executed_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    fee = Column(Float, default=0.0)
    slippage = Column(Float, default=0.0)
    executed_at = Column(DateTime, default=datetime.utcnow)


class TradeRecord(Base):
    """
    Unified Trade Record for Autonomous Algo & Manual Execution.
    Tracks multi-asset trades (Forex, Crypto, Metals, Indices, Stocks) with
    staged take-profits (TP1, TP2, TP3), dynamic trailing stops, and exact R-multiples.
    """
    __tablename__ = "trade_records"

    id = Column(Integer, primary_key=True, index=True)
    trade_id = Column(String(64), unique=True, index=True, nullable=False)
    symbol = Column(String(32), index=True, nullable=False)
    asset_class = Column(String(32), default="CRYPTO") # FOREX, CRYPTO, METALS, INDICES, STOCKS
    direction = Column(String(10), nullable=False)      # BUY / SELL
    
    # Prices
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=False)
    initial_stop_loss = Column(Float, nullable=False)
    trailing_stop = Column(Float, nullable=True)
    take_profit_1 = Column(Float, nullable=True)        # 1:3 or 1:5 milestone
    take_profit_2 = Column(Float, nullable=True)        # 1:10 milestone
    take_profit_3 = Column(Float, nullable=True)        # 1:20 - 1:30 runner
    target_rr = Column(Float, default=10.0)             # Planned Target R:R
    
    # Sizing & Risk
    lot_size = Column(Float, nullable=False)
    position_size_usd = Column(Float, default=0.0)
    risk_percentage = Column(Float, default=1.0)
    risk_usd = Column(Float, default=0.0)
    
    # P&L & Realized Multiples
    pnl_gross = Column(Float, default=0.0)
    pnl_net = Column(Float, default=0.0)
    commission = Column(Float, default=0.0)
    slippage_bps = Column(Float, default=0.0)
    realized_rr = Column(Float, default=0.0)
    
    # Lifecycle
    status = Column(String(20), default="OPEN")         # PENDING, OPEN, PARTIAL_CLOSED, CLOSED, CANCELLED
    close_reason = Column(String(32), nullable=True)    # TP1, TP2, TP3, STOP_LOSS, TRAIL_SL, MANUAL, EMERGENCY_KILL
    strategy_name = Column(String(64), default="MANUAL")
    execution_mode = Column(String(10), default="PAPER")# PAPER / LIVE
    broker = Column(String(32), default="INTERNAL")     # cTrader, TradeLocker, CCXT/Binance
    
    # Timestamps
    opened_at = Column(DateTime, default=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)
