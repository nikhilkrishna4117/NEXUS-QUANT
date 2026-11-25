import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models.trading import PaperAccount, Position, Order, Execution
from backend.models.risk import RiskConfig, RiskAuditLog
from backend.models.journal import AutomatedJournalEntry
from backend.models.trade_plan import ActiveTradePlan
from backend.services.risk_engine import risk_engine
from backend.services.paper_trading_service import paper_trading_service
from backend.services.journal_listener import journal_listener
from backend.services.broker_adapters.execution_manager import execution_manager
from backend.services.broker_adapters.ccxt_adapter import CCXTBrokerAdapter
from backend.services.broker_adapters.ctrader_adapter import CTraderBrokerAdapter
from backend.services.broker_adapters.tradelocker_adapter import TradeLockerBrokerAdapter

# In-memory SQLite for high-speed isolated Phase 2 test execution
TEST_DB_URL = "sqlite:///:memory:"

@pytest.fixture(scope="function")
def test_db():
    engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    # Seed Default Account
    account = PaperAccount(
        account_number="ACC-TEST-001",
        name="Phase 2 Test Account",
        account_type="PROP_FIRM",
        initial_balance=100000.0,
        cash_balance=100000.0,
        realized_pnl=0.0,
        unrealized_pnl=0.0,
        margin_used=0.0,
        is_active=True
    )
    db.add(account)

    # Seed Default Risk Config
    config = RiskConfig(
        max_risk_per_trade_pct=1.0,
        max_portfolio_drawdown_pct=5.0,
        max_daily_loss_pct=3.0,
        max_daily_loss_usd=2000.0,
        max_daily_profit_cap_usd=5000.0,
        max_trades_per_day=5,
        max_open_positions=3,
        max_consecutive_losses=3,
        require_stop_loss=True,
        min_risk_reward_ratio=1.5,
        news_lockout_buffer_minutes=15,
        kill_switch_active=False
    )
    db.add(config)
    db.commit()

    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

def test_guardrail_mandatory_stop_loss_and_sizing(test_db):
    account = test_db.query(PaperAccount).first()

    # 1. Order without Stop-Loss must be REJECTED
    passed, reason = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.1,
        price=60000.0,
        stop_loss=None,
        take_profit=66000.0,
        db=test_db
    )
    assert passed is False
    assert "STOP-LOSS" in reason.upper()

    # 2. Order with oversized dollar risk (> 1.0% of $100k = $1,000) must be REJECTED
    # Entry 60000, SL 40000 -> risk $20,000 * 0.1 = $2,000 (2.0% of equity)
    passed, reason = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.1,
        price=60000.0,
        stop_loss=40000.0,
        take_profit=70000.0,
        db=test_db
    )
    assert passed is False
    assert "POSITION SIZING EXCEEDED" in reason.upper()

    # 3. Valid order meeting strict risk % and R:R must be APPROVED
    # Entry 60000, SL 55000 -> risk $5,000 * 0.1 = $500 (0.5% risk), TP 70000 -> 1:2 R:R
    passed, reason = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.1,
        price=60000.0,
        stop_loss=55000.0,
        take_profit=70000.0,
        db=test_db
    )
    assert passed is True
    assert "PASSED" in reason.upper() or "APPROVED" in reason.upper()

def test_guardrail_daily_loss_cap_and_overtrading(test_db):
    account = test_db.query(PaperAccount).first()
    config = test_db.query(RiskConfig).first()

    # Exceed Max Trades per Day
    config.max_trades_per_day = 2
    test_db.commit()

    # Insert 2 existing orders today
    now = datetime.now(timezone.utc)
    for i in range(2):
        o = Order(
            client_order_id=f"TEST-ORD-{i}",
            account_id=account.id,
            symbol="BTCUSDT",
            side="BUY",
            quantity=0.1,
            price=60000.0,
            status="FILLED",
            created_at=now
        )
        test_db.add(o)
    test_db.commit()

    passed, reason = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.01,
        price=60000.0,
        stop_loss=59000.0,
        take_profit=63000.0,
        db=test_db
    )
    assert passed is False
    assert "OVERTRADING" in reason.upper() or "MAXIMUM OF 2 TRADES" in reason.upper()

