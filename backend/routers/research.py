from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List
from pydantic import BaseModel

from backend.database import get_db
from backend.services.investment_research_service import investment_research_service

router = APIRouter(prefix="/research", tags=["Investment Research"])

class WatchlistAddRequest(BaseModel):
    symbol: str
    name: str
    asset_class: str = "crypto"
    target_entry_price: float = None
    target_exit_price: float = None
    notes: str = ""

@router.get("/reports")
async def get_all_reports(db: Session = Depends(get_db)):
    """Retrieve comprehensive institutional investment dossiers with verifiable sources."""
    return investment_research_service.get_all_reports(db)

@router.get("/watchlist")
async def get_watchlist(db: Session = Depends(get_db)):
    """Retrieve all assets currently tracked on investment watchlist."""
    return investment_research_service.get_watchlist(db)

@router.post("/watchlist")
async def add_watchlist_item(payload: WatchlistAddRequest, db: Session = Depends(get_db)):
    """Add a new instrument to investment research watchlist."""
    return investment_research_service.add_to_watchlist(payload.dict(), db)
