from fastapi import APIRouter, Depends, HTTPException
# pyrefly: ignore[missing-import]
from sqlalchemy.orm import Session  # type: ignore
from pydantic import BaseModel
from typing import Dict, Any, Optional

from backend.database import get_db
from backend.services.risk_engine import risk_engine
from backend.services.paper_trading_service import paper_trading_service
from backend.models.risk import RiskConfig

router = APIRouter(prefix="/risk", tags=["Risk Management Engine"])

class RiskConfigUpdateRequest(BaseModel):
    max_risk_per_trade_pct: Optional[float] = None
    max_portfolio_drawdown_pct: Optional[float] = None
    max_daily_loss_pct: Optional[float] = None
    max_open_positions: Optional[int] = None
    max_leverage: Optional[float] = None
    require_stop_loss: Optional[bool] = None
    min_risk_reward_ratio: Optional[float] = None

@router.get("/dashboard")
async def get_risk_dashboard(db: Session = Depends(get_db)):
    """Retrieve full risk metrics, current drawdown, exposure %, and recent audit logs."""
    account = paper_trading_service.get_or_create_account(db)
    return risk_engine.get_risk_dashboard_summary(account, db)

@router.get("/config")
async def get_risk_config(db: Session = Depends(get_db)):
    """Retrieve active risk configuration settings."""
    config = risk_engine.get_or_create_config(db)
    return config

@router.put("/config")
async def update_risk_config(payload: RiskConfigUpdateRequest, db: Session = Depends(get_db)):
    """Update risk limits and execution rules."""
    config = risk_engine.get_or_create_config(db)
    if payload.max_risk_per_trade_pct is not None:
        config.max_risk_per_trade_pct = payload.max_risk_per_trade_pct
    if payload.max_portfolio_drawdown_pct is not None:
        config.max_portfolio_drawdown_pct = payload.max_portfolio_drawdown_pct
    if payload.max_daily_loss_pct is not None:
        config.max_daily_loss_pct = payload.max_daily_loss_pct
    if payload.max_open_positions is not None:
        config.max_open_positions = payload.max_open_positions
    if payload.max_leverage is not None:
        config.max_leverage = payload.max_leverage
    if payload.require_stop_loss is not None:
        config.require_stop_loss = payload.require_stop_loss
    if payload.min_risk_reward_ratio is not None:
        config.min_risk_reward_ratio = payload.min_risk_reward_ratio

    db.commit()
    db.refresh(config)
    return config

@router.post("/kill-switch")
async def toggle_kill_switch(db: Session = Depends(get_db)):
    """
    Toggle emergency kill switch.
    When activated, immediately liquidates all open positions across active broker adapters
    and strictly halts all manual and autonomous algo order routing.
    """
    from backend.services.broker_adapters.execution_manager import execution_manager
    config = risk_engine.get_or_create_config(db)
    new_state = not config.kill_switch_active

    if new_state:
        # Emergency Kill Switch Activation: Liquidate all active positions
        res = execution_manager.emergency_kill_switch_flatten(db)
        return res
    else:
        config.kill_switch_active = False
        config.emergency_kill_active = False
        config.is_locked = False
        config.lock_reason = None
        db.commit()
        return {
            "kill_switch_active": False,
            "message": "Emergency Kill Switch deactivated. Trading resumed."
        }