def test_guardrail_emergency_kill_switch_and_flatten(test_db):
    account = test_db.query(PaperAccount).first()

    # Create dummy open position
    pos = Position(
        account_id=account.id,
        symbol="BTCUSDT",
        side="LONG",
        quantity=0.5,
        entry_price=60000.0,
        current_price=60500.0,
        stop_loss=58000.0,
        is_open=True
    )
    test_db.add(pos)
    test_db.commit()

    # Trigger Emergency Kill Switch Liquidation
    res = execution_manager.emergency_kill_switch_flatten(test_db)
    assert res["kill_switch_active"] is True

    # Validate that config is locked
    config = test_db.query(RiskConfig).first()
    assert config.kill_switch_active is True
    assert config.is_locked is True

    # Validate that new orders are strictly blocked
    passed, reason = risk_engine.validate_proposed_order(
        account=account,
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.01,
        price=60000.0,
        stop_loss=59000.0,
        take_profit=63000.0,
        db=test_db
    )
    assert passed is False
    assert "KILL SWITCH IS ACTIVE" in reason.upper()

def test_broker_adapters_suite():
    # 1. CCXT Adapter (Crypto / Binance Testnet)
    ccxt_adapter = CCXTBrokerAdapter(exchange_id="binance", is_live=False)
    assert ccxt_adapter.connect() is True
    ccxt_fill = ccxt_adapter.submit_order(
        symbol="BTCUSDT",
        side="BUY",
        quantity=0.05,
        price=64000.0,
        stop_loss=62000.0,
        take_profit=70000.0
    )
    assert ccxt_fill["success"] is True
    assert ccxt_fill["status"] == "FILLED"
    assert len(ccxt_adapter.get_open_positions()) == 1

    # 2. cTrader Adapter
    ctrader_adapter = CTraderBrokerAdapter(is_live=False)
    assert ctrader_adapter.connect({"account_id": "CT-PROP-101"}) is True
    ct_fill = ctrader_adapter.submit_order(
        symbol="EURUSD",
        side="BUY",
        quantity=1.0,
        price=1.0850,
        stop_loss=1.0800,
        take_profit=1.0950
    )
    assert ct_fill["success"] is True
    assert ct_fill["broker"] == "cTrader"

    # 3. TradeLocker Adapter
    tl_adapter = TradeLockerBrokerAdapter(is_live=False)
    assert tl_adapter.connect({"account_id": "TL-CHALLENGE-50K"}) is True
    tl_fill = tl_adapter.submit_order(
        symbol="XAUUSD",
        side="SELL",
        quantity=0.5,
        price=2650.0,
        stop_loss=2665.0,
        take_profit=2620.0
    )
    assert tl_fill["success"] is True
    assert tl_fill["broker"] == "TradeLocker"

def test_automated_post_trade_journal_listener(test_db):
    account = test_db.query(PaperAccount).first()

    # Create active Edge Trade Plan
    plan = ActiveTradePlan(
        plan_id="PLAN-SMC-01",
        title="SMC_ORDER_BLOCK_LONG",
        symbol="BTCUSDT",
        bias="BULLISH",
        framework="SMC",
        timeframe_bias="4H",
        timeframe_entry="5m",
        entry_zone_high=60100.0,
        entry_zone_low=59900.0,
        invalidation_price=58000.0,
        target_price_1=63000.0,
        target_price_final=66000.0,
        checklist_items=[{"item": "HTF liquidity swept", "checked": True}],
        is_active=True
    )
    test_db.add(plan)
    test_db.commit()

    # Simulate position that hit +3.0R Take Profit
    # Entry: 60,000 | SL: 58,000 ($2,000 risk per unit) | Quantity: 0.1 | Risk = $200
    # Closed: 66,000 (+$600 gross profit = +3.0R)
    pos = Position(
        account_id=account.id,
        symbol="BTCUSDT",
        side="LONG",
        quantity=0.1,
        entry_price=60000.0,
        current_price=66000.0,
        stop_loss=58000.0,
        take_profit=66000.0,
        unrealized_pnl=600.0,
        is_open=True,
        opened_at=datetime.utcnow()
    )
    test_db.add(pos)
    test_db.commit()

    # Intercept position close via journal_listener
    entry = journal_listener.record_closed_position(
        position=pos,
        closed_price=66000.0,
        net_pnl=600.0,
        reason="ALGO_TARGET_TAKE_PROFIT",
        db=test_db
    )

    assert entry is not None
    assert entry.journal_id.startswith("JRN-")
    assert entry.symbol == "BTCUSDT"
    assert entry.direction == "BUY"
    assert entry.net_pnl == 600.0
    assert entry.r_multiple == 3.0  # $600 / $200 risk = +3.0R
    assert entry.plan_compliance is True
    assert entry.is_immutable is True
    assert entry.strategy_used == "SMC_ORDER_BLOCK_LONG"
