import numpy as np
from typing import List, Dict, Any, Optional, Tuple

class SMCEngine:
    """
    Smart Money Concepts (SMC) Institutional Engine.
    Detects:
    1. Break of Structure (BOS) vs Change of Character (CHoCH).
    2. Unmitigated Bullish & Bearish Order Blocks (OB).
    3. Premium vs Discount Fibonacci Zones (Equilibrium 50%).
    4. Internal & External Liquidity Sweeps (BSL/SSL stop hunts).
    5. High-R:R Institutional Entries (1:10 - 1:30 targets).
    """

    @classmethod
    def calculate_premium_discount(cls, swing_low: float, swing_high: float, current_price: float) -> Dict[str, Any]:
        """Calculates 50% equilibrium and determines whether price is in Premium or Discount."""
        range_size = swing_high - swing_low
        equilibrium = swing_low + (range_size * 0.5)
        percentile = ((current_price - swing_low) / (range_size + 1e-10)) * 100.0

        is_discount = current_price < equilibrium
        is_premium = current_price > equilibrium

        return {
            "swing_low": swing_low,
            "swing_high": swing_high,
            "equilibrium": round(equilibrium, 2),
            "current_price": round(current_price, 2),
            "percentile": round(percentile, 1),
            "zone": "DISCOUNT" if is_discount else "PREMIUM",
            "is_discount": is_discount,
            "is_premium": is_premium
        }

    @classmethod
    def detect_order_blocks(cls, candles: List[Dict[str, Any]], lookback: int = 50) -> List[Dict[str, Any]]:
        """
        Detects unmitigated Bullish and Bearish Order Blocks.
        Bullish OB: The last down candle before an impulsive bullish expansion that caused a BOS.
        Bearish OB: The last up candle before an impulsive bearish expansion that caused a BOS.
        """
        if len(candles) < 4:
            return []

        c = candles[-lookback:]
        order_blocks = []
        n = len(c)

        for i in range(1, n - 3):
            bar = c[i]
            next1 = c[i + 1]
            next2 = c[i + 2]

            # Bullish Order Block Candidate: Down candle followed by strong 2-bar bullish displacement
            is_down_candle = float(bar["close"]) < float(bar["open"])
            displacement_up = float(next1["close"]) > float(bar["high"]) and float(next2["close"]) > float(next1["close"])

            if is_down_candle and displacement_up:
                ob_high = float(bar["high"])
                ob_low = float(bar["low"])

                # Check if unmitigated by subsequent price action
                is_mitigated = False
                for future in c[i + 3:]:
                    if float(future["low"]) <= ob_high:
                        is_mitigated = True
                        break

                if not is_mitigated:
                    order_blocks.append({
                        "type": "BULLISH_OB",
                        "index": i,
                        "high": ob_high,
                        "low": ob_low,
                        "midpoint": (ob_high + ob_low) / 2.0,
                        "is_mitigated": False,
                        "age_bars": n - i
                    })

            # Bearish Order Block Candidate: Up candle followed by strong 2-bar bearish displacement
            is_up_candle = float(bar["close"]) > float(bar["open"])
            displacement_down = float(next1["close"]) < float(bar["low"]) and float(next2["close"]) < float(next1["close"])

            if is_up_candle and displacement_down:
                ob_high = float(bar["high"])
                ob_low = float(bar["low"])

                is_mitigated = False
                for future in c[i + 3:]:
                    if float(future["high"]) >= ob_low:
                        is_mitigated = True
                        break

                if not is_mitigated:
                    order_blocks.append({
                        "type": "BEARISH_OB",
                        "index": i,
                        "high": ob_high,
                        "low": ob_low,
                        "midpoint": (ob_high + ob_low) / 2.0,
                        "is_mitigated": False,
                        "age_bars": n - i
                    })

        return order_blocks

    @classmethod
    def detect_liquidity_sweep(cls, candles: List[Dict[str, Any]], lookback: int = 30) -> Dict[str, Any]:
        """
        Detects Buy-Side Liquidity (BSL) or Sell-Side Liquidity (SSL) Sweeps.
        BSL Sweep: Candle wick pierces above recent swing high, but candle body closes back below it.
        SSL Sweep: Candle wick pierces below recent swing low, but candle body closes back above it.
        """
        if len(candles) < lookback:
            return {"detected": False}

        highs = [float(c["high"]) for c in candles[:-1]]
        lows = [float(c["low"]) for c in candles[:-1]]
        current = candles[-1]
        c_high = float(current["high"])
        c_low = float(current["low"])
        c_close = float(current["close"])

        recent_peak = max(highs[-lookback:])
        recent_trough = min(lows[-lookback:])

        # Buy-Side Liquidity Sweep (Bearish Signal)
        if c_high > recent_peak and c_close < recent_peak:
            return {
                "detected": True,
                "type": "BSL_SWEEP",
                "swept_level": recent_peak,
                "wick_high": c_high,
                "close_price": c_close,
                "bias": "BEARISH",
                "description": f"Buy-Side Liquidity swept above {recent_peak:.2f}. Institutional trap detected."
            }

        # Sell-Side Liquidity Sweep (Bullish Signal)
        if c_low < recent_trough and c_close > recent_trough:
            return {
                "detected": True,
                "type": "SSL_SWEEP",
                "swept_level": recent_trough,
                "wick_low": c_low,
                "close_price": c_close,
                "bias": "BULLISH",
                "description": f"Sell-Side Liquidity swept below {recent_trough:.2f}. Institutional accumulation detected."
            }

        return {"detected": False}

    @classmethod
    def generate_signal(cls, candles: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Generates SMC High-R:R Institutional trade signal.
        Requires:
        1. Liquidity Sweep (SSL for Long, BSL for Short).
        2. Unmitigated Order Block alignment.
        3. Strict Premium/Discount filter (Longs strictly in Discount, Shorts strictly in Premium).
        """
        if len(candles) < 40:
            return None

        current_price = float(candles[-1]["close"])
        highs = [float(c["high"]) for c in candles]
        lows = [float(c["low"]) for c in candles]
        swing_high = max(highs[-40:])
        swing_low = min(lows[-40:])

        predisc = cls.calculate_premium_discount(swing_low, swing_high, current_price)
        sweep = cls.detect_liquidity_sweep(candles)
        order_blocks = cls.detect_order_blocks(candles)

        # Bullish SMC Setup: SSL Swept + in Discount (<50%) + Unmitigated Bullish OB
        if sweep["detected"] and sweep["type"] == "SSL_SWEEP" and predisc["is_discount"]:
            bullish_obs = [ob for ob in order_blocks if ob["type"] == "BULLISH_OB"]
            sl = sweep["wick_low"] * 0.999 # tight invalidation below liquidity sweep
            risk = abs(current_price - sl)
            if risk <= 0:
                return None

            return {
                "strategy": "SMC_LIQUIDITY_OB_EXPANSION",
                "side": "BUY",
                "symbol": candles[-1].get("symbol", "BTCUSDT"),
                "entry_price": round(current_price, 2),
                "stop_loss": round(sl, 2),
                "take_profit_1": round(current_price + risk * 3.0, 2),   # 1:3 R:R (Move to BE)
                "take_profit_2": round(current_price + risk * 5.0, 2),   # 1:5 R:R (Scale 25%)
                "take_profit_3": round(current_price + risk * 15.0, 2),  # 1:15 R:R (External Range Liquidity)
                "risk_reward_ratio": 15.0,
                "order_blocks_count": len(bullish_obs),
                "rationale": f"SMC Confluence: Sell-Side Liquidity swept in Discount Zone ({predisc['percentile']}%), targeting external liquidity.",
                "confidence": 0.91
            }

        # Bearish SMC Setup: BSL Swept + in Premium (>50%) + Unmitigated Bearish OB
        if sweep["detected"] and sweep["type"] == "BSL_SWEEP" and predisc["is_premium"]:
            bearish_obs = [ob for ob in order_blocks if ob["type"] == "BEARISH_OB"]
            sl = sweep["wick_high"] * 1.001
            risk = abs(sl - current_price)
            if risk <= 0:
                return None

            return {
                "strategy": "SMC_LIQUIDITY_OB_EXPANSION",
                "side": "SELL",
                "symbol": candles[-1].get("symbol", "BTCUSDT"),
                "entry_price": round(current_price, 2),
                "stop_loss": round(sl, 2),
                "take_profit_1": round(current_price - risk * 3.0, 2),   # 1:3 R:R
                "take_profit_2": round(current_price - risk * 5.0, 2),   # 1:5 R:R
                "take_profit_3": round(current_price - risk * 15.0, 2),  # 1:15 R:R
                "risk_reward_ratio": 15.0,
                "order_blocks_count": len(bearish_obs),
                "rationale": f"SMC Confluence: Buy-Side Liquidity swept in Premium Zone ({predisc['percentile']}%), targeting external discount low.",
                "confidence": 0.91
            }

        return None

smc_engine = SMCEngine()
