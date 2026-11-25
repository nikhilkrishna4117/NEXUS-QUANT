from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.models.strategy import Strategy
from backend.services.strategy_engine import strategy_engine
from backend.services.technical_analysis import technical_analysis_engine
from backend.services.market_data_service import market_data_service

router = APIRouter(prefix="/strategies", tags=["Strategies & AI Lab"])

class StrategyCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "trend_following"
    symbol: str = "BTCUSDT"
    timeframe: str = "1h"
    config: Dict[str, Any]

@router.get("")
async def get_strategies(db: Session = Depends(get_db)):
    """List all configured baseline, user-created, and AI-generated strategies."""
    strategies = db.query(Strategy).all()
    return strategies

@router.post("")
async def create_strategy(payload: StrategyCreateRequest, db: Session = Depends(get_db)):
    """Save a custom strategy created through the Strategy Builder."""
    existing = db.query(Strategy).filter(Strategy.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="A strategy with this name already exists.")

    new_strat = Strategy(
        name=payload.name,
        description=payload.description,
        category=payload.category,
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        config=payload.config,
        is_active=False,
        is_ai_generated=False,
        evaluation_label="Unverified (Run Backtest)",
        evaluation_score=0.0
    )
    db.add(new_strat)
    db.commit()
    db.refresh(new_strat)
    return new_strat

@router.post("/ai-generate")
async def generate_ai_strategies(
    symbol: str = "BTCUSDT",
    timeframe: str = "1h",
    db: Session = Depends(get_db)
):
    """
    AI Strategy Lab: Analyze real market conditions and synthesize candidate
    quantitative strategies tailored to current volatility and structure.
    """
    candles = await market_data_service.fetch_historical_candles(symbol, timeframe, limit=150, db=db)
    indicators = technical_analysis_engine.calculate_indicators(candles)
    structure = technical_analysis_engine.identify_market_structure(candles)
    regime = technical_analysis_engine.classify_market_regime(indicators, structure)

    candidates = strategy_engine.generate_ai_candidate_strategies(
        market_regime=regime.get("regime", "Ranging"),
        volatility=regime.get("volatility_state", "Normal Volatility")
    )

    # Save candidates to database if not already present
    saved_candidates = []
    for cand in candidates:
        existing = db.query(Strategy).filter(Strategy.name == cand["name"]).first()
        if not existing:
            strat = Strategy(
                name=cand["name"],
                category=cand["category"],
                symbol=cand["symbol"],
                timeframe=cand["timeframe"],
                description=cand["description"],
                config=cand["config"],
                is_active=False,
                is_ai_generated=True,
                evaluation_label="Promising AI Candidate",
                evaluation_score=cand["confidence_score"]
            )
            db.add(strat)
            db.commit()
            db.refresh(strat)
            saved_candidates.append(strat)
        else:
            saved_candidates.append(existing)

    return {
        "market_regime": regime["regime"],
        "candidates": saved_candidates
    }

@router.patch("/{strategy_id}/toggle-active")
async def toggle_strategy_active(strategy_id: int, db: Session = Depends(get_db)):
    """Toggle strategy active state for paper trading runner."""
    strat = db.query(Strategy).filter(Strategy.id == strategy_id).first()
    if not strat:
        raise HTTPException(status_code=404, detail="Strategy not found.")
    strat.is_active = not strat.is_active
    db.commit()
    return {"id": strat.id, "name": strat.name, "is_active": strat.is_active}
