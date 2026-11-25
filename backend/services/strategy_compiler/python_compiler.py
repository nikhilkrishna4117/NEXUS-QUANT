"""
Python Strategy Compiler
Safely validates and executes user-supplied Python strategy code on OHLCV pandas DataFrames.
"""
import ast
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple, Optional

# Disallowed builtins for safety
FORBIDDEN_NODES = {
    ast.Import, ast.ImportFrom,
    ast.Global, ast.Nonlocal,
    ast.AsyncFunctionDef, ast.AsyncFor, ast.AsyncWith
}

SAFE_BUILTINS = {
    "abs": abs, "min": min, "max": max, "len": len, "range": range,
    "round": round, "float": float, "int": int, "bool": bool, "str": str,
    "sum": sum, "enumerate": enumerate, "zip": zip, "print": lambda *args: None
}

class PythonStrategyCompiler:
    @staticmethod
    def validate_syntax(code_str: str) -> Tuple[bool, Optional[str]]:
        """Checks for Python AST validity and forbids dangerous imports/statements."""
        try:
            tree = ast.parse(code_str)
        except SyntaxError as e:
            return False, f"Syntax Error: {e.msg} at line {e.lineno}"

        # Check for forbidden constructs
        for node in ast.walk(tree):
            if type(node) in FORBIDDEN_NODES:
                return False, f"Security Violation: '{type(node).__name__}' statements are not permitted in sandbox."
            if isinstance(node, ast.Name) and node.id in ("__import__", "eval", "exec", "open", "os", "sys", "subprocess", "shutil"):
                return False, f"Security Violation: Access to '{node.id}' is restricted."

        return True, None

    @classmethod
    def execute(cls, code_str: str, df: pd.DataFrame) -> Tuple[np.ndarray, Optional[str]]:
        """
        Executes user code. The code should define a function:
        def generate_signals(df):
            ...
            return signals  # array/list/series of 1 (Buy), -1 (Sell), 0 (Hold)
        or directly set a variable `signals`.
        """
        is_valid, err = cls.validate_syntax(code_str)
        if not is_valid:
            return np.zeros(len(df)), err

        n = len(df)
        signals = np.zeros(n)

        # Prepare execution sandbox scope
        local_scope = {
            "df": df.copy(),
            "np": np,
            "pd": pd,
            "signals": signals
        }
        global_scope = {
            "__builtins__": SAFE_BUILTINS,
            "np": np,
            "pd": pd
        }

        try:
            compiled = compile(code_str, "<strategy_code>", "exec")
            exec(compiled, global_scope, local_scope)

            # Check if generate_signals function was defined
            if "generate_signals" in local_scope and callable(local_scope["generate_signals"]):
                res = local_scope["generate_signals"](df)
                if isinstance(res, (pd.Series, np.ndarray, list)):
                    signals = np.array(res, dtype=float)
            elif "signals" in local_scope:
                res = local_scope["signals"]
                if isinstance(res, (pd.Series, np.ndarray, list)):
                    signals = np.array(res, dtype=float)

            # Ensure correct length
            if len(signals) != n:
                padded = np.zeros(n)
                copy_len = min(len(signals), n)
                padded[-copy_len:] = signals[-copy_len:]
                signals = padded

            # Clamp signals to {-1, 0, 1}
            signals = np.clip(np.nan_to_num(signals, nan=0.0), -1.0, 1.0)
            return signals, None

        except Exception as e:
            return np.zeros(n), f"Execution Runtime Error: {str(e)}"

python_compiler = PythonStrategyCompiler()
