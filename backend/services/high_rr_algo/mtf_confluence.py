import logging
from typing import Dict, Any, List, Optional
from backend.services.high_rr_algo.price_action import price_action_engine
from backend.services.high_rr_algo.smc_engine import smc_engine
from backend.services.high_rr_algo.ict_engine import ict_engine

logger = logging.getLogger(__name__)

class MTFConfluenceEngine:
    """
    Multi-Timeframe (MTF) Confluence & High-R:R Sniper Execution Engine.
    Combines:
    - Higher Timeframe (4H/1H) Macro Liquidity Bias.
    - Lower Timeframe (15m/5m) Sniper Trigger (Price Action, SMC, or ICT).
    - Precision Position Sizing from account equity & stop distance.
    """

    @classmethod
    def determine_htf_bias(cls, htf_candles: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Determines institutional directional bias from 4H or 1H candles.
        Analyzes swing structure, EMA trend, and major resting liquidity pools.
        """
        if len(htf_candles) < 20:
            return {"bias": "NEUTRAL", "trend_strength": 0.5}

        closes = [float(c["close"]) for c in htf_candles]
        highs = [float(c["high"]) for c in htf_candles]
        lows = [float(c["low"]) for c in htf_candles]

        # Calculate 21 and 50 EMA on HTF
        ema21 = float(closes[-1])
        ema50 = float(closes[-1])
        if len(closes) >= 50:
            import pandas as pd
            s = pd.Series(closes)
            ema21 = float(s.ewm(span=21, adjust=False).mean().iloc[-1])
            ema50 = float(s.ewm(span=50, adjust=False).mean().iloc[-1])

        current_price = closes[-1]
        eq_highs = max(highs[-20:])
        eq_lows = min(lows[-20:])

        if current_price > ema21 and ema21 > ema50:
            bias = "BULLISH"
            target_liquidity = eq_highs
            invalidation = eq_lows
        elif current_price < ema21 and ema21 < ema50:
            bias = "BEARISH"
            target_liquidity = eq_lows
            invalidation = eq_highs
        else:
            bias = "NEUTRAL"
            target_liquidity = eq_highs if current_price >= (eq_highs + eq_lows) / 2 else eq_lows
            invalidation = eq_lows if bias == "BULLISH" else eq_highs

        return {
            "bias": bias,
            "current_price": current_price,
            "target_liquidity": target_liquidity,
            "macro_invalidation": invalidation,
            "ema21": round(ema21, 2),
            "ema50": round(ema50, 2)
        }

    @classmethod
    def calculate_lot_size(
        cls,
        equity: float,
        risk_pct: float,
        entry_price: float,
        stop_loss: float,
        symbol: str = "BTCUSDT"
    ) -> float:
        """
        Calculates exact position lot size based on account equity,
        user risk % (0.5% - 1.0%), and stop loss distance.
        """
        dollar_risk = equity * (risk_pct / 100.0)
        stop_distance = abs(entry_price - stop_loss)

        if stop_distance <= 0:
            return 0.01

        # For Crypto (1 unit = 1 BTC)
        if any(c in symbol.upper() for c in ["USDT", "BTC", "ETH"]):
            lots = dollar_risk / stop_distance
            return max(0.001, round(lots, 4))

        # For Forex (Standard Lot = 100,000 units, pip value ~$10 per lot)
        elif any(c in symbol.upper() for c in ["EUR", "GBP", "JPY", "USD", "AUD"]):
            pips = stop_distance / 0.0001
            lot_size = dollar_risk / (pips * 10.0 + 1e-10)
            return max(0.01, round(lot_size, 2))

        # For Gold / Metals (1 lot = 100 oz, $1 move = $100)
        elif any(c in symbol.upper() for c in ["XAU", "GOLD"]):
            lot_size = dollar_risk / (stop_distance * 100.0)
            return max(0.01, round(lot_size, 2))

        # Default standard equities / indices
        lots = dollar_risk / stop_distance
        return max(0.01, round(lots, 2))

    @classmethod
    def scan_mtf_confluence(
        cls,
        htf_candles: List[Dict[str, Any]],
        ltf_candles: List[Dict[str, Any]],
        equity: float = 100000.0,
        risk_pct: float = 1.0
    ) -> Optional[Dict[str, Any]]:
        """
        Runs Multi-Timeframe Confluence evaluation.
        1. Establishes HTF Bias.
        2. Scans LTF for Price Action, SMC, and ICT setups.
        3. Validates that LTF signal direction matches HTF Bias.
        4. Sizes lot to exact user risk %.
        """
        htf = cls.determine_htf_bias(htf_candles)
        bias = htf["bias"]

        # Run LTF detectors in priority order
        signal = (
            ict_engine.generate_signal(ltf_candles) or
            smc_engine.generate_signal(ltf_candles) or
            price_action_engine.generate_signal(ltf_candles)
        )

        if not signal:
            return None

        # Confluence check: Only execute in the direction of the HTF bias (unless neutral)
        signal_dir = "BULLISH" if signal["side"] == "BUY" else "BEARISH"
        if bias != "NEUTRAL" and signal_dir != bias:
            logger.info(f"Signal filtered: {signal['strategy']} {signal['side']} opposes HTF bias {bias}.")
            return None

        # Compute exact lot size
        symbol = signal["symbol"]
        lot_size = cls.calculate_lot_size(
            equity=equity,
            risk_pct=risk_pct,
            entry_price=signal["entry_price"],
            stop_loss=signal["stop_loss"],
            symbol=symbol
        )

        return {
            "mtf_confluence": True,
            "htf_bias": bias,
            "strategy": signal["strategy"],
            "symbol": symbol,
            "side": signal["side"],
            "entry_price": signal["entry_price"],
            "stop_loss": signal["stop_loss"],
            "take_profit_1": signal["take_profit_1"],
            "take_profit_2": signal["take_profit_2"],
            "take_profit_3": signal["take_profit_3"],
            "risk_reward_ratio": signal["risk_reward_ratio"],
            "lot_size": lot_size,
            "risk_dollars": round(equity * (risk_pct / 100.0), 2),
            "rationale": f"[MTF Confluence: {bias} HTF Bias] {signal['rationale']}",
            "confidence": signal["confidence"]
        }

mtf_confluence_engine = MTFConfluenceEngine()
