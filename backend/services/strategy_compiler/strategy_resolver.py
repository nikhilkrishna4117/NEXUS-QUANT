"""
Unified Strategy Resolver
Dispatches strategy execution to Python, Pine Script, Natural Language, or Structured Config compilers.
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional

from backend.services.strategy_compiler.python_compiler import python_compiler
from backend.services.strategy_compiler.pinescript_transpiler import pinescript_transpiler
from backend.services.strategy_compiler.natural_language_compiler import natural_language_compiler

class StrategyResolver:
    """
    Unified entrypoint for compiling and executing custom algorithmic strategies.
    Supports:
    - format: 'python'
    - format: 'pine'
    - format: 'english'
    - format: 'config' (Structured dictionary)
    """

    @classmethod
    def resolve_signals(
        cls,
        format_type: str,
        code_or_rules: str,
        df: pd.DataFrame,
        custom_config: Optional[Dict[str, Any]] = None
    ) -> Tuple[np.ndarray, Dict[str, Any], Optional[str]]:
        fmt = (format_type or "config").lower().strip()
        meta: Dict[str, Any] = {"format": fmt}

        if df.empty:
            return np.zeros(0), meta, "Empty historical DataFrame."

        if fmt == "python":
            signals, err = python_compiler.execute(code_or_rules, df)
            meta["engine"] = "Python AST Sandbox"
            return signals, meta, err

        elif fmt in ("pine", "pinescript"):
            signals, err = pinescript_transpiler.parse_and_execute(code_or_rules, df)
            meta["engine"] = "Pine Script v5 Transpiler"
            return signals, meta, err

        elif fmt in ("english", "plain_english", "natural_language"):
            signals, parsed_cfg, err = natural_language_compiler.compile_rules(code_or_rules, df)
            meta["engine"] = "Natural Language Rule Compiler"
            meta["parsed_rules"] = parsed_cfg
            return signals, meta, err

        else:
            # Fallback to structured config evaluation
            cfg = custom_config or {}
            strat_type = cfg.get("type", "ema_crossover")
            close = df["close"].values
            n = len(df)
            signals = np.zeros(n)

            if strat_type == "ema_crossover":
                fast_p = int(cfg.get("fast_period", 9))
                slow_p = int(cfg.get("slow_period", 21))
                fast = pd.Series(close).ewm(span=fast_p, adjust=False).mean().values
                slow = pd.Series(close).ewm(span=slow_p, adjust=False).mean().values
                for i in range(1, n):
                    if fast[i - 1] <= slow[i - 1] and fast[i] > slow[i]:
                        signals[i] = 1.0
                    elif fast[i - 1] >= slow[i - 1] and fast[i] < slow[i]:
                        signals[i] = -1.0

            elif strat_type == "rsi_reversion":
                delta = pd.Series(close).diff()
                gain = delta.clip(lower=0)
                loss = -delta.clip(upper=0)
                avg_gain = gain.ewm(alpha=1/14, adjust=False).mean()
                avg_loss = loss.ewm(alpha=1/14, adjust=False).mean()
                rs = avg_gain / (avg_loss + 1e-10)
                rsi = (100 - (100 / (1 + rs))).values
                os_level = float(cfg.get("oversold_threshold", 30))
                for i in range(1, n):
                    if rsi[i - 1] >= os_level and rsi[i] < os_level:
                        signals[i] = 1.0
                    elif rsi[i] > 60:
                        signals[i] = -1.0

            meta["engine"] = "Standard Config Engine"
            return signals, meta, None

strategy_resolver = StrategyResolver()
