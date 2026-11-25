from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.database import get_db
from backend.config import settings

router = APIRouter(prefix="/system", tags=["System Health & Diagnostics"])

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Backend and database health diagnostic endpoint."""
    db_status = "operational"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "operational" else "degraded",
        "service": settings.PROJECT_NAME,
        "database": db_status,
        "live_trading_enabled": settings.LIVE_TRADING_ENABLED,
        "timestamp": datetime.utcnow().isoformat()
    }

@router.get("/config")
async def get_system_config():
    """Retrieve non-sensitive platform configurations."""
    return {
        "project_name": settings.PROJECT_NAME,
        "live_trading_enabled": settings.LIVE_TRADING_ENABLED,
        "gemini_api_configured": bool(settings.GEMINI_API_KEY),
        "default_initial_capital": settings.DEFAULT_INITIAL_CAPITAL,
        "default_slippage_bps": settings.DEFAULT_SLIPPAGE_BPS,
        "default_taker_fee_bps": settings.DEFAULT_TAKER_FEE_BPS
    }
