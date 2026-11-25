import logging
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

class HighRRTradeManager:
    """
    High-R:R Active Trade & Trailing Stop Manager.
    Enforces institutional milestone scaling:
    - Milestone 1 (1:3 R:R): Automatically scales out 50% partial profit and moves SL to Breakeven (0 risk).
    - Milestone 2 (1:5 R:R): Scales out an additional 25% partial profit, locks in gains.
    - Milestone 3 (1:10 to 1:30 R:R): Trails the remaining 25% runner behind LTF swing structure to capture macro liquidity.
    """

    @classmethod
    def evaluate_position_milestones(
        cls,
        side: str,              # LONG / SHORT
        entry_price: float,
        current_price: float,
        initial_sl: float,
        current_sl: float,
        remaining_qty: float,
        state: Dict[str, Any]   # tracks tp1_hit, tp2_hit, be_moved
    ) -> Dict[str, Any]:
        """
        Evaluates current floating price relative to 1:3, 1:5, and 1:10-1:30 milestones.
        Returns trade management adjustments to execute.
        """
        risk_dist = abs(entry_price - initial_sl)
        if risk_dist <= 0:
            return {"action": "HOLD"}

        is_long = side.upper() in ["LONG", "BUY"]

        # Calculate current floating R-Multiple
        if is_long:
            floating_pnl_pts = current_price - entry_price
        else:
            floating_pnl_pts = entry_price - current_price

        current_r = floating_pnl_pts / risk_dist

        tp1_hit = state.get("tp1_hit", False)
        tp2_hit = state.get("tp2_hit", False)
        tp3_hit = state.get("tp3_hit", False)
        be_moved = state.get("be_moved", False)

        actions = []

        # 1. Milestone 1 (1:3 R:R Hit): Take 50% partial & Move SL to Breakeven
        if current_r >= 3.0 and not tp1_hit:
            scale_qty = round(remaining_qty * 0.5, 4)
            breakeven_sl = entry_price * (1.0005 if is_long else 0.9995) # Entry + fee buffer
            actions.append({
                "type": "SCALE_PARTIAL_AND_BREAKEVEN",
                "milestone": "1:3_RR_ACHIEVED",
                "scale_out_qty": scale_qty,
                "new_stop_loss": round(breakeven_sl, 2),
                "message": f"Milestone 1 Hit (+3.0R): Scaled out 50% ({scale_qty} lots). Stop Loss moved to Breakeven (${breakeven_sl:.2f}). Trade is now RISK-FREE."
            })
            state["tp1_hit"] = True
            state["be_moved"] = True

        # 2. Milestone 2 (1:5 R:R Hit): Take 25% partial & Trail SL into profit (+2.0R locked)
        elif current_r >= 5.0 and not tp2_hit:
            scale_qty = round(remaining_qty * 0.5, 4) # half of the remaining 50% = 25% of original
            trail_sl = entry_price + (risk_dist * 2.0 if is_long else -risk_dist * 2.0)
            actions.append({
                "type": "SCALE_PARTIAL_AND_TRAIL",
                "milestone": "1:5_RR_ACHIEVED",
                "scale_out_qty": scale_qty,
                "new_stop_loss": round(trail_sl, 2),
                "message": f"Milestone 2 Hit (+5.0R): Scaled out 25% ({scale_qty} lots). Trailing SL advanced to +2.0R (${trail_sl:.2f})."
            })
            state["tp2_hit"] = True

        # 3. Milestone 3 (1:10+ R:R Hit): Macro Liquidity Runner Target
        elif current_r >= 10.0 and not tp3_hit:
            trail_sl = entry_price + (risk_dist * 7.0 if is_long else -risk_dist * 7.0)
            actions.append({
                "type": "RUNNER_PROFIT_LOCK",
                "milestone": "1:10_RR_ACHIEVED",
                "scale_out_qty": 0.0, # hold remaining runner
                "new_stop_loss": round(trail_sl, 2),
                "message": f"Milestone 3 Hit (+10.0R!): Trailing SL ratcheted to +7.0R (${trail_sl:.2f}) to hold for 1:20 - 1:30 HTF expansion."
            })
            state["tp3_hit"] = True

        return {
            "current_r_multiple": round(current_r, 2),
            "actions": actions,
            "state": state
        }

trade_manager = HighRRTradeManager()
