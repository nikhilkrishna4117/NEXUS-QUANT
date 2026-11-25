import math
from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import pandas as pd

class TechnicalAnalysisEngine:
    """
    Quantitative technical analysis, market structure recognition,
    chart pattern detection, and market regime classification engine.
    """

    @staticmethod
    def calculate_indicators(candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculate vectorized technical indicators for a given series of OHLCV candles.
        """
        if not candles or len(candles) < 15:
            return {}

        df = pd.DataFrame(candles)
        df['open'] = df['open'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)
        df['close'] = df['close'].astype(float)
        df['volume'] = df['volume'].astype(float)

        close = df['close'].values
        high = df['high'].values
        low = df['low'].values
        vol = df['volume'].values
        n = len(df)

        # 1. Simple Moving Averages
        sma20 = pd.Series(close).rolling(window=20, min_periods=1).mean().values
        sma50 = pd.Series(close).rolling(window=50, min_periods=1).mean().values
        sma200 = pd.Series(close).rolling(window=200, min_periods=1).mean().values

        # 2. Exponential Moving Averages
        ema9 = pd.Series(close).ewm(span=9, adjust=False).mean().values
        ema21 = pd.Series(close).ewm(span=21, adjust=False).mean().values
        ema50 = pd.Series(close).ewm(span=50, adjust=False).mean().values
        ema200 = pd.Series(close).ewm(span=200, adjust=False).mean().values

        # 3. RSI (Wilder's Smoothing)
        delta = pd.Series(close).diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(alpha=1/14, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/14, adjust=False).mean()
        rs = avg_gain / (avg_loss + 1e-10)
        rsi = (100 - (100 / (1 + rs))).values

        # 4. MACD (12, 26, 9)
        ema12 = pd.Series(close).ewm(span=12, adjust=False).mean()
        ema26 = pd.Series(close).ewm(span=26, adjust=False).mean()
        macd_line = (ema12 - ema26).values
        macd_signal = pd.Series(macd_line).ewm(span=9, adjust=False).mean().values
        macd_hist = macd_line - macd_signal

        # 5. Bollinger Bands (20, 2 std dev)
        rolling_std = pd.Series(close).rolling(window=20, min_periods=1).std().values
        bb_upper = sma20 + 2.0 * rolling_std
        bb_lower = sma20 - 2.0 * rolling_std
        bb_bandwidth = ((bb_upper - bb_lower) / (sma20 + 1e-10) * 100.0)
        bb_percent = (close - bb_lower) / ((bb_upper - bb_lower) + 1e-10)

        # 6. ATR (Average True Range, 14)
        prev_close = np.roll(close, 1)
        prev_close[0] = close[0]
        tr1 = high - low
        tr2 = np.abs(high - prev_close)
        tr3 = np.abs(low - prev_close)
        tr = np.maximum(tr1, np.maximum(tr2, tr3))
        atr = pd.Series(tr).ewm(alpha=1/14, adjust=False).mean().values

        # 7. ADX (Average Directional Index, 14)
        up_move = high - np.roll(high, 1)
        up_move[0] = 0
        down_move = np.roll(low, 1) - low
        down_move[0] = 0

        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

        plus_di = 100 * (pd.Series(plus_dm).ewm(alpha=1/14, adjust=False).mean().values / (atr + 1e-10))
        minus_di = 100 * (pd.Series(minus_dm).ewm(alpha=1/14, adjust=False).mean().values / (atr + 1e-10))
        dx = 100 * (np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10))
        adx = pd.Series(dx).ewm(alpha=1/14, adjust=False).mean().values

        # 8. VWAP (Cumulative Volume Weighted Average Price)
        typical_price = (high + low + close) / 3.0
        cum_vol_price = np.cumsum(typical_price * vol)
        cum_vol = np.cumsum(vol)
        vwap = np.where(cum_vol > 0, cum_vol_price / cum_vol, typical_price)

        # 9. Stochastic Oscillator (14, 3)
        lowest_low_14 = pd.Series(low).rolling(window=14, min_periods=1).min().values
        highest_high_14 = pd.Series(high).rolling(window=14, min_periods=1).max().values
        stoch_k = 100 * ((close - lowest_low_14) / (highest_high_14 - lowest_low_14 + 1e-10))
        stoch_d = pd.Series(stoch_k).rolling(window=3, min_periods=1).mean().values

        # 10. Volume SMA
        vol_sma20 = pd.Series(vol).rolling(window=20, min_periods=1).mean().values

        latest_idx = -1
        return {
            "current_price": float(close[latest_idx]),
            "rsi": round(float(rsi[latest_idx]), 2),
            "macd": {
                "line": round(float(macd_line[latest_idx]), 4),
                "signal": round(float(macd_signal[latest_idx]), 4),
                "histogram": round(float(macd_hist[latest_idx]), 4)
            },
            "ema": {
                "ema9": round(float(ema9[latest_idx]), 2),
                "ema21": round(float(ema21[latest_idx]), 2),
                "ema50": round(float(ema50[latest_idx]), 2),
                "ema200": round(float(ema200[latest_idx]), 2)
            },
            "sma": {
                "sma20": round(float(sma20[latest_idx]), 2),
                "sma50": round(float(sma50[latest_idx]), 2),
                "sma200": round(float(sma200[latest_idx]), 2)
            },
            "bollinger_bands": {
                "upper": round(float(bb_upper[latest_idx]), 2),
                "middle": round(float(sma20[latest_idx]), 2),
                "lower": round(float(bb_lower[latest_idx]), 2),
                "bandwidth_pct": round(float(bb_bandwidth[latest_idx]), 2),
                "percent_b": round(float(bb_percent[latest_idx]), 3)
            },
            "atr": round(float(atr[latest_idx]), 2),
            "adx": {
                "adx": round(float(adx[latest_idx]), 2),
                "plus_di": round(float(plus_di[latest_idx]), 2),
                "minus_di": round(float(minus_di[latest_idx]), 2)
            },
            "vwap": round(float(vwap[latest_idx]), 2),
            "stochastic": {
                "k": round(float(stoch_k[latest_idx]), 2),
                "d": round(float(stoch_d[latest_idx]), 2)
            },
            "volume": {
                "current": float(vol[latest_idx]),
                "sma20": float(vol_sma20[latest_idx]),
                "ratio": round(float(vol[latest_idx] / (vol_sma20[latest_idx] + 1e-10)), 2)
            },
            # Series for charting overlay (last 100 points)
            "series": {
                "timestamps": [c["timestamp"].isoformat() if hasattr(c["timestamp"], "isoformat") else str(c["timestamp"]) for c in candles[-100:]],
                "close": [round(float(c), 2) for c in close[-100:]],
                "ema9": [round(float(v), 2) for v in ema9[-100:]],
                "ema21": [round(float(v), 2) for v in ema21[-100:]],
                "ema50": [round(float(v), 2) for v in ema50[-100:]],
                "sma20": [round(float(v), 2) for v in sma20[-100:]],
                "bb_upper": [round(float(v), 2) for v in bb_upper[-100:]],
                "bb_lower": [round(float(v), 2) for v in bb_lower[-100:]],
                "rsi": [round(float(v), 2) for v in rsi[-100:]],
                "macd_line": [round(float(v), 4) for v in macd_line[-100:]],
                "macd_signal": [round(float(v), 4) for v in macd_signal[-100:]],
                "macd_hist": [round(float(v), 4) for v in macd_hist[-100:]],
                "vwap": [round(float(v), 2) for v in vwap[-100:]]
            }
        }

    @staticmethod
    def identify_market_structure(candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Identify swing highs/lows, higher highs/lows, support & resistance levels,
        and market structure breaks (BOS/CHoCH).
        """
        if len(candles) < 20:
            return {"swings": [], "support_levels": [], "resistance_levels": [], "structure": "Consolidating"}

        highs = np.array([c["high"] for c in candles])
        lows = np.array([c["low"] for c in candles])
        closes = np.array([c["close"] for c in candles])
        n = len(candles)

        # Detect swing points with window size 3
        swing_highs = []
        swing_lows = []
        window = 3

        for i in range(window, n - window):
            # Pivot High
            if all(highs[i] > highs[i - j] for j in range(1, window + 1)) and all(highs[i] > highs[i + j] for j in range(1, window + 1)):
                swing_highs.append({"index": i, "price": round(float(highs[i]), 2), "time": candles[i]["timestamp"]})
            # Pivot Low
            if all(lows[i] < lows[i - j] for j in range(1, window + 1)) and all(lows[i] < lows[i + j] for j in range(1, window + 1)):
                swing_lows.append({"index": i, "price": round(float(lows[i]), 2), "time": candles[i]["timestamp"]})

        # Classify sequence: HH/HL (Bullish) or LH/LL (Bearish)
        structure_trend = "Ranging / Neutral"
        hh_count = 0
        hl_count = 0
        lh_count = 0
        ll_count = 0

        if len(swing_highs) >= 2:
            if swing_highs[-1]["price"] > swing_highs[-2]["price"]:
                hh_count += 1
            else:
                lh_count += 1

        if len(swing_lows) >= 2:
            if swing_lows[-1]["price"] > swing_lows[-2]["price"]:
                hl_count += 1
            else:
                ll_count += 1

        current_price = closes[-1]
        if hh_count > 0 and hl_count > 0:
            structure_trend = "Bullish Market Structure (Higher Highs & Higher Lows)"
        elif lh_count > 0 and ll_count > 0:
            structure_trend = "Bearish Market Structure (Lower Highs & Lower Lows)"
        elif current_price > (swing_highs[-1]["price"] if swing_highs else current_price):
            structure_trend = "Break of Structure (BOS Long)"
        elif current_price < (swing_lows[-1]["price"] if swing_lows else current_price):
            structure_trend = "Break of Structure (BOS Short)"

        # Compute dynamic support & resistance levels via clustering
        all_pivots = [p["price"] for p in swing_highs] + [p["price"] for p in swing_lows]
        resistances = sorted([p for p in all_pivots if p > current_price])
        supports = sorted([p for p in all_pivots if p < current_price], reverse=True)

        # Consolidate nearby levels (within 0.5% band)
        def cluster_levels(levels: List[float], max_cluster: int = 3) -> List[float]:
            clustered = []
            for lvl in levels:
                if not any(abs(lvl - c) / c < 0.005 for c in clustered):
                    clustered.append(lvl)
                if len(clustered) >= max_cluster:
                    break
            return clustered

        nearest_resistances = cluster_levels(resistances)
        nearest_supports = cluster_levels(supports)

        return {
            "structure": structure_trend,
            "last_swing_high": swing_highs[-1]["price"] if swing_highs else None,
            "last_swing_low": swing_lows[-1]["price"] if swing_lows else None,
            "support_levels": nearest_supports,
            "resistance_levels": nearest_resistances,
            "liquidity_pool_high": max(highs[-50:]) if len(highs) >= 50 else max(highs),
            "liquidity_pool_low": min(lows[-50:]) if len(lows) >= 50 else min(lows),
            "total_swing_highs_detected": len(swing_highs),
            "total_swing_lows_detected": len(swing_lows),
        }

    @staticmethod
    def detect_chart_patterns(candles: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Detect geometric and candlestick price action patterns.
        """
        if len(candles) < 10:
            return []

        patterns = []
        c = candles
        last = c[-1]
        prev = c[-2]
        prev2 = c[-3] if len(c) >= 3 else prev

        # 1. Bullish Engulfing
        if prev["close"] < prev["open"] and last["close"] > last["open"]:
            if last["open"] <= prev["close"] and last["close"] >= prev["open"]:
                patterns.append({
                    "name": "Bullish Engulfing",
                    "type": "bullish",
                    "confidence": 0.85,
                    "description": "Large green candle completely engulfs the prior red candle, indicating strong buying conviction."
                })

        # 2. Bearish Engulfing
        if prev["close"] > prev["open"] and last["close"] < last["open"]:
            if last["open"] >= prev["close"] and last["close"] <= prev["open"]:
                patterns.append({
                    "name": "Bearish Engulfing",
                    "type": "bearish",
                    "confidence": 0.85,
                    "description": "Large red candle completely engulfs the prior green candle, indicating intense selling pressure."
                })

        # 3. Hammer (Bullish Reversal Pin Bar)
        body = abs(last["close"] - last["open"])
        lower_wick = min(last["open"], last["close"]) - last["low"]
        upper_wick = last["high"] - max(last["open"], last["close"])
        candle_range = last["high"] - last["low"]

        if candle_range > 0 and lower_wick >= 2.0 * body and upper_wick <= 0.2 * candle_range:
            patterns.append({
                "name": "Hammer (Bullish Pin Bar)",
                "type": "bullish",
                "confidence": 0.78,
                "description": "Long lower shadow rejects lower prices, signalling buyer accumulation at key support."
            })

        # 4. Shooting Star (Bearish Reversal Pin Bar)
        if candle_range > 0 and upper_wick >= 2.0 * body and lower_wick <= 0.2 * candle_range:
            patterns.append({
                "name": "Shooting Star (Bearish Pin Bar)",
                "type": "bearish",
                "confidence": 0.78,
                "description": "Long upper shadow rejects higher prices, signalling aggressive distribution."
            })

        # 5. Double Bottom / Double Top (within last 30 bars)
        if len(c) >= 30:
            lows = [bar["low"] for bar in c[-30:]]
            highs = [bar["high"] for bar in c[-30:]]
            min1_idx = int(np.argmin(lows[:15]))
            min2_idx = 15 + int(np.argmin(lows[15:]))
            if abs(lows[min1_idx] - lows[min2_idx]) / lows[min1_idx] < 0.008:
                patterns.append({
                    "name": "Double Bottom Formation (W-Pattern)",
                    "type": "bullish",
                    "confidence": 0.82,
                    "description": "Dual price rejection at equal support levels with interim peak forming a neckline."
                })

            max1_idx = int(np.argmax(highs[:15]))
            max2_idx = 15 + int(np.argmax(highs[15:]))
            if abs(highs[max1_idx] - highs[max2_idx]) / highs[max1_idx] < 0.008:
                patterns.append({
                    "name": "Double Top Formation (M-Pattern)",
                    "type": "bearish",
                    "confidence": 0.82,
                    "description": "Dual rejection at equal resistance ceiling signalling exhausted upward momentum."
                })

        return patterns

    @classmethod
    def classify_market_regime(cls, indicators: Dict[str, Any], structure: Dict[str, Any]) -> Dict[str, Any]:
        """
        Classify market into clear regimes:
        - Strong Bullish Trend
        - Strong Bearish Trend
        - Sideways / Ranging
        - High Volatility
        - Low Volatility
        - Potential Reversal
        - Unclear
        """
        if not indicators:
            return {
                "regime": "Unclear market conditions",
                "bias": "Neutral",
                "confidence": 0.5,
                "rationale": ["Insufficient data points to evaluate regime."]
            }

        price = indicators["current_price"]
        ema9 = indicators["ema"]["ema9"]
        ema21 = indicators["ema"]["ema21"]
        ema50 = indicators["ema"]["ema50"]
        ema200 = indicators["ema"]["ema200"]
        rsi = indicators["rsi"]
        adx_val = indicators["adx"]["adx"]
        plus_di = indicators["adx"]["plus_di"]
        minus_di = indicators["adx"]["minus_di"]
        bb_bw = indicators["bollinger_bands"]["bandwidth_pct"]

        reasons = []
        bull_points = 0
        bear_points = 0

        # Moving Average Alignment
        if price > ema9 > ema21 > ema50:
            bull_points += 3
            reasons.append("Price is trading above stacked bullish EMAs (9 > 21 > 50).")
        elif price < ema9 < ema21 < ema50:
            bear_points += 3
            reasons.append("Price is trading below stacked bearish EMAs (9 < 21 < 50).")

        # Long term 200 EMA trend filter
        if price > ema200:
            bull_points += 2
            reasons.append("Price sits comfortably above the institutional 200 EMA baseline.")
        else:
            bear_points += 2
            reasons.append("Price is below the institutional 200 EMA, confirming macro weakness.")

        # Directional Movement & ADX
        if adx_val > 25:
            if plus_di > minus_di:
                bull_points += 2
                reasons.append(f"ADX at {adx_val} confirms strong bullish directional trend strength (+DI > -DI).")
            else:
                bear_points += 2
                reasons.append(f"ADX at {adx_val} confirms strong bearish directional trend strength (-DI > +DI).")
        else:
            reasons.append(f"ADX at {adx_val} indicates an absence of directional trend conviction (ranging/sideways).")

        # RSI Momentum
        if rsi > 60:
            bull_points += 1
            reasons.append(f"RSI ({rsi}) confirms sustained upward momentum without being critically overbought.")
        elif rsi < 40:
            bear_points += 1
            reasons.append(f"RSI ({rsi}) reflects strong bearish pressure.")
        elif rsi > 75:
            reasons.append(f"RSI ({rsi}) is in overbought territory, warning of near-term consolidation or pullback.")
        elif rsi < 25:
            reasons.append(f"RSI ({rsi}) is oversold, setting up potential mean-reversion exhaustion.")

        # Volatility assessment
        volatility_state = "Normal Volatility"
        if bb_bw > 10.0:
            volatility_state = "High Volatility"
            reasons.append(f"Bollinger Bandwidth at {bb_bw}% indicates elevated market volatility.")
        elif bb_bw < 3.0:
            volatility_state = "Low Volatility (Squeeze)"
            reasons.append(f"Bollinger Bandwidth compressed to {bb_bw}%, indicating an impending volatility breakout.")

        # Final Classification
        if bull_points >= 6:
            regime = "Strong Bullish Trend"
            bias = "Bullish"
            confidence = min(0.95, 0.65 + bull_points * 0.05)
        elif bear_points >= 6:
            regime = "Strong Bearish Trend"
            bias = "Bearish"
            confidence = min(0.95, 0.65 + bear_points * 0.05)
        elif volatility_state == "High Volatility":
            regime = "High-Volatility Market"
            bias = "Neutral / Cautious"
            confidence = 0.72
        elif adx_val < 20:
            regime = "Sideways / Ranging Market"
            bias = "Rangebound"
            confidence = 0.80
        elif (rsi > 75 and bear_points > 2) or (rsi < 25 and bull_points > 2):
            regime = "Potential Trend Reversal"
            bias = "Contrarian"
            confidence = 0.70
        else:
            regime = "Unclear Market Conditions"
            bias = "Neutral"
            confidence = 0.55

        return {
            "regime": regime,
            "bias": bias,
            "confidence": round(confidence, 2),
            "volatility_state": volatility_state,
            "rationale": reasons
        }

technical_analysis_engine = TechnicalAnalysisEngine()
