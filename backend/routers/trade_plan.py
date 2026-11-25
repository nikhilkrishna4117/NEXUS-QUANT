from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any
import uuid

from backend.database import get_db
from backend.models.trade_plan import ActiveTradePlan

router = APIRouter(prefix="/trade_plan", tags=["Edge Active Trade Plan"])

@router.get("/active")
def get_active_plan(symbol: str = Query("BTCUSDT"), db: Session = Depends(get_db)):
    """Retrieves the active pinned trade plan for a given asset."""
    plan = db.query(ActiveTradePlan).filter(
        ActiveTradePlan.symbol == symbol.upper(),
        ActiveTradePlan.is_active == True
    ).first()

    if not plan:
        # Default institutional plan template if none pinned
        return {
            "status": "not_found",
            "plan": None,
            "message": f"No active plan pinned for {symbol.upper()}. Use POST to create one."
        }

    return {
        "status": "success",
        "plan": {
            "plan_id": plan.plan_id,
            "title": plan.title,
            "symbol": plan.symbol,
            "bias": plan.bias,
            "framework": plan.framework,
            "timeframe_bias": plan.timeframe_bias,
            "timeframe_entry": plan.timeframe_entry,
            "entry_zone_high": plan.entry_zone_high,
            "entry_zone_low": plan.entry_zone_low,
            "invalidation_price": plan.invalidation_price,
            "target_price_1": plan.target_price_1,
            "target_price_final": plan.target_price_final,
            "risk_percentage": plan.risk_percentage,
            "checklist_items": plan.checklist_items,
            "status": plan.status,
            "compliance_score": plan.compliance_score,
            "notes": plan.notes
        }
    }

@router.post("/create")
def create_trade_plan(
    symbol: str = Body(...),
    title: str = Body(...),
    bias: str = Body(...),
    framework: str = Body("SMC"),
    entry_zone_high: float = Body(...),
    entry_zone_low: float = Body(...),
    invalidation_price: float = Body(...),
    target_price_1: float = Body(...),
    target_price_final: float = Body(...),
    risk_percentage: float = Body(1.0),
    checklist_items: List[Dict[str, Any]] = Body(...),
    notes: Optional[str] = Body(None),
    db: Session = Depends(get_db)
):
    """Creates a new Trade Plan and sets it as the active pinned plan for the symbol."""
    # Deactivate existing plans for this symbol
    db.query(ActiveTradePlan).filter(ActiveTradePlan.symbol == symbol.upper()).update({"is_active": False})

    plan = ActiveTradePlan(
        plan_id=f"PLAN-{uuid.uuid4().hex[:10].upper()}",
        title=title,
        symbol=symbol.upper(),
        bias=bias.upper(),
        framework=framework.upper(),
        entry_zone_high=entry_zone_high,
        entry_zone_low=entry_zone_low,
        invalidation_price=invalidation_price,
        target_price_1=target_price_1,
        target_price_final=target_price_final,
        risk_percentage=risk_percentage,
        checklist_items=checklist_items,
        notes=notes,
        is_active=True,
        status="WAITING_FOR_TRIGGER"
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return {
        "status": "success",
        "plan_id": plan.plan_id,
        "message": f"Active Trade Plan '{title}' pinned for {symbol.upper()}."
    }

@router.put("/{plan_id}/checklist")
def update_checklist(
    plan_id: str,
    checklist_items: List[Dict[str, Any]] = Body(...),
    db: Session = Depends(get_db)
):
    """Updates checklist completion state and calculates compliance score."""
    plan = db.query(ActiveTradePlan).filter(ActiveTradePlan.plan_id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Trade plan not found")

    total = len(checklist_items)
    checked = sum(1 for item in checklist_items if item.get("checked", False))
    compliance = (checked / total) * 100.0 if total > 0 else 100.0

    plan.checklist_items = checklist_items
    plan.compliance_score = round(compliance, 1)
    db.commit()

    return {
        "status": "success",
        "plan_id": plan_id,
        "compliance_score": plan.compliance_score
    }
