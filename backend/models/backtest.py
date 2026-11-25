from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON, Boolean
from backend.database import Base

class BacktestRun(Base):
    __tablename__ = "backtest_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    strategy_id = Column(Integer, index=True, nullable=True)
    strategy_name = Column(String(100), nullable=False)
    symbol = Column(String(32), nullable=False)
    timeframe = Column(String(8), nullable=False)
    
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    initial_capital = Column(Float, default=100000.0)
    final_capital = Column(Float, nullable=False)
    
    # Financial performance metrics
    total_net_profit = Column(Float, nullable=False)
    total_return_pct = Column(Float, nullable=False)
    cagr_pct = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)
    sortino_ratio = Column(Float, default=0.0)
    calmar_ratio = Column(Float, default=0.0)
    max_drawdown_pct = Column(Float, default=0.0)
    max_drawdown_duration_bars = Column(Integer, default=0)
    
    # Trade statistics
    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate_pct = Column(Float, default=0.0)
    profit_factor = Column(Float, default=0.0)
    expectancy = Column(Float, default=0.0)
    avg_win = Column(Float, default=0.0)
    avg_loss = Column(Float, default=0.0)
    risk_reward_ratio = Column(Float, default=0.0)
    max_consecutive_wins = Column(Integer, default=0)
    max_consecutive_losses = Column(Integer, default=0)
    avg_holding_bars = Column(Float, default=0.0)
    
    # Commission and slippage incurred
    total_fees = Column(Float, default=0.0)
    total_slippage = Column(Float, default=0.0)
    
    # Out of sample validation & robustness
    is_walk_forward = Column(Boolean, default=False)
    out_of_sample_return_pct = Column(Float, nullable=True)
    out_of_sample_sharpe = Column(Float, nullable=True)
    robustness_score = Column(Float, default=0.0)
    evaluation_label = Column(String(50), default="Unverified")
    
    # Report notes & assumptions
    execution_assumptions = Column(JSON, nullable=True)
    limitations = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class BacktestTrade(Base):
    __tablename__ = "backtest_trades"
    
    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(Integer, index=True, nullable=False)
    symbol = Column(String(32), nullable=False)
    side = Column(String(10), nullable=False)  # BUY / SELL
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=False)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    gross_pnl = Column(Float, nullable=False)
    net_pnl = Column(Float, nullable=False)
    return_pct = Column(Float, nullable=False)
    fees = Column(Float, default=0.0)
    slippage = Column(Float, default=0.0)
    exit_reason = Column(String(30), default="signal")  # signal, stop_loss, take_profit, end_of_data
    holding_bars = Column(Integer, default=0)

class EquityPoint(Base):
    __tablename__ = "equity_points"
    
    id = Column(Integer, primary_key=True, index=True)
    backtest_id = Column(Integer, index=True, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    equity = Column(Float, nullable=False)
    drawdown_pct = Column(Float, default=0.0)
    cash = Column(Float, nullable=False)
