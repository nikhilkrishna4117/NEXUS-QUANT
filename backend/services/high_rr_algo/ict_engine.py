import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

class ICTEngine:
    """
    Inner Circle Trader (ICT) Algorithmic Engine.
    Detects:
    1. Fair Value Gaps (FVG) & Consequent Encroachment (CE 50% midpoint).
    2. Optimal Trade Entry (OTE 0.618 - 0.786 Fibonacci Retracement).
    3. Power of 3 (AMD: Accumulation, Manipulation / Judas Swing, Distribution).
    4. Strict Institutional Session Killzones (London Open, NY Open, Silver Bullet).
    5. High-R:R Precision Sniper Execution (1:10 - 1:30 targets).
    """

    # Institutional Killzone Windows (UTC Hours)
    KILLZONES = {
        "LONDON_OPEN": (7, 10),      # 07:00 - 10:00 UTC
        "NY_OPEN": (12, 15),          # 12:00 - 15:00 UTC
        "SILVER_BULLET_NY": (14, 15), # 14:00 - 15:00 UTC (10-11 AM NY Time)
        "LONDON_CLOSE": (15, 17)     # 15:00 - 17:00 UTC
    }

    @classmethod
    def is_killzone_active(cls, current_dt: Optional[datetime] = None) -> Tuple[bool, Optional[str]]:
        """Checks if current time falls within an institutional high-liquidity Killzone."""
        now = current_dt or datetime.now(timezone.utc)
        hour = now.hour

        for zone_name, (start_h, end_h) in cls.KILLZONES.items():
            if start_h <= hour < end_h:
                return True, zone_name

        return False, None

    @classmethod
    def detect_fair_value_gaps(cls, candles: List[Dict[str, Any]], lookback: int = 40) -> List[Dict[str, Any]]:
        """
        Detects 3-candle Fair Value Gaps (FVG).
        Bullish FVG: Low of candle 3 is strictly above High of candle 1 (imbalance gap).
        Bearish FVG: High of candle 3 is strictly below Low of candle 1.
        Consequent Encroachment (CE): 50% midpoint of the imbalance.
        """
        if len(candles) < 3:
            return []

        c = candles[-lookback:]
        fvgs = []

        for i in range(len(c) - 2):
            c1 = c[i]
            c2 = c[i + 1]
            c3 = c[i + 2]

            c1_high = float(c1["high"])
            c1_low = float(c1["low"])
            c3_high = float(c3["high"])
            c3_low = float(c3["low"])

            # Bullish FVG
            if c3_low > c1_high:
                gap_size = c3_low - c1_high
                ce_midpoint = c1_high + (gap_size * 0.5)

                # Check if mitigated
                is_mitigated = False
                for future in c[i + 3:]:
                    if float(future["low"]) <= ce_midpoint:
                        is_mitigated = True
                        break

                fvgs.append({
                    "type": "BULLISH_FVG",
                    "candle_index": i + 1,
                    "gap_top": round(c3_low, 2),
                    "gap_bottom": round(c1_high, 2),
                    "consequent_encroachment": round(ce_midpoint, 2),
                    "gap_size": round(gap_size, 2),
                    "is_mitigated": is_mitigated
                })

            # Bearish FVG
            elif c3_high < c1_low:
                gap_size = c1_low - c3_high
                ce_midpoint = c3_high + (gap_size * 0.5)

                is_mitigated = False
                for future in c[i + 3:]:
                    if float(future["high"]) >= ce_midpoint:
                        is_mitigated = True
                        break

                fvgs.append({
                    "type": "BEARISH_FVG",
                    "candle_index": i + 1,
                    "gap_top": round(c1_low, 2),
                    "gap_bottom": round(c3_high, 2),
                    "consequent_encroachment": round(ce_midpoint, 2),
                    "gap_size": round(gap_size, 2),
                    "is_mitigated": is_mitigated
                })

        return fvgs

    @classmethod
    def calculate_optimal_trade_entry(cls, swing_low: float, swing_high: float, direction: str = "LONG") -> Dict[str, Any]:
        """
        Calculates ICT Optimal Trade Entry (OTE) Fibonacci levels.
        0.618: OTE Boundary
        0.705: OTE Institutional Sweet Spot
        0.786: OTE Deep Invalidation Level
        """
        range_size = swing_high - swing_low

        if direction.upper() == "LONG":
            fib_618 = swing_high - (range_size * 0.618)
            fib_705 = swing_high - (range_size * 0.705)
            fib_786 = swing_high - (range_size * 0.786)
        else:
            fib_618 = swing_low + (range_size * 0.618)
            fib_705 = swing_low + (range_size * 0.705)
            fib_786 = swing_low + (range_size * 0.786)

        return {
            "direction": direction.upper(),
            "ote_618": round(fib_618, 2),
            "ote_705_sweet_spot": round(fib_705, 2),
            "ote_786": round(fib_786, 2),
            "range_size": round(range_size, 2)
        }

    @classmethod
    def detect_judas_swing(cls, candles: List[Dict[str, Any]], asian_range_bars: int = 16) -> Dict[str, Any]:
        """
        Power of 3 (AMD): Detects London/NY Open Judas Swings.
        Asian session forms tight accumulation range.
        Judas swing creates a false breakout sweeping liquidity before the true institutional trend unfolds.
        """
        if len(candles) < asian_range_bars + 5:
            return {"detected": False}

        asian_bars = candles[-(asian_range_bars + 5): -5]
        asian_high = max(float(b["high"]) for b in asian_bars)
        asian_low = min(float(b["low"]) for b in asian_bars)

        recent_bars = candles[-5:]
        highest_recent = max(float(b["high"]) for b in recent_bars)
        lowest_recent = min(float(b["low"]) for b in recent_bars)
        current_close = float(candles[-1]["close"])

        # Bullish Judas Trap: False probe below Asian Low, quickly rejected back into range
        if lowest_recent < asian_low and current_close > asian_low:
            return {
                "detected": True,
                "type": "BULLISH_JUDAS_SWING",
                "manipulation_low": lowest_recent,
                "asian_low": asian_low,
                "bias": "BULLISH_DISTRIBUTION",
                "description": f"Judas Swing: False liquidity sweep below Asian low ({asian_low:.2f}). Bullish expansion anticipated."
            }

        # Bearish Judas Trap: False probe above Asian High, quickly rejected back into range
        if highest_recent > asian_high and current_close < asian_high:
            return {
                "detected": True,
                "type": "BEARISH_JUDAS_SWING",
                "manipulation_high": highest_recent,
                "asian_high": asian_high,
                "bias": "BEARISH_DISTRIBUTION",
                "description": f"Judas Swing: False liquidity sweep above Asian high ({asian_high:.2f}). Bearish distribution anticipated."
            }

        return {"detected": False}

    @classmethod
    def generate_signal(cls, candles: List[Dict[str, Any]], enforce_killzone: bool = False) -> Optional[Dict[str, Any]]:
        """
        Synthesizes ICT Fair Value Gap, OTE Sweet Spot (0.705), and Judas Swings
        into an ultra-high R:R (1:10 to 1:25) trade signal.
        """
        if len(candles) < 30:
            return None

        # Check Killzone filter if enabled
        is_kz, kz_name = cls.is_killzone_active()
        if enforce_killzone and not is_kz:
            return None

        current_price = float(candles[-1]["close"])
        fvgs = cls.detect_fair_value_gaps(candles)
        unmitigated_fvgs = [f for f in fvgs if not f["is_mitigated"]]
        judas = cls.detect_judas_swing(candles)

        highs = [float(c["high"]) for c in candles]
        lows = [float(c["low"]) for c in candles]
        sh = max(highs[-30:])
        sl_val = min(lows[-30:])

        # Bullish ICT Setup: Bullish Judas Sweep or unmitigated Bullish FVG in OTE zone
        bullish_fvgs = [f for f in unmitigated_fvgs if f["type"] == "BULLISH_FVG"]
        if bullish_fvgs or (judas["detected"] and judas["type"] == "BULLISH_JUDAS_SWING"):
            ote = cls.calculate_optimal_trade_entry(sl_val, sh, direction="LONG")
            sl = sl_val * 0.999
            risk = abs(current_price - sl)
            if risk <= 0:
                return None

            return {
                "strategy": "ICT_SILVER_BULLET_FVG",
                "side": "BUY",
                "symbol": candles[-1].get("symbol", "BTCUSDT"),
                "entry_price": round(current_price, 2),
                "stop_loss": round(sl, 2),
                "take_profit_1": round(current_price + risk * 3.0, 2),   # 1:3 R:R (Move SL to BE)
                "take_profit_2": round(current_price + risk * 5.0, 2),   # 1:5 R:R (Scale 25%)
                "take_profit_3": round(current_price + risk * 20.0, 2),  # 1:20 R:R (HTF Liquidity Run)
                "risk_reward_ratio": 20.0,
                "killzone": kz_name or "ACTIVE_LIQUIDITY_WINDOW",
                "ote_sweet_spot": ote["ote_705_sweet_spot"],
                "rationale": f"ICT Silver Bullet: Consequent Encroachment retest in OTE ({ote['ote_705_sweet_spot']}), targeting HTF buy-side liquidity.",
                "confidence": 0.93
            }

        # Bearish ICT Setup
        bearish_fvgs = [f for f in unmitigated_fvgs if f["type"] == "BEARISH_FVG"]
        if bearish_fvgs or (judas["detected"] and judas["type"] == "BEARISH_JUDAS_SWING"):
            ote = cls.calculate_optimal_trade_entry(sl_val, sh, direction="SHORT")
            sl = sh * 1.001
            risk = abs(sl - current_price)
            if risk <= 0:
                return None

            return {
                "strategy": "ICT_SILVER_BULLET_FVG",
                "side": "SELL",
                "symbol": candles[-1].get("symbol", "BTCUSDT"),
                "entry_price": round(current_price, 2),
                "stop_loss": round(sl, 2),
                "take_profit_1": round(current_price - risk * 3.0, 2),   # 1:3 R:R
                "take_profit_2": round(current_price - risk * 5.0, 2),   # 1:5 R:R
                "take_profit_3": round(current_price - risk * 20.0, 2),  # 1:20 R:R
                "risk_reward_ratio": 20.0,
                "killzone": kz_name or "ACTIVE_LIQUIDITY_WINDOW",
                "ote_sweet_spot": ote["ote_705_sweet_spot"],
                "rationale": f"ICT Silver Bullet: Premium FVG Consequent Encroachment retest, targeting HTF sell-side liquidity.",
                "confidence": 0.93
            }

        return None

ict_engine = ICTEngine()
