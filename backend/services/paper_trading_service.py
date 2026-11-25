import uuid
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.config import settings
from backend.models.trading import PaperAccount, Order, Position, Execution
from backend.services.risk_engine import risk_engine
from backend.services.market_data_service import market_data_service

logger = logging.getLogger(__name__)

class PaperTradingService:
    """
    Production-grade paper trading simulation engine with order routing,
    slippage and fee simulation, mark-to-market position tracking,
    and automatic SL/TP order triggers.
    """

    @staticmethod
    def get_or_create_account(db: Session, account_id: Optional[int] = None) -> PaperAccount:
        if account_id:
            acc = db.query(PaperAccount).filter(PaperAccount.id == account_id).first()
            if acc:
                return acc

        # Query currently active account
        account = db.query(PaperAccount).filter(PaperAccount.is_active == True).first()
        if not account:
            account = db.query(PaperAccount).first()
            if account:
                account.is_active = True
                db.commit()
                db.refresh(account)
                return account

        if not account:
            account = PaperAccount(
                account_number="ACC-PAPER-MASTER",
                name="Master Trading Account",
                account_type="STANDARD",
                initial_balance=settings.DEFAULT_INITIAL_CAPITAL,
                cash_balance=settings.DEFAULT_INITIAL_CAPITAL,
                realized_pnl=0.0,
                unrealized_pnl=0.0,
                margin_used=0.0,
                is_active=True,
                currency="USD"
            )
            db.add(account)
            db.commit()
            db.refresh(account)
        return account

    @classmethod
    def list_accounts(cls, db: Session) -> List[Dict[str, Any]]:
        cls.get_or_create_account(db)  # ensure at least 1 account exists
        accounts = db.query(PaperAccount).order_by(PaperAccount.id.asc()).all()
        results = []
        for acc in accounts:
            open_pos = db.query(Position).filter(Position.account_id == acc.id, Position.is_open == True).all()
            equity = acc.cash_balance + acc.margin_used + acc.unrealized_pnl
            total_pnl = acc.realized_pnl + acc.unrealized_pnl
            results.append({
                "id": acc.id,
                "account_number": acc.account_number,
                "name": acc.name or f"Demo Account #{acc.id}",
                "account_type": acc.account_type or "STANDARD",
                "initial_balance": acc.initial_balance,
                "cash_balance": round(acc.cash_balance, 2),
                "margin_used": round(acc.margin_used, 2),
                "realized_pnl": round(acc.realized_pnl, 2),
                "unrealized_pnl": round(acc.unrealized_pnl, 2),
                "equity": round(equity, 2),
                "total_pnl": round(total_pnl, 2),
                "currency": acc.currency or "USD",
                "is_active": bool(acc.is_active),
                "open_positions_count": len(open_pos),
                "created_at": acc.created_at.isoformat() if acc.created_at else None
            })
        return results

    @classmethod
    def create_account(
        cls,
        db: Session,
        name: str,
        initial_balance: float = 100000.0,
        account_type: str = "PROP_FIRM",
        currency: str = "USD",
        set_active: bool = True
    ) -> PaperAccount:
        random_suffix = str(uuid.uuid4())[:6].upper()
        type_prefix = "PROP" if "PROP" in account_type.upper() else "DEMO"
        account_number = f"ACC-{type_prefix}-{random_suffix}"

        if set_active:
            db.query(PaperAccount).update({"is_active": False})

        new_account = PaperAccount(
            account_number=account_number,
            name=name.strip() if name else f"{account_type.replace('_', ' ').title()} Account",
            account_type=account_type.upper(),
            initial_balance=initial_balance,
            cash_balance=initial_balance,
            realized_pnl=0.0,
            unrealized_pnl=0.0,
            margin_used=0.0,
            is_active=set_active,
            currency=currency
        )
        db.add(new_account)
        db.commit()
        db.refresh(new_account)
        return new_account

    @classmethod
    def switch_account(cls, account_id: int, db: Session) -> PaperAccount:
        target = db.query(PaperAccount).filter(PaperAccount.id == account_id).first()
        if not target:
            raise ValueError(f"Account with ID {account_id} not found.")
        db.query(PaperAccount).update({"is_active": False})
        target.is_active = True
        db.commit()
        db.refresh(target)
        return target

    @classmethod
    def reset_account(cls, db: Session, balance: float = 100000.0, account_id: Optional[int] = None) -> PaperAccount:
        """Reset paper account balance and wipe existing positions/orders for this account."""
        account = cls.get_or_create_account(db, account_id=account_id)
        account.initial_balance = balance
        account.cash_balance = balance
        account.realized_pnl = 0.0
        account.unrealized_pnl = 0.0
        account.margin_used = 0.0
        account.last_reset_at = datetime.utcnow()

        # Close all active positions for this specific account
        db.query(Position).filter(
            Position.account_id == account.id,
            Position.is_open == True
        ).update({
            "is_open": False,
            "closed_at": datetime.utcnow()
        })
        db.commit()
        db.refresh(account)
        return account

    @classmethod
    def delete_account(cls, account_id: int, db: Session) -> bool:
        """Delete an account if more than 1 account exists."""
        count = db.query(PaperAccount).count()
        if count <= 1:
            raise ValueError("Cannot delete the only remaining trading account.")
        acc = db.query(PaperAccount).filter(PaperAccount.id == account_id).first()
        if not acc:
            raise ValueError(f"Account ID {account_id} not found.")
        was_active = acc.is_active
        db.query(Position).filter(Position.account_id == account_id).delete()
        db.query(Order).filter(Order.account_id == account_id).delete()
        db.delete(acc)
        db.commit()
        if was_active:
            first_acc = db.query(PaperAccount).first()
            if first_acc:
                first_acc.is_active = True
                db.commit()
        return True

    @classmethod
    def place_order(
        cls,
        symbol: str,
        side: str,  # BUY or SELL
        quantity: float,
        price: float,
        order_type: str = "MARKET",
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        strategy_id: Optional[int] = None,
        db: Session = None
    ) -> Dict[str, Any]:
        """
        Validate proposed order through the risk engine and execute paper fill.
        """
        account = cls.get_or_create_account(db)

        # Pre-trade Risk Engine Audit
        passed, reason = risk_engine.validate_proposed_order(
            account=account,
            symbol=symbol,
            side=side,
            quantity=quantity,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            db=db
        )

        order_id = str(uuid.uuid4())[:18]

        if not passed:
            # Record rejected order
            rejected_order = Order(
                client_order_id=order_id,
                account_id=account.id,
                strategy_id=strategy_id,
                symbol=symbol,
                side=side,
                order_type=order_type,
                quantity=quantity,
                price=price,
                stop_price=stop_loss,
                take_profit_price=take_profit,
                status="REJECTED",
                reject_reason=reason
            )
            db.add(rejected_order)
            db.commit()
            return {
                "success": False,
                "order_id": order_id,
                "status": "REJECTED",
                "reason": reason
            }

        # 3. Apply realistic slippage & maker/taker fee
        slippage_rate = settings.DEFAULT_SLIPPAGE_BPS / 10000.0
        fee_rate = settings.DEFAULT_TAKER_FEE_BPS / 10000.0

        if side == "BUY":
            fill_price = price * (1.0 + slippage_rate)
        else:
            fill_price = price * (1.0 - slippage_rate)

        order_cost = fill_price * quantity
        fee = order_cost * fee_rate
        slippage_cost = abs(fill_price - price) * quantity

        # 4. Record Filled Order
        new_order = Order(
            client_order_id=order_id,
            account_id=account.id,
            strategy_id=strategy_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=fill_price,
            stop_price=stop_loss,
            take_profit_price=take_profit,
            status="FILLED"
        )
        db.add(new_order)
        db.flush()

        # 5. Record Execution
        exec_record = Execution(
            order_id=new_order.id,
            symbol=symbol,
            side=side,
            executed_price=round(fill_price, 2),
            quantity=round(quantity, 4),
            fee=round(fee, 2),
            slippage=round(slippage_cost, 2)
        )
        db.add(exec_record)

        # 6. Update Account Cash & Open Position
        if side == "BUY":
            account.cash_balance -= (order_cost + fee)
            account.margin_used += order_cost

            # Check if there's already an open position to merge or create new
            pos = Position(
                account_id=account.id,
                symbol=symbol,
                side="LONG",
                quantity=round(quantity, 4),
                entry_price=round(fill_price, 2),
                current_price=round(fill_price, 2),
                stop_loss=stop_loss,
                take_profit=take_profit,
                unrealized_pnl=0.0,
                unrealized_pnl_pct=0.0,
                margin_used=round(order_cost, 2),
                is_open=True,
                opened_at=datetime.utcnow()
            )
            db.add(pos)

        elif side == "SELL":
            # Check if closing an existing LONG position
            open_pos = db.query(Position).filter(
                Position.symbol == symbol,
                Position.is_open == True,
                Position.side == "LONG"
            ).first()

            if open_pos:
                close_qty = min(open_pos.quantity, quantity)
                gross_pnl = (fill_price - open_pos.entry_price) * close_qty
                net_pnl = gross_pnl - fee
                account.realized_pnl += net_pnl
                account.cash_balance += (fill_price * close_qty) - fee
                account.margin_used -= (open_pos.entry_price * close_qty)

                open_pos.quantity -= close_qty
                if open_pos.quantity <= 0.0001:
                    open_pos.is_open = False
                    open_pos.closed_at = datetime.utcnow()
            else:
                # Flat or short
                account.cash_balance += (order_cost - fee)

        db.commit()
        db.refresh(account)

        return {
            "success": True,
            "order_id": order_id,
            "status": "FILLED",
            "symbol": symbol,
            "side": side,
            "executed_price": round(fill_price, 2),
            "quantity": quantity,
            "fee": round(fee, 2),
            "slippage": round(slippage_cost, 2)
        }

    @classmethod
    async def update_positions_mark_to_market(cls, db: Session, account_id: Optional[int] = None):
        """
        Poll current prices for all open positions of active account, update unrealized P&L,
        and automatically trigger Stop-Loss or Take-Profit orders if breached.
        """
        account = cls.get_or_create_account(db, account_id=account_id)
        open_positions = db.query(Position).filter(
            Position.account_id == account.id,
            Position.is_open == True
        ).all()

        total_unrealized = 0.0

        for pos in open_positions:
            curr_price = await market_data_service.get_latest_price(pos.symbol, db=db)
            pos.current_price = curr_price

            if pos.side == "LONG":
                pnl = (curr_price - pos.entry_price) * pos.quantity
                pnl_pct = ((curr_price - pos.entry_price) / pos.entry_price) * 100.0

                # Check Stop-Loss Trigger
                if pos.stop_loss and curr_price <= pos.stop_loss:
                    logger.info(f"Stop loss triggered for position {pos.id} on {pos.symbol} at {curr_price}")
                    cls.close_position(pos.id, "STOP_LOSS_TRIGGERED", curr_price, db)
                    continue

                # Check Take-Profit Trigger
                if pos.take_profit and curr_price >= pos.take_profit:
                    logger.info(f"Take profit triggered for position {pos.id} on {pos.symbol} at {curr_price}")
                    cls.close_position(pos.id, "TAKE_PROFIT_TRIGGERED", curr_price, db)
                    continue

            else:  # SHORT
                pnl = (pos.entry_price - curr_price) * pos.quantity
                pnl_pct = ((pos.entry_price - curr_price) / pos.entry_price) * 100.0

            pos.unrealized_pnl = round(pnl, 2)
            pos.unrealized_pnl_pct = round(pnl_pct, 2)
            total_unrealized += pnl

        account.unrealized_pnl = round(total_unrealized, 2)
        db.commit()

    @classmethod
    def close_position(cls, position_id: int, reason: str, price: float, db: Session) -> Dict[str, Any]:
        """Close an open position at specified market price."""
        pos = db.query(Position).filter(Position.id == position_id, Position.is_open == True).first()
        if not pos:
            return {"success": False, "error": "Position not found or already closed."}

        account = cls.get_or_create_account(db, account_id=pos.account_id)
        curr_price = price
        fee = curr_price * pos.quantity * (settings.DEFAULT_TAKER_FEE_BPS / 10000.0)

        if pos.side == "LONG":
            gross_pnl = (curr_price - pos.entry_price) * pos.quantity
            net_pnl = gross_pnl - fee
            account.cash_balance += (curr_price * pos.quantity) - fee
            account.margin_used -= (pos.entry_price * pos.quantity)
        else:
            gross_pnl = (pos.entry_price - curr_price) * pos.quantity
            net_pnl = gross_pnl - fee
            account.cash_balance += gross_pnl - fee

        account.realized_pnl += net_pnl
        pos.is_open = False
        pos.closed_at = datetime.utcnow()
        pos.unrealized_pnl = 0.0

        # Record closing order & execution
        close_order = Order(
            client_order_id=str(uuid.uuid4())[:18],
            account_id=account.id,
            symbol=pos.symbol,
            side="SELL" if pos.side == "LONG" else "BUY",
            order_type="MARKET",
            quantity=pos.quantity,
            price=curr_price,
            status="FILLED",
            reject_reason=f"Closed via {reason}"
        )
        db.add(close_order)
        db.flush()

        exec_rec = Execution(
            order_id=close_order.id,
            symbol=pos.symbol,
            side="SELL" if pos.side == "LONG" else "BUY",
            executed_price=round(curr_price, 2),
            quantity=round(pos.quantity, 4),
            fee=round(fee, 2),
            slippage=0.0
        )
        db.add(exec_rec)
        db.commit()

        # Automated Post-Trade Journal Listener
        journal_id = None
        r_multiple = 0.0
        try:
            from backend.services.journal_listener import journal_listener
            journal_entry = journal_listener.record_closed_position(
                position=pos,
                closed_price=curr_price,
                net_pnl=net_pnl,
                reason=reason,
                db=db
            )
            journal_id = journal_entry.journal_id
            r_multiple = journal_entry.r_multiple
        except Exception as e:
            logger.warning(f"Failed to auto-journal closed position {pos.id}: {e}")

        return {
            "success": True,
            "position_id": position_id,
            "symbol": pos.symbol,
            "closed_price": curr_price,
            "realized_pnl": round(net_pnl, 2),
            "journal_id": journal_id,
            "r_multiple": r_multiple,
            "reason": reason
        }

    @classmethod
    def get_portfolio_summary(cls, db: Session, account_id: Optional[int] = None) -> Dict[str, Any]:
        """Aggregate full paper trading account, active positions, and recent orders."""
        account = cls.get_or_create_account(db, account_id=account_id)
        open_positions = db.query(Position).filter(
            Position.account_id == account.id,
            Position.is_open == True
        ).all()
        recent_orders = db.query(Order).filter(
            Order.account_id == account.id
        ).order_by(desc(Order.created_at)).limit(20).all()
        
        # Recent executions for this account's orders
        order_ids = [o.id for o in recent_orders]
        if order_ids:
            recent_executions = db.query(Execution).filter(
                Execution.order_id.in_(order_ids)
            ).order_by(desc(Execution.executed_at)).limit(20).all()
        else:
            recent_executions = []

        total_equity = account.cash_balance + account.margin_used + account.unrealized_pnl
        total_pnl = account.realized_pnl + account.unrealized_pnl
        total_return_pct = (total_pnl / account.initial_balance * 100.0) if account.initial_balance > 0 else 0.0

        return {
            "account_id": account.id,
            "account_number": account.account_number,
            "account_name": account.name or f"Demo Account #{account.id}",
            "account_type": account.account_type or "STANDARD",
            "is_active": bool(account.is_active),
            "initial_balance": account.initial_balance,
            "cash_balance": round(account.cash_balance, 2),
            "equity": round(total_equity, 2),
            "margin_used": round(account.margin_used, 2),
            "realized_pnl": round(account.realized_pnl, 2),
            "unrealized_pnl": round(account.unrealized_pnl, 2),
            "total_pnl": round(total_pnl, 2),
            "total_return_pct": round(total_return_pct, 2),
            "open_positions": [
                {
                    "id": p.id,
                    "symbol": p.symbol,
                    "side": p.side,
                    "quantity": p.quantity,
                    "entry_price": p.entry_price,
                    "current_price": p.current_price,
                    "stop_loss": p.stop_loss,
                    "take_profit": p.take_profit,
                    "unrealized_pnl": p.unrealized_pnl,
                    "unrealized_pnl_pct": p.unrealized_pnl_pct,
                    "opened_at": p.opened_at.isoformat()
                }
                for p in open_positions
            ],
            "recent_orders": [
                {
                    "id": o.id,
                    "client_order_id": o.client_order_id,
                    "symbol": o.symbol,
                    "side": o.side,
                    "order_type": o.order_type,
                    "quantity": o.quantity,
                    "price": o.price,
                    "status": o.status,
                    "reject_reason": o.reject_reason,
                    "created_at": o.created_at.isoformat()
                }
                for o in recent_orders
            ],
            "recent_executions": [
                {
                    "id": e.id,
                    "symbol": e.symbol,
                    "side": e.side,
                    "executed_price": e.executed_price,
                    "quantity": e.quantity,
                    "fee": e.fee,
                    "executed_at": e.executed_at.isoformat()
                }
                for e in recent_executions
            ]
        }

paper_trading_service = PaperTradingService()
