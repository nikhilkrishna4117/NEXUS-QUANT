from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid

from backend.database import get_db
from backend.models.journal import AutomatedJournalEntry

router = APIRouter(prefix="/journal", tags=["Automated Post-Trade Journal"])

@router.get("/entries")
def get_journal_entries(
    symbol: Optional[str] = Query(None),
    emotion: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieves immutable post-trade journal entries with behavioral tags."""
    query = db.query(AutomatedJournalEntry)
    if symbol:
        query = query.filter(AutomatedJournalEntry.symbol == symbol)
    if emotion:
        query = query.filter(AutomatedJournalEntry.emotion_tag == emotion.upper())
    
    entries = query.order_by(AutomatedJournalEntry.closed_at.desc()).limit(limit).all()
    return {
        "status": "success",
        "total": len(entries),
        "entries": [
            {
                "journal_id": e.journal_id,
                "trade_id": e.trade_id,
                "symbol": e.symbol,
                "asset_class": e.asset_class,
                "direction": e.direction,
                "entry_price": e.entry_price,
                "exit_price": e.exit_price,
                "lot_size": e.lot_size,
                "net_pnl": e.net_pnl,
                "r_multiple": e.r_multiple,
                "strategy_used": e.strategy_used,
                "emotion_tag": e.emotion_tag,
                "user_notes": e.user_notes,
                "voice_reflection": e.voice_reflection,
                "plan_compliance": e.plan_compliance,
                "compliance_score": e.compliance_score,
                "execution_mode": e.execution_mode,
                "closed_at": e.closed_at.isoformat() if e.closed_at else None,
            }
            for e in entries
        ]
    }

@router.post("/entries")
def create_or_update_journal_entry(
    trade_id: str = Body(...),
    symbol: str = Body(...),
    direction: str = Body(...),
    entry_price: float = Body(...),
    exit_price: float = Body(...),
    lot_size: float = Body(...),
    net_pnl: float = Body(...),
    r_multiple: float = Body(0.0),
    strategy_used: str = Body("MANUAL"),
    emotion_tag: str = Body("DISCIPLINED"),
    user_notes: Optional[str] = Body(None),
    voice_reflection: Optional[str] = Body(None),
    plan_compliance: bool = Body(True),
    compliance_score: float = Body(100.0),
    execution_mode: str = Body("PAPER"),
    db: Session = Depends(get_db)
):
    """Creates a new post-trade journal entry. Storage is protected from automated deletion."""
    entry = AutomatedJournalEntry(
        journal_id=f"JRN-{uuid.uuid4().hex[:12].upper()}",
        trade_id=trade_id,
        symbol=symbol.upper(),
        direction=direction.upper(),
        entry_price=entry_price,
        exit_price=exit_price,
        lot_size=lot_size,
        net_pnl=net_pnl,
        r_multiple=r_multiple,
        strategy_used=strategy_used,
        emotion_tag=emotion_tag.upper(),
        user_notes=user_notes,
        voice_reflection=voice_reflection,
        plan_compliance=plan_compliance,
        compliance_score=compliance_score,
        execution_mode=execution_mode.upper(),
        is_immutable=True
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {
        "status": "success",
        "journal_id": entry.journal_id,
        "message": "Trade logged to immutable journal successfully."
    }

@router.get("/stats")
def get_journal_stats(db: Session = Depends(get_db)):
    """Computes behavioral EdgeScore, emotion win rates, and plan compliance stats."""
    entries = db.query(AutomatedJournalEntry).all()
    if not entries:
        return {
            "total_trades": 0,
            "win_rate": 0.0,
            "average_r": 0.0,
            "plan_compliance_rate": 100.0,
            "edge_score": 85.0, # default seed
            "emotion_breakdown": {}
        }

    wins = sum(1 for e in entries if e.net_pnl > 0)
    total = len(entries)
    win_rate = (wins / total) * 100.0
    avg_r = sum(e.r_multiple for e in entries) / total
    compliant = sum(1 for e in entries if e.plan_compliance)
    compliance_rate = (compliant / total) * 100.0

    # Emotion breakdown
    emotion_map: Dict[str, Dict[str, Any]] = {}
    for e in entries:
        emo = e.emotion_tag or "NEUTRAL"
        if emo not in emotion_map:
            emotion_map[emo] = {"count": 0, "wins": 0, "net_pnl": 0.0}
        emotion_map[emo]["count"] += 1
        if e.net_pnl > 0:
            emotion_map[emo]["wins"] += 1
        emotion_map[emo]["net_pnl"] += e.net_pnl

    for emo, data in emotion_map.items():
        data["win_rate"] = round((data["wins"] / data["count"]) * 100.0, 1) if data["count"] > 0 else 0.0
        data["net_pnl"] = round(data["net_pnl"], 2)

    # EdgeScore calculation: combines win rate (30%), compliance (40%), and avg R (30%)
    edge_score = round(min(100.0, (win_rate * 0.3) + (compliance_rate * 0.4) + (max(0, avg_r) * 10.0)), 1)

    return {
        "total_trades": total,
        "win_rate": round(win_rate, 1),
        "average_r": round(avg_r, 2),
        "plan_compliance_rate": round(compliance_rate, 1),
        "edge_score": edge_score,
        "emotion_breakdown": emotion_map
    }
