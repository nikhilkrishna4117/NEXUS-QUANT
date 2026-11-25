from fastapi import APIRouter, Depends, HTTPException
# pyrefly: ignore[missing-import]
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
from pydantic import BaseModel

from backend.database import get_db
from backend.services.paper_trading_service import paper_trading_service
from backend.services.market_data_service import market_data_service

router = APIRouter(prefix="/trading", tags=["Paper Trading & Execution"])

class OrderSubmitRequest(BaseModel):
    symbol: str = "BTCUSDT"
    side: str = "BUY"  # BUY or SELL
    quantity: float
    order_type: str = "MARKET"
    price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    strategy_id: Optional[int] = None

class AccountResetRequest(BaseModel):
    balance: float = 100000.0

class CreateAccountRequest(BaseModel):
    name: str = "Prop Firm Challenge"
    initial_balance: float = 100000.0
    account_type: str = "PROP_FIRM"  # PROP_FIRM, CHALLENGE, STANDARD, SCALPER, SWING
    currency: str = "USD"
    set_active: bool = True

@router.get("/accounts")
async def list_accounts(db: Session = Depends(get_db)):
    """List all demo / paper accounts with balances and status."""
    accounts = paper_trading_service.list_accounts(db)
    active_account = next((a for a in accounts if a["is_active"]), accounts[0] if accounts else None)
    return {
        "accounts": accounts,
        "active_account": active_account
    }

@router.post("/accounts")
async def create_account(payload: CreateAccountRequest, db: Session = Depends(get_db)):
    """Create a new demo / paper trading account."""
    if payload.initial_balance <= 0:
        raise HTTPException(status_code=400, detail="Initial balance must be positive.")
    new_acc = paper_trading_service.create_account(
        db=db,
        name=payload.name,
        initial_balance=payload.initial_balance,
        account_type=payload.account_type,
        currency=payload.currency,
        set_active=payload.set_active
    )
    return {
        "success": True,
        "account": {
            "id": new_acc.id,
            "account_number": new_acc.account_number,
            "name": new_acc.name,
            "account_type": new_acc.account_type,
            "initial_balance": new_acc.initial_balance,
            "cash_balance": new_acc.cash_balance,
            "is_active": new_acc.is_active
        }
    }

@router.post("/accounts/{account_id}/switch")
async def switch_account(account_id: int, db: Session = Depends(get_db)):
    """Switch active demo account."""
    try:
        active = paper_trading_service.switch_account(account_id, db)
        return {
            "success": True,
            "active_account_id": active.id,
            "account_number": active.account_number,
            "name": active.name
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/accounts/{account_id}/reset")
async def reset_specific_account(account_id: int, payload: AccountResetRequest, db: Session = Depends(get_db)):
    """Reset balance and close positions for a specific demo account."""
    try:
        acc = paper_trading_service.reset_account(db, balance=payload.balance, account_id=account_id)
        return {
            "success": True,
            "message": f"Account {acc.account_number} reset to ${payload.balance:,.2f}.",
            "account_id": acc.id,
            "cash_balance": acc.cash_balance
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/accounts/{account_id}")
async def delete_account(account_id: int, db: Session = Depends(get_db)):
    """Delete a demo account."""
    try:
        paper_trading_service.delete_account(account_id, db)
        return {"success": True, "message": f"Account {account_id} deleted."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/portfolio")
async def get_portfolio(db: Session = Depends(get_db)):
    """Retrieve full portfolio summary, open positions, and recent executions."""
    # First mark open positions to current market prices
    await paper_trading_service.update_positions_mark_to_market(db)
    return paper_trading_service.get_portfolio_summary(db)

@router.post("/order")
async def submit_paper_order(payload: OrderSubmitRequest, db: Session = Depends(get_db)):
    """
    Submit an order through the unified Execution Manager.
    The order is routed strictly through the Pre-Trade Risk Firewall before reaching
    the active broker adapter (Paper, CCXT, cTrader, or TradeLocker).
    """
    from backend.services.broker_adapters.execution_manager import execution_manager

    price = payload.price
    if not price or price <= 0:
        price = await market_data_service.get_latest_price(payload.symbol, db=db)

    result = execution_manager.route_order(
        symbol=payload.symbol,
        side=payload.side,
        quantity=payload.quantity,
        price=price,
        order_type=payload.order_type,
        stop_loss=payload.stop_loss,
        take_profit=payload.take_profit,
        strategy_id=payload.strategy_id,
        db=db
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("reason", "Order rejected by risk engine firewall."))
    return result

@router.post("/positions/{position_id}/close")
async def close_position(position_id: int, db: Session = Depends(get_db)):
    """Close an open paper position at current market price."""
    from backend.models.trading import Position
    pos = db.query(Position).filter(Position.id == position_id).first()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found.")
    curr_price = await market_data_service.get_latest_price(pos.symbol, db=db)
    result = paper_trading_service.close_position(position_id, "MANUAL_CLOSE", curr_price, db)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to close position."))
    return result

@router.post("/reset")
async def reset_account(payload: AccountResetRequest, db: Session = Depends(get_db)):
    """Reset paper account balance and liquidate active positions."""
    account = paper_trading_service.reset_account(db, balance=payload.balance)
    return {
        "success": True,
        "message": f"Paper account reset to ${payload.balance:,.2f}.",
        "cash_balance": account.cash_balance
    }
