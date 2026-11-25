import asyncio
import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.services.technical_analysis import technical_analysis_engine
from backend.services.backtesting_engine import backtesting_engine
from backend.services.risk_engine import risk_engine
from backend.services.paper_trading_service import paper_trading_service
from backend.services.strategy_engine import strategy_engine
from backend.models.trading import PaperAccount

from sqlalchemy.pool import StaticPool

# Setup in-memory SQLite for testing
@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed test paper account
    account = PaperAccount(
        account_number="ACC-TEST-001",
        initial_balance=100000.0,
        cash_balance=100000.0,
        currency="USD"
    )
    session.add(account)
    session.commit()

    yield session
    session.close()

def generate_mock_candles(count=100, base_price=60000.0):
    """Generate realistic synthetic OHLCV candles for pure math/indicator unit testing."""
    candles = []
    price = base_price
    start_time = datetime(2024, 1, 1, 0, 0)
    for i in range(count):
        delta = (i % 7 - 3) * 50.0
        close_p = price + delta
        high_p = max(price, close_p) + 40.0
        low_p = min(price, close_p) - 35.0
        open_p = price
        candles.append({
            "symbol": "BTCUSDT",
            "timeframe": "1h",
            "timestamp": start_time + timedelta(hours=i),
            "open": open_p,
            "high": high_p,
            "low": low_p,
            "close": close_p,
            "volume": 120.5 + (i % 10) * 15.0
        })
        price = close_p
    return candles

def test_technical_analysis_indicators():
    candles = generate_mock_candles(100)
    indicators = technical_analysis_engine.calculate_indicators(candles)

    assert "rsi" in indicators
    assert 0 <= indicators["rsi"] <= 100
    assert "macd" in indicators
    assert "line" in indicators["macd"]
    assert "signal" in indicators["macd"]
    assert "bollinger_bands" in indicators
    assert indicators["bollinger_bands"]["upper"] >= indicators["bollinger_bands"]["lower"]
    assert "atr" in indicators
    assert indicators["atr"] > 0
    assert "adx" in indicators
    assert "vwap" in indicators
    assert indicators["vwap"] > 0

def test_market_structure_and_patterns():
    candles = generate_mock_candles(60)
    structure = technical_analysis_engine.identify_market_structure(candles)
    assert "structure" in structure
    assert "support_levels" in structure
    assert "resistance_levels" in structure

    patterns = technical_analysis_engine.detect_chart_patterns(candles)
    assert isinstance(patterns, list)

def test_backtesting_engine_execution():
    candles = generate_mock_candles(120)
    strat_config = {
        "type": "ema_crossover",
        "fast_period": 9,
        "slow_period": 21,
        "stop_loss_atr_mult": 2.0,
        "take_profit_atr_mult": 4.0
    }
    report = backtesting_engine.run_backtest(
        strategy_config=strat_config,
        candles=candles,
        symbol="BTCUSDT",
        timeframe="1h"
    )

    assert "total_return_pct" in report
    assert "sharpe_ratio" in report
    assert "max_drawdown_pct" in report
    assert "trades" in report
    assert "equity_curve" in report
    assert report["initial_capital"] == 100000.0
    assert len(report["equity_curve"]) > 0

def test_risk_engine_pre_trade_validation(test_db):
    account = test_db.query(PaperAccount).first()

    # 1. Valid order with proper Stop Loss
    valid, reason = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.1,
        price=60000.0,
        stop_loss=59000.0,
        take_profit=63000.0,
        db=test_db
    )
    assert valid is True

    # 2. Rejection: Missing Stop Loss when required
    invalid_no_sl, reason_no_sl = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.1,
        price=60000.0,
        stop_loss=None,
        take_profit=63000.0,
        db=test_db
    )
    assert invalid_no_sl is False
    assert "Stop-Loss price is mandatory" in reason_no_sl

    # 3. Rejection: Stop Loss above Buy entry price
    invalid_bad_sl, reason_bad_sl = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.1,
        price=60000.0,
        stop_loss=61000.0,
        take_profit=65000.0,
        db=test_db
    )
    assert invalid_bad_sl is False
    assert "must be strictly below" in reason_bad_sl

    # 4. Rejection: Position sizing or funds exceeded
    invalid_capital, reason_capital = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=5.0,  # $300,000 order on $100,000 capital
        price=60000.0,
        stop_loss=59500.0,
        take_profit=62000.0,
        db=test_db
    )
    assert invalid_capital is False
    assert any(term in reason_capital for term in ["POSITION SIZING EXCEEDED", "INSUFFICIENT FUNDS"])

def test_paper_trading_order_fill_and_positions(test_db):
    result = paper_trading_service.place_order(
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.1,
        price=60000.0,
        stop_loss=58500.0,
        take_profit=63000.0,
        db=test_db
    )
    assert result["success"] is True
    assert result["status"] == "FILLED"
    assert result["executed_price"] > 0
    assert result["fee"] > 0

    summary = paper_trading_service.get_portfolio_summary(test_db)
    assert len(summary["open_positions"]) == 1
    assert summary["open_positions"][0]["symbol"] == "BTCUSDT"
    assert summary["cash_balance"] < 100000.0

def test_ai_candidate_strategy_synthesis():
    bull_candidates = strategy_engine.generate_ai_candidate_strategies("Strong Bullish Trend", "Normal Volatility")
    assert len(bull_candidates) >= 2
    assert any("Momentum" in c["name"] or "Trend" in c["name"] for c in bull_candidates)

    bear_candidates = strategy_engine.generate_ai_candidate_strategies("Strong Bearish Trend", "High Volatility")
    assert len(bear_candidates) >= 1
