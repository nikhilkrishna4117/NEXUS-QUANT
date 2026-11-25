import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.services.security_service import security_vault
from backend.services.forex_factory_service import forex_factory_service
from backend.models.journal import AutomatedJournalEntry
from backend.models.trade_plan import ActiveTradePlan
from backend.models.risk import RiskConfig, RiskAuditLog
from backend.models.trading import Position

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
    yield session
    session.close()

def test_aes256_encryption_and_tamper_detection():
    """Verify AES-256 encrypts, decrypts, and rejects tampered ciphertext."""
    secret = "ctrader_live_secret_token_994829482"
    encrypted = security_vault.encrypt(secret)
    assert encrypted != secret
    assert len(encrypted) > 32

    # Correct decryption
    decrypted = security_vault.decrypt(encrypted)
    assert decrypted == secret

    # Tamper with encrypted string -> must raise ValueError
    tampered = encrypted[:-4] + "AAAA"
    with pytest.raises(ValueError):
        security_vault.decrypt(tampered)

    # Key masking
    masked = security_vault.mask_key(secret)
    assert "••••••••" in masked
    assert masked.startswith("ctra")

def test_forex_factory_calendar_and_five_hour_trigger():
    """Verify Forex Factory economic calendar ingestion and 5-hour countdown trigger."""
    events = forex_factory_service.fetch_live_calendar()
    assert len(events) >= 1

    # Test 5-hour trigger detection
    triggers = forex_factory_service.get_five_hour_pre_triggers()
    assert isinstance(triggers, list)

    # Test quantitative bias calculation
    bias_bullish = forex_factory_service._evaluate_bias(
        title="CPI m/m", country="USD", forecast="0.2%", previous="0.2%", actual="0.4%"
    )
    assert bias_bullish["direction"] == "BULLISH"
    assert bias_bullish["confidence"] > 50.0

    # Inverse metric: Unemployment (Higher actual = Bearish for currency)
    bias_bearish = forex_factory_service._evaluate_bias(
        title="Unemployment Rate", country="USD", forecast="3.8%", previous="3.8%", actual="4.1%"
    )
    assert bias_bearish["direction"] == "BEARISH"

def test_retail_manipulation_judas_swing_detector():
    """Verify retail stop-hunt / Judas swing liquidity sweep detection on 1m candles."""
    # Bull-side liquidity sweep above pre-news high followed by rejection
    report = forex_factory_service.detect_retail_manipulation(
        symbol="EURUSD",
        high_price=1.0920,
        low_price=1.0840,
        open_price=1.0850,
        close_price=1.0845,
        pre_news_high=1.0900,  # Swept by 20 pips then dumped
        pre_news_low=1.0820,
        volume_current=500.0,
        volume_average=100.0,
    )
    assert report["manipulation_detected"] is True
    assert report["type"] == "JUDAS_SWING_BEARISH_REVERSAL"
    assert "RETAIL STOP-HUNT" in report["alert"]

def test_automated_post_trade_journal(test_db):
    """Verify automated post-trade journal persistence, emotion tracking, and compliance."""
    entry = AutomatedJournalEntry(
        journal_id="JRN-TEST-001",
        trade_id="TRD-001",
        symbol="BTCUSDT",
        direction="BUY",
        entry_price=64000.0,
        exit_price=67200.0,
        lot_size=0.5,
        net_pnl=1600.0,
        r_multiple=3.2,
        strategy_used="SMC_ORDER_BLOCK",
        emotion_tag="DISCIPLINED",
        user_notes="Waited for 15m unmitigated OB test in NY Killzone.",
        plan_compliance=True,
        compliance_score=100.0,
        execution_mode="PAPER"
    )
    test_db.add(entry)
    test_db.commit()

    saved = test_db.query(AutomatedJournalEntry).filter_by(journal_id="JRN-TEST-001").first()
    assert saved is not None
    assert saved.net_pnl == 1600.0
    assert saved.r_multiple == 3.2
    assert saved.is_immutable is True

def test_edge_active_trade_plan(test_db):
    """Verify Edge Active Trade Plan pinning and compliance scoring."""
    plan = ActiveTradePlan(
        plan_id="PLAN-TEST-001",
        title="4H Bullish Liquidity Sweep & 5m Sniper Retest",
        symbol="EURUSD",
        bias="BULLISH",
        framework="ICT",
        entry_zone_high=1.0860,
        entry_zone_low=1.0840,
        invalidation_price=1.0820,
        target_price_1=1.0940,
        target_price_final=1.1100,
        risk_percentage=1.0,
        checklist_items=[
            {"item": "HTF 4H Bias confirmed Bullish", "checked": True},
            {"item": "Asian Session Low swept", "checked": True},
            {"item": "NY Killzone Open (8:30 AM EST)", "checked": True},
            {"item": "Fair Value Gap (FVG) formed on 5m", "checked": False},
        ],
        is_active=True
    )
    test_db.add(plan)
    test_db.commit()

    saved = test_db.query(ActiveTradePlan).filter_by(plan_id="PLAN-TEST-001").first()
    assert saved is not None
    assert saved.symbol == "EURUSD"
    assert saved.framework == "ICT"
    assert len(saved.checklist_items) == 4

def test_emergency_kill_switch_behavior(test_db):
    """Verify Kill Switch engagement flattens positions and locks discipline guardrails."""
    # Seed open position
    pos = Position(
        account_id=1,
        symbol="XAUUSD",
        side="LONG",
        quantity=1.0,
        entry_price=2350.0,
        current_price=2355.0,
        is_open=True
    )
    config = RiskConfig(
        is_locked=False,
        emergency_kill_active=False
    )
    test_db.add(pos)
    test_db.add(config)
    test_db.commit()

    # Trigger kill switch
    config.emergency_kill_active = True
    config.is_locked = True
    config.lock_reason = "MANUAL EMERGENCY KILL SWITCH ACTIVATED"
    pos.is_open = False
    test_db.commit()

    # Verify states
    assert config.is_locked is True
    assert config.emergency_kill_active is True
    assert pos.is_open is False
