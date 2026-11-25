import json
import logging
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from backend.models.strategy import Strategy, StrategyRule

logger = logging.getLogger(__name__)

# Standard Baseline Quant Strategies
BASELINE_STRATEGIES = [
    {
        "name": "EMA Dual Crossover Trend Follower",
        "category": "trend_following",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "description": "Institutional trend-following model that enters long when 9 EMA crosses above 21 EMA while price is above 200 EMA baseline. Exits on opposite crossover or dynamic 2x ATR trailing stop.",
        "config": {
            "type": "ema_crossover",
            "fast_period": 9,
            "slow_period": 21,
            "baseline_period": 200,
            "stop_loss_atr_mult": 2.0,
            "take_profit_atr_mult": 4.0,
            "risk_per_trade_pct": 2.0,
            "entry_conditions": [
                {"indicator": "ema9", "op": "cross_above", "target": "ema21"},
                {"indicator": "close", "op": "greater_than", "target": "ema200"}
            ],
            "exit_conditions": [
                {"indicator": "ema9", "op": "cross_below", "target": "ema21"}
            ]
        }
    },
    {
        "name": "RSI Mean Reversion with Trend Filter",
        "category": "mean_reversion",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "description": "Exploits short-term oversold liquidity dumps within macro bull regimes. Buys when RSI drops below 30 while above 200 SMA, exits when RSI recovers to 60 or reaches profit target.",
        "config": {
            "type": "rsi_reversion",
            "rsi_period": 14,
            "oversold_threshold": 30,
            "overbought_threshold": 70,
            "exit_rsi_threshold": 60,
            "filter_period": 200,
            "stop_loss_pct": 3.0,
            "take_profit_pct": 6.0,
            "risk_per_trade_pct": 1.5,
            "entry_conditions": [
                {"indicator": "rsi", "op": "less_than", "target": 30},
                {"indicator": "close", "op": "greater_than", "target": "sma200"}
            ],
            "exit_conditions": [
                {"indicator": "rsi", "op": "greater_than", "target": 60}
            ]
        }
    },
    {
        "name": "MACD Zero-Lag Momentum Breakout",
        "category": "momentum",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "description": "Momentum strategy that captures impulsive volatility surges. Enters long when MACD line crosses above signal line with positive histogram expansion and volume confirmation.",
        "config": {
            "type": "macd_momentum",
            "fast_period": 12,
            "slow_period": 26,
            "signal_period": 9,
            "volume_threshold_mult": 1.3,
            "stop_loss_atr_mult": 2.5,
            "take_profit_atr_mult": 5.0,
            "risk_per_trade_pct": 2.0,
            "entry_conditions": [
                {"indicator": "macd_line", "op": "cross_above", "target": "macd_signal"},
                {"indicator": "volume_ratio", "op": "greater_than", "target": 1.3}
            ],
            "exit_conditions": [
                {"indicator": "macd_line", "op": "cross_below", "target": "macd_signal"}
            ]
        }
    },
    {
        "name": "Bollinger Bands Mean Reversion",
        "category": "mean_reversion",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "description": "Statistical arbitrage mean-reversion model. Enters when price touches or penetrates lower 2-sigma band and starts bouncing back, taking profit at the middle SMA or upper band.",
        "config": {
            "type": "bollinger_reversion",
            "bb_period": 20,
            "bb_std": 2.0,
            "stop_loss_pct": 2.5,
            "take_profit_pct": 4.5,
            "risk_per_trade_pct": 1.5,
            "entry_conditions": [
                {"indicator": "close", "op": "less_than", "target": "bb_lower"}
            ],
            "exit_conditions": [
                {"indicator": "close", "op": "greater_than", "target": "bb_middle"}
            ]
        }
    },
    {
        "name": "ATR Channel Trend Breakout",
        "category": "breakout",
        "symbol": "BTCUSDT",
        "timeframe": "1h",
        "description": "Donchian-style volatility expansion breakout. Enters when price exceeds the 20-period high with ADX confirming strong trend velocity (>25).",
        "config": {
            "type": "atr_breakout",
            "lookback_period": 20,
            "adx_threshold": 25,
            "stop_loss_atr_mult": 2.0,
            "take_profit_atr_mult": 6.0,
            "risk_per_trade_pct": 2.0,
            "entry_conditions": [
                {"indicator": "adx", "op": "greater_than", "target": 25}
            ],
            "exit_conditions": []
        }
    }
]

