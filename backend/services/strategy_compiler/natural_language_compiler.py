"""
Natural Language Strategy Rule Compiler
Translates Plain-English quantitative trading rules into deterministic
vectorised indicator logic and entry/exit conditions.
"""
import re
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional, List

class NaturalLanguageCompiler:
    """
    Parses conversational trading logic into deterministic execution signals.
    Example:
    'Buy when RSI is below 30 and price is above EMA 200. Exit when RSI > 70. SL at 1.5 ATR, TP at 1:10 RR'
    """

    @classmethod
    def compile_rules(cls, text_rules: str, df: pd.DataFrame) -> Tuple[np.ndarray, Dict[str, Any], Optional[str]]:
        if df.empty or len(df) < 5:
            return np.zeros(len(df)), {}, "Insufficient candles for rule compilation."

        n = len(df)
        signals = np.zeros(n)
        close = df["close"].values
        high = df["high"].values
        low = df["low"].values
        open_p = df["open"].values
        volume = df["volume"].values

        parsed_config: Dict[str, Any] = {
            "entry_conditions": [],
            "exit_conditions": [],
            "stop_loss_atr": 1.5,
            "take_profit_rr": 3.0,
            "parsed_text": text_rules
        }

        # Calculate standard indicator universe
        emas: Dict[int, np.ndarray] = {}
        for p in [9, 20, 21, 50, 100, 200]:
            emas[p] = pd.Series(close).ewm(span=p, adjust=False).mean().values

        smas: Dict[int, np.ndarray] = {}
        for p in [20, 50, 200]:
            smas[p] = pd.Series(close).rolling(p, min_periods=1).mean().values

        # RSI 14
        delta = pd.Series(close).diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(alpha=1/14, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/14, adjust=False).mean()
        rs = avg_gain / (avg_loss + 1e-10)
        rsi = (100 - (100 / (1 + rs))).values

        # ATR 14
        prev_close = np.roll(close, 1)
        prev_close[0] = close[0]
        tr = np.maximum(high - low, np.maximum(np.abs(high - prev_close), np.abs(low - prev_close)))
        atr = pd.Series(tr).ewm(alpha=1/14, adjust=False).mean().values

        text_lower = text_rules.lower()

        # Parse Risk / Reward and Stops
        rr_match = re.search(r"1\s*:\s*(\d+)(?:\s*(?:rr|risk reward|r:r))?", text_lower)
        if rr_match:
            parsed_config["take_profit_rr"] = float(rr_match.group(1))

        sl_atr_match = re.search(r"(?:sl|stop loss).*?(\d+(?:\.\d+)?)\s*atr", text_lower)
        if sl_atr_match:
            parsed_config["stop_loss_atr"] = float(sl_atr_match.group(1))

        # Build Entry Conditions Mask
        entry_masks = []

        # 1. RSI oversold / threshold
        # e.g. "rsi is below 30", "rsi < 30", "rsi below 35"
        rsi_below = re.search(r"rsi\s*(?:is\s*)?(?:below|<|less than)\s*(\d+)", text_lower)
        if rsi_below:
            thresh = float(rsi_below.group(1))
            entry_masks.append(rsi < thresh)
            parsed_config["entry_conditions"].append(f"RSI < {thresh}")

        # 2. Price above EMA / SMA
        # e.g. "price is above ema 200", "price > ema 50"
        price_above_ema = re.search(r"price\s*(?:is\s*)?(?:above|>|greater than)\s*ema\s*(\d+)", text_lower)
        if price_above_ema:
            period = int(price_above_ema.group(1))
            if period in emas:
                entry_masks.append(close > emas[period])
                parsed_config["entry_conditions"].append(f"Price > EMA({period})")

        # 3. EMA Crossover
        # e.g. "ema 9 crosses above ema 21", "ema 9 crossover ema 21"
        ema_cross = re.search(r"ema\s*(\d+)\s*(?:crosses above|crossover)\s*ema\s*(\d+)", text_lower)
        if ema_cross:
            f_p = int(ema_cross.group(1))
            s_p = int(ema_cross.group(2))
            fast_ema = emas.get(f_p, pd.Series(close).ewm(span=f_p, adjust=False).mean().values)
            slow_ema = emas.get(s_p, pd.Series(close).ewm(span=s_p, adjust=False).mean().values)
            cross_mask = np.zeros(n, dtype=bool)
            for i in range(1, n):
                if fast_ema[i - 1] <= slow_ema[i - 1] and fast_ema[i] > slow_ema[i]:
                    cross_mask[i] = True
            entry_masks.append(cross_mask)
            parsed_config["entry_conditions"].append(f"EMA({f_p}) crosses above EMA({s_p})")

        # 4. Bullish breakout of swing high
        if "breakout" in text_lower or "break of structure" in text_lower or "mss" in text_lower or "bos" in text_lower:
            roll_high = pd.Series(high).rolling(20, min_periods=1).max().values
            bo_mask = np.zeros(n, dtype=bool)
            for i in range(1, n):
                if close[i] > roll_high[i - 1]:
                    bo_mask[i] = True
            entry_masks.append(bo_mask)
            parsed_config["entry_conditions"].append("Breakout above 20-bar Swing High")

        # Combine Entry Masks
        if entry_masks:
            combined_entry = entry_masks[0]
            for m in entry_masks[1:]:
                combined_entry = combined_entry & m
            signals[combined_entry] = 1.0
        else:
            # Fallback default: trend-following EMA 9/21 cross
            fast_ema = emas[9]
            slow_ema = emas[21]
            for i in range(1, n):
                if fast_ema[i - 1] <= slow_ema[i - 1] and fast_ema[i] > slow_ema[i]:
                    signals[i] = 1.0
            parsed_config["entry_conditions"].append("Default: EMA 9 / 21 Crossover")

        # Parse Exit Conditions
        exit_masks = []
        rsi_above = re.search(r"rsi\s*(?:is\s*)?(?:above|>|greater than)\s*(\d+)", text_lower)
        if rsi_above:
            thresh = float(rsi_above.group(1))
            exit_masks.append(rsi > thresh)
            parsed_config["exit_conditions"].append(f"RSI > {thresh}")

        price_below_ema = re.search(r"price\s*(?:is\s*)?(?:below|<|less than)\s*ema\s*(\d+)", text_lower)
        if price_below_ema:
            period = int(price_below_ema.group(1))
            if period in emas:
                exit_masks.append(close < emas[period])
                parsed_config["exit_conditions"].append(f"Price < EMA({period})")

        if exit_masks:
            combined_exit = exit_masks[0]
            for m in exit_masks[1:]:
                combined_exit = combined_exit | m
            signals[combined_exit] = -1.0

        return signals, parsed_config, None

natural_language_compiler = NaturalLanguageCompiler()
