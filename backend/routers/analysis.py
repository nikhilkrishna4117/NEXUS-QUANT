from fastapi import APIRouter, Depends, Query, HTTPException
# pyrefly: ignore[missing-import]
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.services.market_data_service import market_data_service
from backend.services.technical_analysis import technical_analysis_engine

router = APIRouter(prefix="/analysis", tags=["Market Analysis"])

@router.get("/{symbol}")
async def analyze_market(
    symbol: str,
    timeframe: str = Query("1h", pattern="^(1m|5m|15m|30m|1h|4h|1d)$"),
    limit: int = Query(250, ge=30, le=500),
    db: Session = Depends(get_db)
):
    """
    Run full quantitative analysis on genuine market data:
    - Technical Indicators (RSI, MACD, EMA, BB, ATR, ADX, VWAP, Stochastic)
    - Market Structure (HH/HL, Swings, BOS, Support/Resistance)
    - Chart & Candlestick Patterns
    - Market Condition & Regime Classification with Plain-English Rationale
    """
    candles = await market_data_service.fetch_historical_candles(
        symbol=symbol,
        timeframe=timeframe,
        limit=limit,
        db=db
    )
    if not candles:
        raise HTTPException(status_code=404, detail="No market data available for analysis.")

    # 1. Technical Indicators
    indicators = technical_analysis_engine.calculate_indicators(candles)

    # 2. Market Structure Recognition
    structure = technical_analysis_engine.identify_market_structure(candles)

    # 3. Chart Patterns
    patterns = technical_analysis_engine.detect_chart_patterns(candles)

    # 4. Market Regime Classification
    regime = technical_analysis_engine.classify_market_regime(indicators, structure)

    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "last_updated": candles[-1]["timestamp"].isoformat() if hasattr(candles[-1]["timestamp"], "isoformat") else str(candles[-1]["timestamp"]),
        "current_price": indicators.get("current_price"),
        "regime": regime,
        "structure": structure,
        "patterns": patterns,
        "indicators": indicators
    }
