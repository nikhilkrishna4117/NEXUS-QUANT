from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend.models.market_data import Instrument, ProviderStatus
from backend.services.market_data_service import market_data_service

router = APIRouter(prefix="/market", tags=["Market Data"])

@router.get("/instruments")
async def get_instruments(db: Session = Depends(get_db)):
    """Retrieve all verified tradeable instruments."""
    instruments = db.query(Instrument).filter(Instrument.is_active == True).all()
    return instruments

@router.get("/ticker/{symbol}")
async def get_ticker(symbol: str):
    """Retrieve 24hr price ticker and statistics."""
    ticker = await market_data_service.get_ticker_24h(symbol)
    return ticker

@router.get("/candles/{symbol}")
async def get_candles(
    symbol: str,
    timeframe: str = Query("1h", pattern="^(1m|5m|15m|30m|1h|4h|1d)$"),
    limit: int = Query(300, ge=20, le=1000),
    db: Session = Depends(get_db)
):
    """Fetch genuine historical OHLCV candles."""
    candles = await market_data_service.fetch_historical_candles(
        symbol=symbol,
        timeframe=timeframe,
        limit=limit,
        db=db
    )
    return {
        "symbol": symbol,
        "timeframe": timeframe,
        "count": len(candles),
        "candles": candles
    }

@router.get("/providers")
async def get_provider_statuses(db: Session = Depends(get_db)):
    """Retrieve market data provider connection statuses and latencies."""
    statuses = db.query(ProviderStatus).all()
    return statuses
