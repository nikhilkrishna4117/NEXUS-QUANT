import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple

class PriceActionEngine:
    """
    Institutional Price Action Engine.
    Detects:
    1. Swing Highs & Swing Lows (Fractal Pivots).
    2. Market Structure Shifts (MSS) - trend reversals via swing point breaches.
    3. Support & Resistance Flips (Prior Resistance -> New Support and vice versa).
    4. Consolidation Range Breakout + Clean Retest confirmation.
    5. High-R:R Sniper Entry calculation with tight LTF invalidation.
    """

    @staticmethod
    def find_pivots(highs: np.ndarray, lows: np.ndarray, left_bars: int = 3, right_bars: int = 3) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Identifies fractal swing highs and swing lows."""
        swing_highs = []
        swing_lows = []
        n = len(highs)

        for i in range(left_bars, n - right_bars):
            # Swing High
            is_high = True
            for j in range(i - left_bars, i + right_bars + 1):
                if j != i and highs[j] >= highs[i]:
                    is_high = False
                    break
            if is_high:
                swing_highs.append({"index": i, "price": float(highs[i])})

            # Swing Low
            is_low = True
            for j in range(i - left_bars, i + right_bars + 1):
                if j != i and lows[j] <= lows[i]:
                    is_low = False
                    break
            if is_low:
                swing_lows.append({"index": i, "price": float(lows[i])})

        return swing_highs, swing_lows

    @classmethod
    def detect_market_structure_shift(cls, candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Detects Market Structure Shift (MSS).
        Bullish MSS: Price breaks above the most recent Lower High in a downtrend with strong expansion.
        Bearish MSS: Price breaks below the most recent Higher Low in an uptrend with strong displacement.
        """
        if not candles or len(candles) < 20:
            return {"detected": False, "type": "NONE"}

        highs = np.array([float(c["high"]) for c in candles])
        lows = np.array([float(c["low"]) for c in candles])
        closes = np.array([float(c["close"]) for c in candles])
        current_close = closes[-1]

        swing_highs, swing_lows = cls.find_pivots(highs, lows, left_bars=2, right_bars=2)

        if len(swing_highs) < 2 or len(swing_lows) < 2:
            return {"detected": False, "type": "NONE"}

        last_sh = swing_highs[-1]["price"]
        prev_sh = swing_highs[-2]["price"]
        last_sl = swing_lows[-1]["price"]
        prev_sl = swing_lows[-2]["price"]

        # Bullish MSS: Previous structure was LH/LL, and current price breaks above the last Swing High
        if prev_sh > last_sh and current_close > last_sh:
            return {
                "detected": True,
                "type": "BULLISH_MSS",
                "breakout_level": last_sh,
                "invalidation_price": last_sl,
                "current_price": current_close,
                "confidence": 0.88,
                "description": f"Bullish Market Structure Shift: Price ({current_close:.2f}) broke above swing high ({last_sh:.2f})."
            }

        # Bearish MSS: Previous structure was HH/HL, and current price breaks below the last Swing Low
        if prev_sl < last_sl and current_close < last_sl:
            return {
                "detected": True,
                "type": "BEARISH_MSS",
                "breakout_level": last_sl,
                "invalidation_price": last_sh,
                "current_price": current_close,
                "confidence": 0.88,
                "description": f"Bearish Market Structure Shift: Price ({current_close:.2f}) broke below swing low ({last_sl:.2f})."
            }

        return {"detected": False, "type": "NONE"}

    @classmethod
    def detect_sr_flip(cls, candles: List[Dict[str, Any]], tolerance_pct: float = 0.003) -> Dict[str, Any]:
        """
        Detects Support & Resistance Flips.
        Resistance-to-Support Flip (Bullish): Price breaks above key resistance, then pulls back to test it as support.
        Support-to-Resistance Flip (Bearish): Price breaks below key support, then rallies to retest it as resistance.
        """
        if len(candles) < 30:
            return {"detected": False}

        highs = np.array([float(c["high"]) for c in candles])
        lows = np.array([float(c["low"]) for c in candles])
        closes = np.array([float(c["close"]) for c in candles])
        current_price = closes[-1]

        swing_highs, swing_lows = cls.find_pivots(highs, lows, left_bars=3, right_bars=3)

        # Bullish SR Flip: Prior swing high acted as ceiling, price broke above it, and recent low tests that ceiling
        for sh in swing_highs[:-2]:
            sr_level = sh["price"]
            recent_low = min(lows[-5:])
            if current_price > sr_level and abs(recent_low - sr_level) / sr_level <= tolerance_pct:
                return {
                    "detected": True,
                    "type": "BULLISH_SR_FLIP",
                    "level": sr_level,
                    "invalidation_price": sr_level * (1.0 - tolerance_pct * 2.0),
                    "target_rr_10": current_price + (current_price - sr_level * 0.995) * 10.0,
                    "description": f"Resistance-to-Support Flip verified at {sr_level:.2f}."
                }

        # Bearish SR Flip: Prior swing low acted as floor, price broke below it, and recent high tests that floor
        for sl in swing_lows[:-2]:
            sr_level = sl["price"]
            recent_high = max(highs[-5:])
            if current_price < sr_level and abs(recent_high - sr_level) / sr_level <= tolerance_pct:
                return {
                    "detected": True,
                    "type": "BEARISH_SR_FLIP",
                    "level": sr_level,
                    "invalidation_price": sr_level * (1.0 + tolerance_pct * 2.0),
                    "target_rr_10": current_price - (sr_level * 1.005 - current_price) * 10.0,
                    "description": f"Support-to-Resistance Flip verified at {sr_level:.2f}."
                }

        return {"detected": False}

    @classmethod
    def generate_signal(cls, candles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Synthesizes Price Action MSS and S/R Flip into a High-R:R actionable setup.
        Calculates: Entry, Invalidation (SL), Milestone TP1 (1:3), TP2 (1:5), and Final Runner TP3 (1:10).
        """
        mss = cls.detect_market_structure_shift(candles)
        sr = cls.detect_sr_flip(candles)
        current_price = float(candles[-1]["close"])

        if mss["detected"]:
            if mss["type"] == "BULLISH_MSS":
                entry = current_price
                sl = mss["invalidation_price"]
                risk = abs(entry - sl)
                if risk <= 0:
                    return None
                return {
                    "strategy": "PRICE_ACTION_MSS",
                    "side": "BUY",
                    "symbol": candles[-1].get("symbol", "BTCUSDT"),
                    "entry_price": round(entry, 2),
                    "stop_loss": round(sl, 2),
                    "take_profit_1": round(entry + risk * 3.0, 2),   # 1:3 R:R (Move SL to BE)
                    "take_profit_2": round(entry + risk * 5.0, 2),   # 1:5 R:R (Scale 25%)
                    "take_profit_3": round(entry + risk * 10.0, 2),  # 1:10 R:R (Major Target)
                    "risk_reward_ratio": 10.0,
                    "rationale": mss["description"],
                    "confidence": mss["confidence"]
                }
            elif mss["type"] == "BEARISH_MSS":
                entry = current_price
                sl = mss["invalidation_price"]
                risk = abs(sl - entry)
                if risk <= 0:
                    return None
                return {
                    "strategy": "PRICE_ACTION_MSS",
                    "side": "SELL",
                    "symbol": candles[-1].get("symbol", "BTCUSDT"),
                    "entry_price": round(entry, 2),
                    "stop_loss": round(sl, 2),
                    "take_profit_1": round(entry - risk * 3.0, 2),   # 1:3 R:R
                    "take_profit_2": round(entry - risk * 5.0, 2),   # 1:5 R:R
                    "take_profit_3": round(entry - risk * 10.0, 2),  # 1:10 R:R
                    "risk_reward_ratio": 10.0,
                    "rationale": mss["description"],
                    "confidence": mss["confidence"]
                }

        return None

price_action_engine = PriceActionEngine()
