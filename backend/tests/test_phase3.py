import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.trading import PaperAccount, Position, Order
from backend.models.risk import RiskConfig
from backend.services.high_rr_algo.price_action import price_action_engine
from backend.services.high_rr_algo.smc_engine import smc_engine
from backend.services.high_rr_algo.ict_engine import ict_engine
from backend.services.high_rr_algo.mtf_confluence import mtf_confluence_engine
from backend.services.high_rr_algo.trade_manager import trade_manager
from backend.services.high_rr_algo.algo_coordinator import algo_coordinator

TEST_DB_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def test_db():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # Seed Default Account
    account = PaperAccount(
        account_number="ACC-ALGO-001",
        name="Phase 3 Algo Account",
        account_type="PROP_FIRM",
        initial_balance=100000.0,
        cash_balance=100000.0,
        realized_pnl=0.0,
        unrealized_pnl=0.0,
        margin_used=0.0,
        is_active=True
    )
    db.add(account)

    # Seed Risk Config
    config = RiskConfig(
        max_risk_per_trade_pct=1.0,
        max_portfolio_drawdown_pct=5.0,
        max_daily_loss_pct=3.0,
        max_daily_loss_usd=2000.0,
        max_trades_per_day=10,
        require_stop_loss=True,
        min_risk_reward_ratio=1.5,
        kill_switch_active=False
    )
    db.add(config)
    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_price_action_mss_and_sr_flip():
    # Synthesize candles showing lower highs then an explosive break of the last swing high (Bullish MSS)
    wave_prices = [
        # Up to SH1 (~51000)
        50200, 50500, 50800, 51000, 50800, 50500,
        # Down to SL1 (~50000)
        50200, 50000, 50200, 50400,
        # Up to SH2 (LH: ~50600)
        50600, 50400, 50100, 49800,
        # Down to SL2 (LL: ~49600)
        49600, 49800, 50100, 50400,
        # Break above SH2 (MSS breakout: 50900)
        50700, 50900
    ]
    candles = []
    for p in wave_prices:
        candles.append({
            "open": p - 20, "high": p + 50, "low": p - 50, "close": p + 10, "volume": 100.0, "symbol": "BTCUSDT"
        })

    mss = price_action_engine.detect_market_structure_shift(candles)
    # Validate pivot and structural detection
    highs = [c["high"] for c in candles]
    lows = [c["low"] for c in candles]
    shs, sls = price_action_engine.find_pivots(highs, lows, left_bars=2, right_bars=2)
    assert len(shs) > 0
    assert len(sls) > 0
    assert mss["detected"] is True
    assert mss["type"] == "BULLISH_MSS"

def test_smc_bos_order_blocks_and_premium_discount():
    # 1. Premium vs Discount Fibonacci Calculation
    # Range 60,000 to 70,000. Equilibrium is 65,000.
    res_discount = smc_engine.calculate_premium_discount(60000.0, 70000.0, 62000.0)
    assert res_discount["zone"] == "DISCOUNT"
    assert res_discount["is_discount"] is True
    assert res_discount["equilibrium"] == 65000.0

    res_premium = smc_engine.calculate_premium_discount(60000.0, 70000.0, 68000.0)
    assert res_premium["zone"] == "PREMIUM"
    assert res_premium["is_premium"] is True

    # 2. Bullish Order Block Detection
    candles = [
        {"open": 60000, "high": 60100, "low": 59900, "close": 60050, "volume": 100},
        {"open": 60050, "high": 60080, "low": 59500, "close": 59550, "volume": 120}, # Down candle (OB)
        {"open": 59550, "high": 60800, "low": 59500, "close": 60750, "volume": 400}, # Strong displacement 1
        {"open": 60750, "high": 61500, "low": 60700, "close": 61400, "volume": 500}, # Strong displacement 2
        {"open": 61400, "high": 61800, "low": 61300, "close": 61700, "volume": 300},
    ]
    obs = smc_engine.detect_order_blocks(candles, lookback=10)
    assert len(obs) > 0
    assert any(ob["type"] == "BULLISH_OB" for ob in obs)

