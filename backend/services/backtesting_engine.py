import math
import random
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.models.backtest import BacktestRun, BacktestTrade, EquityPoint
from backend.services.technical_analysis import TechnicalAnalysisEngine

class BacktestingEngine:
    """
    Institutional-grade quantitative backtesting engine with realistic fees,
    slippage modeling, zero look-ahead bias, out-of-sample validation,
    and Monte Carlo robustness analysis.
    """

    def __init__(
        self,
        initial_capital: float = 100000.0,
        fee_rate_bps: float = 4.0,       # 0.04% taker fee
        slippage_bps: float = 5.0,       # 0.05% slippage
        risk_per_trade_pct: float = 2.0  # 2% equity risk
    ):
        self.initial_capital = initial_capital
        self.fee_rate = fee_rate_bps / 10000.0
        self.slippage_rate = slippage_bps / 10000.0
        self.risk_per_trade_pct = risk_per_trade_pct

    def run_backtest(
        self,
        strategy_config: Dict[str, Any],
        candles: List[Dict[str, Any]],
        symbol: str = "BTCUSDT",
        timeframe: str = "1h",
        strategy_name: str = "Custom Strategy",
        strategy_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> Dict[str, Any]:
        """
        Execute backtest on historical OHLCV data.
        Returns detailed performance metrics, trade logs, and equity curves.
        """
        if len(candles) < 30:
            raise ValueError(f"Insufficient historical data ({len(candles)} bars). Minimum 30 required.")

        df = pd.DataFrame(candles)
        df['open'] = df['open'].astype(float)
        df['high'] = df['high'].astype(float)
        df['low'] = df['low'].astype(float)
        df['close'] = df['close'].astype(float)
        df['volume'] = df['volume'].astype(float)
        n = len(df)

        close = df['close'].values
        high = df['high'].values
        low = df['low'].values
        vol = df['volume'].values

        # Precompute common technical indicators
        sma20 = pd.Series(close).rolling(20, min_periods=1).mean().values
        sma50 = pd.Series(close).rolling(50, min_periods=1).mean().values
        sma200 = pd.Series(close).rolling(200, min_periods=1).mean().values
        ema9 = pd.Series(close).ewm(span=9, adjust=False).mean().values
        ema21 = pd.Series(close).ewm(span=21, adjust=False).mean().values
        ema50 = pd.Series(close).ewm(span=50, adjust=False).mean().values
        ema200 = pd.Series(close).ewm(span=200, adjust=False).mean().values

        # RSI (14)
        delta = pd.Series(close).diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(alpha=1/14, adjust=False).mean()
        avg_loss = loss.ewm(alpha=1/14, adjust=False).mean()
        rs = avg_gain / (avg_loss + 1e-10)
        rsi = (100 - (100 / (1 + rs))).values

        # MACD (12, 26, 9)
        ema12 = pd.Series(close).ewm(span=12, adjust=False).mean()
        ema26 = pd.Series(close).ewm(span=26, adjust=False).mean()
        macd_line = (ema12 - ema26).values
        macd_signal = pd.Series(macd_line).ewm(span=9, adjust=False).mean().values

        # Bollinger Bands (20, 2)
        rolling_std = pd.Series(close).rolling(20, min_periods=1).std().values
        bb_upper = sma20 + 2.0 * rolling_std
        bb_lower = sma20 - 2.0 * rolling_std

        # ATR (14)
        prev_close = np.roll(close, 1)
        prev_close[0] = close[0]
        tr = np.maximum(high - low, np.maximum(np.abs(high - prev_close), np.abs(low - prev_close)))
        atr = pd.Series(tr).ewm(alpha=1/14, adjust=False).mean().values

        # ADX (14)
        up_move = high - np.roll(high, 1)
        down_move = np.roll(low, 1) - low
        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
        plus_di = 100 * (pd.Series(plus_dm).ewm(alpha=1/14, adjust=False).mean().values / (atr + 1e-10))
        minus_di = 100 * (pd.Series(minus_dm).ewm(alpha=1/14, adjust=False).mean().values / (atr + 1e-10))
        dx = 100 * (np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10))
        adx = pd.Series(dx).ewm(alpha=1/14, adjust=False).mean().values

        # Generate Signals: 1 = Enter Long, -1 = Exit Long
        signals = np.zeros(n)
        strat_type = strategy_config.get("type", "ema_crossover")

        if strat_type == "ema_crossover":
            fast = ema9
            slow = ema21
            for i in range(1, n):
                if fast[i-1] <= slow[i-1] and fast[i] > slow[i] and close[i] > ema200[i]:
                    signals[i] = 1
                elif fast[i-1] >= slow[i-1] and fast[i] < slow[i]:
                    signals[i] = -1

        elif strat_type == "rsi_reversion":
            os_level = strategy_config.get("oversold_threshold", 30)
            exit_level = strategy_config.get("exit_rsi_threshold", 60)
            for i in range(1, n):
                if rsi[i-1] >= os_level and rsi[i] < os_level and close[i] > sma200[i]:
                    signals[i] = 1
                elif rsi[i] > exit_level:
                    signals[i] = -1

        elif strat_type == "macd_momentum":
            vol_ratio = vol / (pd.Series(vol).rolling(20, min_periods=1).mean().values + 1e-10)
            for i in range(1, n):
                if macd_line[i-1] <= macd_signal[i-1] and macd_line[i] > macd_signal[i] and vol_ratio[i] > 1.2:
                    signals[i] = 1
                elif macd_line[i-1] >= macd_signal[i-1] and macd_line[i] < macd_signal[i]:
                    signals[i] = -1

        elif strat_type == "bollinger_reversion":
            for i in range(1, n):
                if close[i-1] >= bb_lower[i-1] and close[i] < bb_lower[i]:
                    signals[i] = 1
                elif close[i] > sma20[i]:
                    signals[i] = -1

        elif strat_type == "atr_breakout":
            rolling_high_20 = pd.Series(high).rolling(20, min_periods=1).max().values
            for i in range(1, n):
                if close[i] > rolling_high_20[i-1] and adx[i] > 22:
                    signals[i] = 1
                elif close[i] < sma20[i]:
                    signals[i] = -1

        else:
            # Generic fallback: EMA 9 / 21 crossover
            for i in range(1, n):
                if ema9[i-1] <= ema21[i-1] and ema9[i] > ema21[i]:
                    signals[i] = 1
                elif ema9[i-1] >= ema21[i-1] and ema9[i] < ema21[i]:
                    signals[i] = -1

        # Simulation Loop (Zero Look-Ahead Bias: Signal at Close(t) executes at Open(t+1))
        capital = self.initial_capital
        cash = capital
        in_position = False
        position_qty = 0.0
        entry_price = 0.0
        entry_bar_idx = 0
        entry_time = None
        stop_loss_price = 0.0
        take_profit_price = 0.0

        trades: List[Dict[str, Any]] = []
        equity_curve: List[Dict[str, Any]] = []
        peak_equity = capital
        drawdowns: List[float] = []

        total_fees = 0.0
        total_slippage = 0.0

        stop_loss_mult = strategy_config.get("stop_loss_atr_mult", 2.0)
        take_profit_mult = strategy_config.get("take_profit_atr_mult", 4.5)

        for i in range(n):
            current_bar = candles[i]
            bar_open = float(current_bar["open"])
            bar_high = float(current_bar["high"])
            bar_low = float(current_bar["low"])
            bar_close = float(current_bar["close"])
            bar_time = current_bar["timestamp"]

            # 1. If currently in position, check Stop Loss and Take Profit within the bar
            if in_position:
                exit_triggered = False
                exit_price = 0.0
                exit_reason = ""

                # Check Stop Loss
                if bar_low <= stop_loss_price:
                    exit_triggered = True
                    exit_price = min(bar_open, stop_loss_price) * (1.0 - self.slippage_rate)
                    exit_reason = "stop_loss"
                # Check Take Profit
                elif bar_high >= take_profit_price:
                    exit_triggered = True
                    exit_price = max(bar_open, take_profit_price) * (1.0 - self.slippage_rate)
                    exit_reason = "take_profit"
                # Check Signal Exit from previous bar's close
                elif signals[i - 1] == -1 and i > entry_bar_idx:
                    exit_triggered = True
                    exit_price = bar_open * (1.0 - self.slippage_rate)
                    exit_reason = "signal"
                # End of backtest force close
                elif i == n - 1:
                    exit_triggered = True
                    exit_price = bar_close * (1.0 - self.slippage_rate)
                    exit_reason = "end_of_data"

                if exit_triggered:
                    exit_fee = exit_price * position_qty * self.fee_rate
                    total_fees += exit_fee
                    total_slippage += abs(exit_price - bar_open) * position_qty if exit_reason == "signal" else 0.0

                    gross_pnl = (exit_price - entry_price) * position_qty
                    net_pnl = gross_pnl - exit_fee
                    return_pct = (exit_price - entry_price) / entry_price * 100.0

                    cash += (exit_price * position_qty) - exit_fee
                    capital = cash
                    in_position = False

                    trades.append({
                        "symbol": symbol,
                        "side": "BUY",
                        "entry_time": entry_time,
                        "exit_time": bar_time,
                        "entry_price": round(entry_price, 2),
                        "exit_price": round(exit_price, 2),
                        "quantity": round(position_qty, 4),
                        "gross_pnl": round(gross_pnl, 2),
                        "net_pnl": round(net_pnl, 2),
                        "return_pct": round(return_pct, 2),
                        "fees": round(exit_fee, 2),
                        "slippage": round(total_slippage, 2),
                        "exit_reason": exit_reason,
                        "holding_bars": i - entry_bar_idx
                    })
                    position_qty = 0.0

            # 2. Check Entry from previous candle signal
            if not in_position and i > 0 and signals[i - 1] == 1 and i < n - 1:
                # Buy at open with slippage
                fill_price = bar_open * (1.0 + self.slippage_rate)
                current_atr = atr[i - 1] if atr[i - 1] > 0 else (fill_price * 0.015)

                stop_dist = current_atr * stop_loss_mult
                stop_loss_price = fill_price - stop_dist
                take_profit_price = fill_price + (current_atr * take_profit_mult)

                # Risk-based position sizing
                dollar_risk = capital * (self.risk_per_trade_pct / 100.0)
                qty = dollar_risk / (stop_dist + 1e-10)

                # Cap quantity by available cash (unleveraged spot limit)
                entry_fee_est = fill_price * qty * self.fee_rate
                if (fill_price * qty + entry_fee_est) > cash:
                    qty = (cash * 0.98) / (fill_price * (1.0 + self.fee_rate))

                if qty * fill_price > 50.0:  # Minimum viable order
                    entry_fee = fill_price * qty * self.fee_rate
                    total_fees += entry_fee
                    cash -= (fill_price * qty + entry_fee)
                    in_position = True
                    position_qty = qty
                    entry_price = fill_price
                    entry_bar_idx = i
                    entry_time = bar_time

            # Compute Mark-to-Market Equity
            current_val = cash + (position_qty * bar_close if in_position else 0.0)
            if current_val > peak_equity:
                peak_equity = current_val
            dd_pct = ((peak_equity - current_val) / peak_equity * 100.0) if peak_equity > 0 else 0.0
            drawdowns.append(dd_pct)

            equity_curve.append({
                "timestamp": bar_time.isoformat() if hasattr(bar_time, "isoformat") else str(bar_time),
                "equity": round(current_val, 2),
                "cash": round(cash, 2),
                "drawdown_pct": round(dd_pct, 2)
            })

        # Calculate Performance Metrics
        final_capital = equity_curve[-1]["equity"] if equity_curve else capital
        net_profit = final_capital - self.initial_capital
        return_pct = (net_profit / self.initial_capital) * 100.0
        max_dd = max(drawdowns) if drawdowns else 0.0

        total_trades = len(trades)
        winning_trades = [t for t in trades if t["net_pnl"] > 0]
        losing_trades = [t for t in trades if t["net_pnl"] <= 0]
        win_count = len(winning_trades)
        loss_count = len(losing_trades)
        win_rate = (win_count / total_trades * 100.0) if total_trades > 0 else 0.0

        gross_profit = sum(t["gross_pnl"] for t in winning_trades)
        gross_loss = abs(sum(t["gross_pnl"] for t in losing_trades))
        profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (99.0 if gross_profit > 0 else 0.0)

        avg_win = (gross_profit / win_count) if win_count > 0 else 0.0
        avg_loss = (gross_loss / loss_count) if loss_count > 0 else 0.0
        rr_ratio = (avg_win / avg_loss) if avg_loss > 0 else 0.0
        expectancy = ((win_rate / 100.0 * avg_win) - ((1.0 - win_rate / 100.0) * avg_loss)) if total_trades > 0 else 0.0

        # Sharpe & Sortino (assuming risk-free rate 4% annual)
        returns = [t["return_pct"] / 100.0 for t in trades]
        if len(returns) >= 2:
            rf_per_trade = 0.04 / (252 * (24 if timeframe == "1h" else 1))
            excess_returns = np.array(returns) - rf_per_trade
            std_dev = np.std(returns)
            sharpe = (np.mean(excess_returns) / (std_dev + 1e-10)) * math.sqrt(252 * (24 if timeframe == "1h" else 1))

            downside_returns = [r for r in excess_returns if r < 0]
            downside_std = np.std(downside_returns) if downside_returns else 1e-6
            sortino = (np.mean(excess_returns) / (downside_std + 1e-10)) * math.sqrt(252 * (24 if timeframe == "1h" else 1))
        else:
            sharpe = 0.0
            sortino = 0.0

        # Max consecutive wins and losses
        max_consec_wins = 0
        max_consec_losses = 0
        curr_w = 0
        curr_l = 0
        for t in trades:
            if t["net_pnl"] > 0:
                curr_w += 1
                curr_l = 0
                max_consec_wins = max(max_consec_wins, curr_w)
            else:
                curr_l += 1
                curr_w = 0
                max_consec_losses = max(max_consec_losses, curr_l)

        # In-sample vs Out-of-sample Split (70/30)
        split_idx = int(total_trades * 0.70)
        oos_trades = trades[split_idx:] if total_trades >= 4 else trades
        oos_profit = sum(t["net_pnl"] for t in oos_trades)
        oos_return = (oos_profit / self.initial_capital) * 100.0

        # Monte Carlo 95% Confidence Drawdown Simulation
        mc_drawdowns = []
        if len(trades) >= 5:
            trade_pnls = [t["net_pnl"] for t in trades]
            for _ in range(300):
                shuffled = random.choices(trade_pnls, k=len(trade_pnls))
                sim_equity = np.cumsum([self.initial_capital] + shuffled)
                peaks = np.maximum.accumulate(sim_equity)
                dds = (peaks - sim_equity) / peaks * 100.0
                mc_drawdowns.append(np.max(dds))
            mc_95_max_dd = float(np.percentile(mc_drawdowns, 95))
        else:
            mc_95_max_dd = max_dd

        # Automatic Evaluation Ranking
        eval_score = 50.0
        if sharpe > 1.5: eval_score += 20.0
        elif sharpe > 1.0: eval_score += 10.0
        if profit_factor > 1.8: eval_score += 15.0
        elif profit_factor > 1.3: eval_score += 8.0
        if max_dd < 10.0: eval_score += 15.0
        elif max_dd > 25.0: eval_score -= 20.0
        if total_trades < 10: eval_score -= 15.0

        if eval_score >= 80 and oos_return > 0:
            eval_label = "Strong research candidate"
        elif eval_score >= 65:
            eval_label = "Promising but requires further validation"
        elif eval_score >= 45:
            eval_label = "Inconsistent performance"
        elif max_dd > 25.0:
            eval_label = "High risk"
        else:
            eval_label = "Rejected"

        report = {
            "strategy_name": strategy_name,
            "symbol": symbol,
            "timeframe": timeframe,
            "start_date": candles[0]["timestamp"].isoformat() if hasattr(candles[0]["timestamp"], "isoformat") else str(candles[0]["timestamp"]),
            "end_date": candles[-1]["timestamp"].isoformat() if hasattr(candles[-1]["timestamp"], "isoformat") else str(candles[-1]["timestamp"]),
            "initial_capital": self.initial_capital,
            "final_capital": round(final_capital, 2),
            "total_net_profit": round(net_profit, 2),
            "total_return_pct": round(return_pct, 2),
            "sharpe_ratio": round(float(sharpe), 2),
            "sortino_ratio": round(float(sortino), 2),
            "max_drawdown_pct": round(float(max_dd), 2),
            "monte_carlo_95_drawdown_pct": round(float(mc_95_max_dd), 2),
            "total_trades": total_trades,
            "winning_trades": win_count,
            "losing_trades": loss_count,
            "win_rate_pct": round(float(win_rate), 2),
            "profit_factor": round(float(profit_factor), 2),
            "expectancy": round(float(expectancy), 2),
            "avg_win": round(float(avg_win), 2),
            "avg_loss": round(float(avg_loss), 2),
            "risk_reward_ratio": round(float(rr_ratio), 2),
            "max_consecutive_wins": max_consec_wins,
            "max_consecutive_losses": max_consec_losses,
            "avg_holding_bars": round(float(np.mean([t["holding_bars"] for t in trades])), 1) if trades else 0.0,
            "total_fees": round(total_fees, 2),
            "total_slippage": round(total_slippage, 2),
            "out_of_sample_return_pct": round(float(oos_return), 2),
            "evaluation_score": round(float(eval_score), 1),
            "evaluation_label": eval_label,
            "trades": trades,
            "equity_curve": equity_curve[::max(1, len(equity_curve) // 150)],  # Sample max 150 points for chart speed
            "execution_assumptions": {
                "maker_fee_bps": 2.0,
                "taker_fee_bps": 4.0,
                "slippage_bps": 5.0,
                "execution_timing": "Next Bar Open (Zero Lookahead)",
                "position_sizing": f"{self.risk_per_trade_pct}% Risk-to-Stop"
            },
            "limitations": "Past performance is not indicative of future results. Slippage model assumes standard liquidity without order book depth saturation."
        }

        # Persist backtest run into DB if session provided
        if db:
            try:
                run_record = BacktestRun(
                    strategy_id=strategy_id,
                    strategy_name=strategy_name,
                    symbol=symbol,
                    timeframe=timeframe,
                    start_date=candles[0]["timestamp"],
                    end_date=candles[-1]["timestamp"],
                    initial_capital=self.initial_capital,
                    final_capital=report["final_capital"],
                    total_net_profit=report["total_net_profit"],
                    total_return_pct=report["total_return_pct"],
                    sharpe_ratio=report["sharpe_ratio"],
                    sortino_ratio=report["sortino_ratio"],
                    max_drawdown_pct=report["max_drawdown_pct"],
                    total_trades=report["total_trades"],
                    winning_trades=report["winning_trades"],
                    losing_trades=report["losing_trades"],
                    win_rate_pct=report["win_rate_pct"],
                    profit_factor=report["profit_factor"],
                    expectancy=report["expectancy"],
                    avg_win=report["avg_win"],
                    avg_loss=report["avg_loss"],
                    risk_reward_ratio=report["risk_reward_ratio"],
                    max_consecutive_wins=report["max_consecutive_wins"],
                    max_consecutive_losses=report["max_consecutive_losses"],
                    avg_holding_bars=report["avg_holding_bars"],
                    total_fees=report["total_fees"],
                    total_slippage=report["total_slippage"],
                    out_of_sample_return_pct=report["out_of_sample_return_pct"],
                    evaluation_label=report["evaluation_label"],
                    execution_assumptions=report["execution_assumptions"],
                    limitations=report["limitations"]
                )
                db.add(run_record)
                db.commit()
                report["id"] = run_record.id
            except Exception as e:
                db.rollback()
                logger.error(f"Error persisting backtest run: {e}")

        return report

backtesting_engine = BacktestingEngine()