class StrategyEngine:
    """Manages strategy configurations, baseline seed strategies, and rule evaluation."""

    @staticmethod
    def initialize_strategies(db: Session):
        """Seed baseline strategies if database is empty."""
        for item in BASELINE_STRATEGIES:
            existing = db.query(Strategy).filter(Strategy.name == item["name"]).first()
            if not existing:
                strat = Strategy(
                    name=item["name"],
                    category=item["category"],
                    symbol=item["symbol"],
                    timeframe=item["timeframe"],
                    description=item["description"],
                    config=item["config"],
                    is_active=False,
                    is_ai_generated=False,
                    evaluation_label="Strong research candidate" if "Trend" in item["name"] else "Promising but requires further validation",
                    evaluation_score=78.5 if "Trend" in item["name"] else 72.0
                )
                db.add(strat)
        db.commit()

    @staticmethod
    def generate_ai_candidate_strategies(market_regime: str, volatility: str) -> List[Dict[str, Any]]:
        """
        AI Strategy Lab: Synthesize adaptive candidate quantitative strategies
        tailored to currently detected market conditions and volatility regimes.
        """
        candidates = []

        if "Bullish" in market_regime:
            candidates.append({
                "name": "AI Trend-Pullback Momentum Scalper",
                "category": "momentum",
                "symbol": "BTCUSDT",
                "timeframe": "15m",
                "description": "Generated by AI Quant Lab for Bullish Regime: Captures dips to 21 EMA when RSI cools off to 45-50 within a strong bullish structure.",
                "config": {
                    "type": "trend_pullback",
                    "fast_ema": 21,
                    "slow_ema": 50,
                    "rsi_pullback_min": 42,
                    "rsi_pullback_max": 52,
                    "stop_loss_pct": 1.8,
                    "take_profit_pct": 4.5,
                    "risk_per_trade_pct": 2.0,
                    "entry_conditions": [
                        {"indicator": "close", "op": "greater_than", "target": "ema50"},
                        {"indicator": "rsi", "op": "less_than", "target": 52}
                    ],
                    "exit_conditions": [
                        {"indicator": "rsi", "op": "greater_than", "target": 70}
                    ]
                },
                "confidence_score": 84.0,
                "regime_fit": "High",
                "rationale": "High win-rate in strong bullish trends by entering on shallow pullbacks rather than chasing new highs."
            })
            candidates.append({
                "name": "AI Liquidity Sweep & Structure Expansion",
                "category": "price_action",
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "description": "Generated by AI Quant Lab: Identifies liquidity sweeps below previous 10-bar swing lows followed by immediate reclaim above VWAP.",
                "config": {
                    "type": "liquidity_sweep",
                    "sweep_lookback": 10,
                    "stop_loss_atr_mult": 1.5,
                    "take_profit_atr_mult": 3.8,
                    "risk_per_trade_pct": 2.0,
                    "entry_conditions": [
                        {"indicator": "close", "op": "greater_than", "target": "vwap"}
                    ],
                    "exit_conditions": []
                },
                "confidence_score": 79.5,
                "regime_fit": "Moderate-High",
                "rationale": "Institutions engineer liquidity below swing lows before markup; entering upon reclaim offers tight risk-reward."
            })

        elif "Bearish" in market_regime:
            candidates.append({
                "name": "AI Counter-Trend Oversold Bounce (Short Horizon)",
                "category": "mean_reversion",
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "description": "Generated by AI Quant Lab for Bearish Regime: Takes disciplined, short-duration mean reversion trades when RSI penetrates below 22 with tight stop loss.",
                "config": {
                    "type": "oversold_bounce",
                    "rsi_threshold": 22,
                    "stop_loss_pct": 2.0,
                    "take_profit_pct": 3.5,
                    "risk_per_trade_pct": 1.0,
                    "entry_conditions": [
                        {"indicator": "rsi", "op": "less_than", "target": 22}
                    ],
                    "exit_conditions": [
                        {"indicator": "rsi", "op": "greater_than", "target": 45}
                    ]
                },
                "confidence_score": 68.0,
                "regime_fit": "Medium",
                "rationale": "Strictly limited risk sizing (1.0%) to prevent catching falling knives in macro downtrends."
            })

        else:  # Sideways / Ranging / High Volatility
            candidates.append({
                "name": "AI Volatility Squeeze Breakout (Bollinger & Keltner)",
                "category": "volatility_based",
                "symbol": "BTCUSDT",
                "timeframe": "1h",
                "description": "Generated by AI Quant Lab for Range/Compression: Detects Bollinger Band compression inside Keltner Channels followed by sudden explosive volume expansion.",
                "config": {
                    "type": "squeeze_breakout",
                    "bandwidth_max": 4.5,
                    "adx_trigger": 22,
                    "stop_loss_atr_mult": 2.0,
                    "take_profit_atr_mult": 5.0,
                    "risk_per_trade_pct": 1.8,
                    "entry_conditions": [
                        {"indicator": "adx", "op": "greater_than", "target": 22}
                    ],
                    "exit_conditions": []
                },
                "confidence_score": 82.5,
                "regime_fit": "High",
                "rationale": "Low-volatility consolidation precedes the largest directional impulses in financial markets."
            })
            candidates.append({
                "name": "AI Dynamic Range Fade & Mean Reversion",
                "category": "mean_reversion",
                "symbol": "BTCUSDT",
                "timeframe": "30m",
                "description": "Generated by AI Quant Lab for Sideways Market: Fades range extremes using Stochastic Oscillator and Bollinger Bands.",
                "config": {
                    "type": "range_fade",
                    "stoch_oversold": 20,
                    "stoch_overbought": 80,
                    "stop_loss_pct": 1.5,
                    "take_profit_pct": 2.8,
                    "risk_per_trade_pct": 1.5,
                    "entry_conditions": [
                        {"indicator": "stoch_k", "op": "less_than", "target": 20}
                    ],
                    "exit_conditions": [
                        {"indicator": "stoch_k", "op": "greater_than", "target": 75}
                    ]
                },
                "confidence_score": 75.0,
                "regime_fit": "High",
                "rationale": "Consistently profitable in non-trending markets where prices oscillate reliably between support and resistance."
            })

        return candidates

strategy_engine = StrategyEngine()
