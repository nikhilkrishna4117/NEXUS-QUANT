from fastapi import APIRouter, Query, Body
from typing import Optional, List, Dict, Any
from backend.services.forex_factory_service import forex_factory_service

router = APIRouter(prefix="/news", tags=["Economic News & Manipulation"])

@router.get("/calendar")
def get_economic_calendar(force_refresh: bool = False):
    """Fetches real-time Forex Factory economic calendar events."""
    events = forex_factory_service.fetch_live_calendar(force_refresh=force_refresh)
    return {
        "status": "success",
        "count": len(events),
        "events": events
    }

@router.get("/pre_triggers")
def get_five_hour_pre_triggers():
    """
    Returns active 5-Hour Pre-News Triggers for High-Impact macro events.
    Includes live second countdowns, expected volatility, and trade blocking status.
    """
    triggers = forex_factory_service.get_five_hour_pre_triggers()
    return {
        "status": "success",
        "active_trigger_count": len(triggers),
        "triggers": triggers,
        "is_any_lockout_active": any(t["is_lockout_recommended"] for t in triggers)
    }

@router.post("/check_manipulation")
def check_retail_manipulation(
    symbol: str = Body(..., embed=True),
    high_price: float = Body(..., embed=True),
    low_price: float = Body(..., embed=True),
    open_price: float = Body(..., embed=True),
    close_price: float = Body(..., embed=True),
    pre_news_high: float = Body(..., embed=True),
    pre_news_low: float = Body(..., embed=True),
    volume_current: float = Body(100.0, embed=True),
    volume_average: float = Body(35.0, embed=True),
):
    """
    Evaluates 1m candle metrics for Retail Stop-Hunt & Judas Swing Liquidity Sweeps
    around pre-news highs and lows.
    """
    result = forex_factory_service.detect_retail_manipulation(
        symbol=symbol,
        high_price=high_price,
        low_price=low_price,
        open_price=open_price,
        close_price=close_price,
        pre_news_high=pre_news_high,
        pre_news_low=pre_news_low,
        volume_current=volume_current,
        volume_average=volume_average
    )
    return {
        "status": "success",
        "symbol": symbol,
        "manipulation_report": result
    }
