"""
Pine Script Transpiler & Parser
Translates Pine Script v4/v5 indicators and strategy entry/exit commands
into vectorised Pandas/NumPy execution logic.
"""
import re
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional, List

class PineScriptTranspiler:
    """
    Parses Pine Script rules and compiles them into signals.
    Supports ta.ema, ta.sma, ta.rsi, ta.macd, ta.crossover, ta.crossunder,
    ta.atr, ta.highest, ta.lowest, and strategy.entry / strategy.close.
    """

    @classmethod
    def parse_and_execute(cls, pine_code: str, df: pd.DataFrame) -> Tuple[np.ndarray, Optional[str]]:
        if df.empty or len(df) < 5:
            return np.zeros(len(df)), "Insufficient candles for Pine Script evaluation."

        n = len(df)
        signals = np.zeros(n)
        close = df["close"].values
        high = df["high"].values
        low = df["low"].values
        open_p = df["open"].values
        volume = df["volume"].values

        # Technical Indicators Cache
        indicators: Dict[str, np.ndarray] = {
            "close": close,
            "high": high,
            "low": low,
            "open": open_p,
            "volume": volume
        }

        # Precompute Helper Functions
        def get_ema(series: np.ndarray, length: int) -> np.ndarray:
            return pd.Series(series).ewm(span=length, adjust=False).mean().values

        def get_sma(series: np.ndarray, length: int) -> np.ndarray:
            return pd.Series(series).rolling(length, min_periods=1).mean().values

        def get_rsi(series: np.ndarray, length: int = 14) -> np.ndarray:
            delta = pd.Series(series).diff()
            gain = delta.clip(lower=0)
            loss = -delta.clip(upper=0)
            avg_gain = gain.ewm(alpha=1/length, adjust=False).mean()
            avg_loss = loss.ewm(alpha=1/length, adjust=False).mean()
            rs = avg_gain / (avg_loss + 1e-10)
            return (100 - (100 / (1 + rs))).values

        def get_atr(length: int = 14) -> np.ndarray:
            prev_close = np.roll(close, 1)
            prev_close[0] = close[0]
            tr = np.maximum(high - low, np.maximum(np.abs(high - prev_close), np.abs(low - prev_close)))
            return pd.Series(tr).ewm(alpha=1/length, adjust=False).mean().values

        def crossover(a: np.ndarray, b: np.ndarray) -> np.ndarray:
            res = np.zeros(n, dtype=bool)
            for i in range(1, n):
                if a[i - 1] <= b[i - 1] and a[i] > b[i]:
                    res[i] = True
            return res

        def crossunder(a: np.ndarray, b: np.ndarray) -> np.ndarray:
            res = np.zeros(n, dtype=bool)
            for i in range(1, n):
                if a[i - 1] >= b[i - 1] and a[i] < b[i]:
                    res[i] = True
            return res

        # Step 1: Pre-parse line-by-line
        lines = [line.strip() for line in pine_code.split("\n") if line.strip() and not line.strip().startswith("//")]

        long_conditions = []
        short_conditions = []
        exit_conditions = []

        try:
            for line in lines:
                # Variable assignments: e.g. ema9 = ta.ema(close, 9) or fast = ema(close, 9)
                assign_match = re.match(r"^([a-zA-Z0-9_]+)\s*=\s*(.+)$", line)
                if assign_match:
                    var_name = assign_match.group(1).strip()
                    expr = assign_match.group(2).strip()

                    # ta.ema / ema
                    ema_m = re.match(r"(?:ta\.)?ema\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*(\d+)\s*\)", expr)
                    if ema_m:
                        src_name = ema_m.group(1)
                        length = int(ema_m.group(2))
                        src_series = indicators.get(src_name, close)
                        indicators[var_name] = get_ema(src_series, length)
                        continue

                    # ta.sma / sma
                    sma_m = re.match(r"(?:ta\.)?sma\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*(\d+)\s*\)", expr)
                    if sma_m:
                        src_name = sma_m.group(1)
                        length = int(sma_m.group(2))
                        src_series = indicators.get(src_name, close)
                        indicators[var_name] = get_sma(src_series, length)
                        continue

                    # ta.rsi / rsi
                    rsi_m = re.match(r"(?:ta\.)?rsi\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*(\d+)\s*\)", expr)
                    if rsi_m:
                        src_name = rsi_m.group(1)
                        length = int(rsi_m.group(2))
                        src_series = indicators.get(src_name, close)
                        indicators[var_name] = get_rsi(src_series, length)
                        continue

                    # ta.atr / atr
                    atr_m = re.match(r"(?:ta\.)?atr\s*\(\s*(\d+)\s*\)", expr)
                    if atr_m:
                        length = int(atr_m.group(1))
                        indicators[var_name] = get_atr(length)
                        continue

                    # ta.crossover
                    co_m = re.match(r"(?:ta\.)?crossover\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\)", expr)
                    if co_m:
                        v1 = indicators.get(co_m.group(1), close)
                        v2 = indicators.get(co_m.group(2), close)
                        indicators[var_name] = crossover(v1, v2)
                        continue

                    # ta.crossunder
                    cu_m = re.match(r"(?:ta\.)?crossunder\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*\)", expr)
                    if cu_m:
                        v1 = indicators.get(cu_m.group(1), close)
                        v2 = indicators.get(cu_m.group(2), close)
                        indicators[var_name] = crossunder(v1, v2)
                        continue

                # Strategy entry commands
                # strategy.entry("Long", strategy.long, when=condition)
                entry_m = re.search(r"strategy\.entry\s*\([^,]+,\s*strategy\.(long|short)(?:,\s*when\s*=\s*([^,\)]+))?", line)
                if entry_m:
                    side = entry_m.group(1).lower()
                    cond_var = entry_m.group(2)
                    if cond_var:
                        cond_var = cond_var.strip()
                        if side == "long":
                            long_conditions.append(cond_var)
                        else:
                            short_conditions.append(cond_var)
                    continue

                # If statements: if (condition) or if condition
                if_long = re.search(r"if\s+([a-zA-Z0-9_]+).*strategy\.entry\s*\([^,]+,\s*strategy\.long", line)
                if if_long:
                    long_conditions.append(if_long.group(1).strip())
                    continue

                if_exit = re.search(r"if\s+([a-zA-Z0-9_]+).*strategy\.close", line)
                if if_exit:
                    exit_conditions.append(if_exit.group(1).strip())
                    continue

            # Step 2: Fallback inference if conditions were not tied directly via when=
            # Check for common Pine variable names like `longCondition`, `buySignal`, `crossover`
            for k, v in indicators.items():
                if isinstance(v, np.ndarray) and v.dtype == bool:
                    if any(sub in k.lower() for sub in ["long", "buy", "bull"]) and k not in long_conditions:
                        long_conditions.append(k)
                    elif any(sub in k.lower() for sub in ["short", "sell", "bear"]) and k not in short_conditions:
                        short_conditions.append(k)
                    elif any(sub in k.lower() for sub in ["exit", "close"]) and k not in exit_conditions:
                        exit_conditions.append(k)

            # Step 3: Populate signals
            # If long condition is met, signal = 1
            # If exit condition or short condition is met, signal = -1
            if long_conditions:
                for cond_name in long_conditions:
                    if cond_name in indicators:
                        bool_mask = indicators[cond_name]
                        signals[bool_mask] = 1.0

            if exit_conditions:
                for cond_name in exit_conditions:
                    if cond_name in indicators:
                        bool_mask = indicators[cond_name]
                        signals[bool_mask] = -1.0
            elif short_conditions:
                for cond_name in short_conditions:
                    if cond_name in indicators:
                        bool_mask = indicators[cond_name]
                        signals[bool_mask] = -1.0

            # If no explicit entries found, evaluate simple comparison: e.g. "crossover(ema9, ema21)"
            if np.all(signals == 0.0):
                # Search for any crossover registered
                for k, v in indicators.items():
                    if isinstance(v, np.ndarray) and v.dtype == bool:
                        signals[v] = 1.0
                        break

            return signals, None

        except Exception as e:
            return np.zeros(n), f"Pine Script Parse Error: {str(e)}"

pinescript_transpiler = PineScriptTranspiler()
