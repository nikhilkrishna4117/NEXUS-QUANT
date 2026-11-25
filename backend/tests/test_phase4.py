"""
Phase 4 Automated Tests: Dedicated Custom Strategy Backtesting Studio
Tests Python AST compiler, Pine Script v5 transpiler, Plain-English rule compiler,
event-driven institutional backtesting with spreads/slippage/commissions,
high R:R distribution (1:10 to 1:30), expectancy E[R], and 1-click Algo deployment.
"""
import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timezone

from backend.services.strategy_compiler.python_compiler import python_compiler
from backend.services.strategy_compiler.pinescript_transpiler import pinescript_transpiler
from backend.services.strategy_compiler.natural_language_compiler import natural_language_compiler
from backend.services.strategy_compiler.strategy_resolver import strategy_resolver
from backend.services.backtesting_studio import backtesting_studio
from backend.services.high_rr_algo.algo_coordinator import algo_coordinator

@pytest.fixture
def sample_ohlcv_data():
    """Generates 100 deterministic realistic OHLCV candles with clear oscillating waves."""
    candles = []
    base_price = 50000.0
    for i in range(100):
        # Sine wave oscillating both up and down
        price = base_price + (np.sin(i / 4.0) * 400.0)
        candles.append({
            "timestamp": f"2026-01-01T{i%24:02d}:00:00Z",
            "time": f"2026-01-01T{i%24:02d}:00:00Z",
            "open": round(price - 10, 2),
            "high": round(price + 40, 2),
            "low": round(price - 40, 2),
            "close": round(price + (15 if i % 2 == 0 else -15), 2),
            "volume": round(150.0 + (i * 2.0), 2),
            "symbol": "BTCUSDT"
        })
    return candles

def test_python_strategy_compiler_execution_and_safety(sample_ohlcv_data):
    df = pd.DataFrame(sample_ohlcv_data)

    # 1. Valid Python strategy code
    valid_code = (
        "def generate_signals(df):\n"
        "    close = df['close'].values\n"
        "    signals = np.zeros(len(df))\n"
        "    for i in range(1, len(df)):\n"
        "        if close[i] > close[i-1]:\n"
        "            signals[i] = 1.0\n"
        "        else:\n"
        "            signals[i] = -1.0\n"
        "    return signals\n"
    )
    signals, err = python_compiler.execute(valid_code, df)
    assert err is None
    assert len(signals) == len(df)
    assert np.any(signals == 1.0)
    assert np.any(signals == -1.0)

    # 2. Block malicious import
    malicious_code = (
        "import os\n"
        "os.system('whoami')\n"
    )
    is_valid, sec_err = python_compiler.validate_syntax(malicious_code)
    assert is_valid is False
    assert "Security Violation" in sec_err

    # 3. Block restricted builtin access
    hack_code = (
        "def generate_signals(df):\n"
        "    return eval('__import__(\"sys\").exit()')\n"
    )
    is_valid, sec_err = python_compiler.validate_syntax(hack_code)
    assert is_valid is False
    assert "restricted" in sec_err

def test_pinescript_transpiler_execution(sample_ohlcv_data):
    df = pd.DataFrame(sample_ohlcv_data)

    pine_code = (
        "//@version=5\n"
        "strategy('Test Ribbon', overlay=true)\n"
        "fast = ta.ema(close, 9)\n"
        "slow = ta.ema(close, 21)\n"
        "longCondition = ta.crossover(fast, slow)\n"
        "exitCondition = ta.crossunder(fast, slow)\n"
        "if (longCondition)\n"
        "    strategy.entry('Long', strategy.long)\n"
        "if (exitCondition)\n"
        "    strategy.close('Long')\n"
    )
    signals, err = pinescript_transpiler.parse_and_execute(pine_code, df)
    assert err is None
    assert len(signals) == len(df)
    assert isinstance(signals, np.ndarray)

def test_natural_language_compiler_rules(sample_ohlcv_data):
    df = pd.DataFrame(sample_ohlcv_data)

    text_rule = "Buy when RSI is below 40 and price is above EMA 50. Exit when RSI > 65. SL at 1.5 ATR, TP at 1:10 RR"
    signals, parsed_cfg, err = natural_language_compiler.compile_rules(text_rule, df)

    assert err is None
    assert len(signals) == len(df)
    assert parsed_cfg["take_profit_rr"] == 10.0
    assert parsed_cfg["stop_loss_atr"] == 1.5
    assert len(parsed_cfg["entry_conditions"]) >= 1

def test_backtesting_studio_simulation_and_metrics(sample_ohlcv_data):
    # Run full institutional backtest with spreads, slippage, and commissions
    report = backtesting_studio.run_simulation(
        candles=sample_ohlcv_data,
        symbol="BTCUSDT",
        timeframe="1h",
        strategy_format="english",
        strategy_code="Buy when EMA 9 crosses above EMA 21. SL at 1.5 ATR, TP at 1:10 RR",
        initial_capital=100000.0,
        risk_per_trade_pct=1.0,
        spread_pips=1.5,
        commission_per_lot=5.0,
        slippage_bps=3.0,
        leverage=50.0
    )

    assert report["initial_capital"] == 100000.0
    assert report["symbol"] == "BTCUSDT"
    assert "win_rate_pct" in report
    assert "profit_factor" in report
    assert "expectancy_r" in report
    assert "sharpe_ratio" in report
    assert "sortino_ratio" in report
    assert "calmar_ratio" in report
    assert "r_distribution" in report
    assert "equity_curve" in report
    assert "chart_markers" in report
    assert len(report["equity_curve"]) == len(sample_ohlcv_data)

def test_1click_deploy_to_algo_coordinator():
    res = backtesting_studio.deploy_to_algo_coordinator(
        strategy_name="Quantum Alpha ICT",
        strategy_format="python",
        strategy_code="def generate_signals(df): return np.zeros(len(df))",
        symbol="BTCUSDT",
        target_rr=15.0,
        risk_per_trade_pct=1.0
    )

    assert res["status"] == "DEPLOYED"
    assert "CUSTOM_QUANTUM_ALPHA_ICT" == res["bot_id"]

    # Verify presence in Algo Coordinator
    bots = algo_coordinator.get_bots_status()
    matching = [b for b in bots if b["id"] == "CUSTOM_QUANTUM_ALPHA_ICT"]
    assert len(matching) == 1
    assert matching[0]["target_rr"] == "1:15"