def test_ict_fair_value_gaps_ote_and_killzones():
    # 1. Bullish Fair Value Gap (3-candle imbalance)
    # Candle 1: High = 60,000
    # Candle 2: Big green candle
    # Candle 3: Low = 60,800
    # Gap exists between 60,000 and 60,800
    candles = [
        {"high": 60000.0, "low": 59500.0, "open": 59600.0, "close": 59900.0},
        {"high": 61200.0, "low": 59850.0, "open": 59900.0, "close": 61100.0},
        {"high": 61500.0, "low": 60800.0, "open": 61100.0, "close": 61400.0},
    ]
    fvgs = ict_engine.detect_fair_value_gaps(candles, lookback=10)
    assert len(fvgs) == 1
    assert fvgs[0]["type"] == "BULLISH_FVG"
    assert fvgs[0]["gap_bottom"] == 60000.0
    assert fvgs[0]["gap_top"] == 60800.0
    assert fvgs[0]["consequent_encroachment"] == 60400.0  # (60000 + 60800) / 2

    # 2. Optimal Trade Entry (OTE 0.618 - 0.786 with 0.705 sweet spot)
    ote = ict_engine.calculate_optimal_trade_entry(swing_low=50000.0, swing_high=60000.0, direction="LONG")
    # Range = 10,000
    # 0.705 sweet spot = 60,000 - 7,050 = 52,950
    assert ote["ote_705_sweet_spot"] == 52950.0
    assert ote["ote_618"] == 53820.0
    assert ote["ote_786"] == 52140.0

def test_mtf_confluence_and_position_sizing():
    # Lot Sizing Calculation:
    # Equity = $100,000 | Risk % = 1.0% ($1,000 risk)
    # Entry = 60,000 | SL = 59,000 (Stop distance = $1,000)
    # Lot size must be exactly 1.0 BTC
    lot = mtf_confluence_engine.calculate_lot_size(
        equity=100000.0,
        risk_pct=1.0,
        entry_price=60000.0,
        stop_loss=59000.0,
        symbol="BTCUSDT"
    )
    assert lot == 1.0

    # If stop distance is $500, lot size must be 2.0 BTC
    lot_tight = mtf_confluence_engine.calculate_lot_size(
        equity=100000.0,
        risk_pct=1.0,
        entry_price=60000.0,
        stop_loss=59500.0,
        symbol="BTCUSDT"
    )
    assert lot_tight == 2.0

def test_trade_manager_milestones_and_trailing():
    state = {"tp1_hit": False, "tp2_hit": False, "tp3_hit": False, "be_moved": False}

    # Trade: Long Entry 60,000 | Initial SL 59,000 ($1,000 risk distance) | 1.0 Lot
    entry = 60000.0
    initial_sl = 59000.0

    # 1. Price rallies to 63,000 (+3.0R) -> Must scale 50% & move SL to Breakeven
    res1 = trade_manager.evaluate_position_milestones(
        side="LONG",
        entry_price=entry,
        current_price=63000.0,
        initial_sl=initial_sl,
        current_sl=initial_sl,
        remaining_qty=1.0,
        state=state
    )
    assert res1["current_r_multiple"] == 3.0
    assert len(res1["actions"]) == 1
    assert res1["actions"][0]["type"] == "SCALE_PARTIAL_AND_BREAKEVEN"
    assert res1["actions"][0]["scale_out_qty"] == 0.5
    assert res1["state"]["tp1_hit"] is True

    # 2. Price rallies to 65,000 (+5.0R) -> Must scale 25% & trail SL to +2.0R
    res2 = trade_manager.evaluate_position_milestones(
        side="LONG",
        entry_price=entry,
        current_price=65000.0,
        initial_sl=initial_sl,
        current_sl=60000.0,
        remaining_qty=0.5,
        state=state
    )
    assert res2["current_r_multiple"] == 5.0
    assert len(res2["actions"]) == 1
    assert res2["actions"][0]["type"] == "SCALE_PARTIAL_AND_TRAIL"
    assert res2["actions"][0]["new_stop_loss"] == 62000.0 # Entry 60k + 2*1000 = 62,000 (+2R locked)
    assert res2["state"]["tp2_hit"] is True

    # 3. Price expands to 70,000 (+10.0R) -> Ratchet trailing stop to +7.0R for runner
    res3 = trade_manager.evaluate_position_milestones(
        side="LONG",
        entry_price=entry,
        current_price=70000.0,
        initial_sl=initial_sl,
        current_sl=62000.0,
        remaining_qty=0.25,
        state=state
    )
    assert res3["current_r_multiple"] == 10.0
    assert len(res3["actions"]) == 1
    assert res3["actions"][0]["type"] == "RUNNER_PROFIT_LOCK"
    assert res3["actions"][0]["new_stop_loss"] == 67000.0 # Entry 60k + 7*1000 = 67,000 (+7R locked)
    assert res3["state"]["tp3_hit"] is True

def test_algo_coordinator_bots_management():
    # Verify all 3 bots are registered and active
    bots = algo_coordinator.get_bots_status()
    assert len(bots) == 3
    bot_ids = [b["id"] for b in bots]
    assert "PA_SNIPER" in bot_ids
    assert "SMC_INSTITUTIONAL" in bot_ids
    assert "ICT_SILVER_BULLET" in bot_ids

    # Test toggling
    updated = algo_coordinator.toggle_bot("PA_SNIPER", active=False)
    assert updated["is_active"] is False

    updated_on = algo_coordinator.toggle_bot("PA_SNIPER", active=True)
    assert updated_on["is_active"] is True
