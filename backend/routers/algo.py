from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.services.high_rr_algo.algo_coordinator import algo_coordinator

router = APIRouter(prefix="/algo", tags=["High-R:R Autonomous Algo Engine"])

class BotToggleRequest(BaseModel):
    is_active: Optional[bool] = None

class ScanRequest(BaseModel):
    symbol: str = "BTCUSDT"

@router.get("/bots")
async def get_algo_bots():
    """Retrieve active status, framework, target R:R, and performance of all autonomous bots."""
    return {
        "status": "success",
        "bots": algo_coordinator.get_bots_status()
    }

@router.post("/bots/{bot_id}/toggle")
async def toggle_algo_bot(bot_id: str, payload: BotToggleRequest):
    """Enable or pause an autonomous algo bot."""
    try:
        updated = algo_coordinator.toggle_bot(bot_id, active=payload.is_active)
        return {"status": "success", "bot": updated}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/scan")
async def trigger_mtf_scan(payload: ScanRequest, db: Session = Depends(get_db)):
    """
    Triggers an immediate Multi-Timeframe scan on the requested symbol across
    Price Action, SMC, and ICT Silver Bullet frameworks.
    If a valid setup triggers and guardrails pass, executes immediately.
    """
    res = await algo_coordinator.scan_and_execute(symbol=payload.symbol, db=db)
    if not res:
        return {
            "status": "scanned",
            "message": f"Scanned {payload.symbol}. No high-confluence setup meeting strict institutional criteria at this candle bar.",
            "signal": None
        }
    return {
        "status": "triggered",
        "signal": res
    }

@router.get("/signals")
async def get_active_signals(limit: int = Query(20, ge=1, le=50)):
    """Retrieve queue of recent high-R:R signals with exact Entry, SL, TP1, TP2, TP3 coordinates."""
    return {
        "status": "success",
        "count": len(algo_coordinator.active_signals[:limit]),
        "signals": algo_coordinator.active_signals[:limit]
    }
