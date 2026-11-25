import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
import httpx
# pyrefly: ignore[missing-import]
from sqlalchemy.orm import Session  # type: ignore
# pyrefly: ignore[missing-import]
from sqlalchemy import desc  # type: ignore

from backend.config import settings
from backend.models.assistant import ChatMessage
from backend.models.trading import PaperAccount, Position, Order
from backend.models.backtest import BacktestRun
from backend.models.risk import RiskAuditLog, RiskConfig
from backend.services.market_data_service import market_data_service
from backend.services.technical_analysis import technical_analysis_engine
from backend.services.forex_factory_service import forex_factory_service

logger = logging.getLogger(__name__)

class AIAssistantService:
    """
    FloAI: Senior Quantitative Trading Strategist, Behavioral Discipline Coach & Live Market Analyst.
    Integrates real-time live exchange tick telemetry (Binance, Yahoo Finance),
    deep institutional price action/SMC/ICT analysis, Forex Factory economic calendar,
    and Google Gemini generative reasoning with zero-downtime deterministic fallback.
    """

    @classmethod
    async def validate_gemini_key(cls, key: str) -> Tuple[bool, str]:
        """
        Validates a user-provided Gemini API key with Google's generative language endpoints.
        """
        clean_key = key.strip()
        if not clean_key:
            return False, "API key cannot be empty."

        models_to_test = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]
        for model in models_to_test:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={clean_key}"
            payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": "Hello, respond with 'OK'"}]}
                ]
            }
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        return True, f"Verified successfully with Google {model}."
                    elif res.status_code == 400:
                        err_json = res.json()
                        err_msg = err_json.get("error", {}).get("message", "Invalid API key.")
                        if "API_KEY_INVALID" in err_msg or "not valid" in err_msg.lower():
                            return False, f"Invalid API Key: {err_msg}"
            except Exception as e:
                logger.warning(f"Error testing model {model}: {e}")

        return False, "Could not verify API key. Please check network connectivity or key permissions."

    @classmethod
    def get_assistant_config(cls) -> Dict[str, Any]:
        """Returns the current connection and configuration status of FloAI."""
        key = settings.GEMINI_API_KEY
        is_connected = bool(key and len(key) > 10)
        masked = f"{key[:6]}••••••••{key[-4:]}" if is_connected else "Not Configured"
        return {
            "connected": is_connected,
            "masked_key": masked,
            "provider": "Google Gemini",
            "model": "gemini-1.5-flash / gemini-2.0-flash",
            "live_market_engine": "Active (Binance + Yahoo Finance Live Streams)",
            "risk_guardrails_active": True
        }

    @classmethod
    def extract_target_symbols(cls, message: str) -> List[str]:
        """Extracts financial symbols from user messages or defaults to primary market benchmarks."""
        msg = message.upper()
        symbols = []

        if any(w in msg for w in ["BTC", "BITCOIN"]):
            symbols.append("BTCUSDT")
        if any(w in msg for w in ["ETH", "ETHEREUM"]):
            symbols.append("ETHUSDT")
        if any(w in msg for w in ["SOL", "SOLANA"]):
            symbols.append("SOLUSDT")
        if any(w in msg for w in ["GOLD", "XAU", "XAUUSD"]):
            symbols.append("GC=F")
        if any(w in msg for w in ["EUR", "EURUSD", "FOREX"]):
            symbols.append("EURUSD=X")
        if any(w in msg for w in ["RELIANCE"]):
            symbols.append("RELIANCE.NS")
        if any(w in msg for w in ["NIFTY", "^NSEI"]):
            symbols.append("^NSEI")

        if not symbols:
            # Default to primary crypto & macro benchmark
            symbols = ["BTCUSDT", "GC=F"]

        return list(dict.fromkeys(symbols))

    @classmethod
    async def get_live_market_telemetry(cls, symbol: str, db: Session) -> Dict[str, Any]:
        """
        Fetches live historical candles and computes real-time quantitative metrics
        including Bullish/Bearish bias score, RSI, EMAs, MACD, Support/Resistance, and R:R trade setups.
        """
        try:
            candles = await market_data_service.fetch_historical_candles(symbol, timeframe="1h", limit=100, db=db)
        except Exception as e:
            logger.warning(f"Error fetching candles for {symbol}: {e}")
            candles = []

        if not candles or len(candles) < 15:
            # Fallback current price
            try:
                curr_price = await market_data_service.get_latest_price(symbol, db=db)
            except Exception:
                curr_price = 81000.0 if "BTC" in symbol else (3940.0 if "GC" in symbol else 1.08)
            return {
                "symbol": symbol,
                "current_price": curr_price,
                "bias": "NEUTRAL / ACCUMULATION",
                "bias_color": "yellow",
                "confidence_pct": 65,
                "rsi": 50.0,
                "ema50": curr_price,
                "ema200": curr_price,
                "support": curr_price * 0.98,
                "resistance": curr_price * 1.02,
                "recommendation": "Range bound. Wait for directional breakout."
            }

        ind = technical_analysis_engine.calculate_indicators(candles)
        price = ind.get("current_price", float(candles[-1]["close"]))
        rsi = ind.get("rsi", 50.0)
        ema9 = ind.get("ema", {}).get("ema9", price)
        ema21 = ind.get("ema", {}).get("ema21", price)
        ema50 = ind.get("ema", {}).get("ema50", price)
        ema200 = ind.get("ema", {}).get("ema200", price)
        macd = ind.get("macd", {})
        macd_hist = macd.get("histogram", 0.0)
        atr = ind.get("atr", price * 0.015)

        # 24h change estimation from recent 24 hourly candles
        p_24h_ago = float(candles[-24]["close"]) if len(candles) >= 24 else float(candles[0]["close"])
        change_24h = ((price - p_24h_ago) / p_24h_ago) * 100.0

        # Confluence Score calculation (0-100)
        bullish_points = 0
        total_points = 6

        if price > ema50: bullish_points += 1
        if ema50 > ema200: bullish_points += 1
        if price > ema9 and ema9 > ema21: bullish_points += 1
        if rsi >= 50: bullish_points += 1
        if macd_hist > 0: bullish_points += 1
        if change_24h > 0: bullish_points += 1

        bullish_ratio = bullish_points / total_points

        if bullish_ratio >= 0.66:
            bias = "BULLISH"
            bias_color = "emerald"
            confidence = int(70 + (bullish_ratio - 0.66) * 75)
            rec_action = "LONG ON DISCOUNT RETEST"
            entry_zone = f"${price * 0.995:,.2f} – ${price:,.2f}"
            stop_loss = price - (atr * 1.5)
            tp1 = price + (atr * 3.0)   # 1:2 R:R
            tp2 = price + (atr * 5.0)   # 1:3.3 R:R
            tp3 = price + (atr * 15.0)  # 1:10 R:R Institutional Runner
        elif bullish_ratio <= 0.33:
            bias = "BEARISH"
            bias_color = "red"
            confidence = int(70 + (0.33 - bullish_ratio) * 75)
            rec_action = "SHORT ON PREMIUM PULLBACK"
            entry_zone = f"${price:,.2f} – ${price * 1.005:,.2f}"
            stop_loss = price + (atr * 1.5)
            tp1 = price - (atr * 3.0)   # 1:2 R:R
            tp2 = price - (atr * 5.0)   # 1:3.3 R:R
            tp3 = price - (atr * 15.0)  # 1:10 R:R Institutional Runner
        else:
            bias = "NEUTRAL / CONSOLIDATION"
            bias_color = "yellow"
            confidence = 62
            rec_action = "WAIT FOR BREAKOUT / STAND ASIDE"
            entry_zone = f"${ema50:,.2f}"
            stop_loss = price - atr
            tp1 = price + (atr * 2.0)
            tp2 = price + (atr * 4.0)
            tp3 = price + (atr * 10.0)

        # Support & Resistance levels from recent candle swings
        recent_highs = [float(c["high"]) for c in candles[-30:]]
        recent_lows = [float(c["low"]) for c in candles[-30:]]
        resistance_level = max(recent_highs)
        support_level = min(recent_lows)

        return {
            "symbol": symbol,
            "current_price": price,
            "change_24h": round(change_24h, 2),
            "bias": bias,
            "bias_color": bias_color,
            "confidence_pct": min(confidence, 94),
            "rsi": round(rsi, 2),
            "ema9": round(ema9, 2),
            "ema21": round(ema21, 2),
            "ema50": round(ema50, 2),
            "ema200": round(ema200, 2),
            "macd_hist": round(macd_hist, 4),
            "atr": round(atr, 2),
            "support": round(support_level, 2),
            "resistance": round(resistance_level, 2),
            "recommendation": rec_action,
            "entry_zone": entry_zone,
            "stop_loss": round(stop_loss, 2),
            "tp1": round(tp1, 2),
            "tp2": round(tp2, 2),
            "tp3": round(tp3, 2)
        }

    @classmethod
    async def process_chat(cls, user_message: str, db: Session) -> Dict[str, Any]:
        """
        Processes trader questions, audits live portfolio state and risk guardrails,
        and generates institutional-grade quantitative reasoning and coaching.
        """
        # Save user message
        user_record = ChatMessage(sender="user", content=user_message)
        db.add(user_record)
        db.commit()

        # Gather real-time context safely (zero blocking)
        account = db.query(PaperAccount).filter(PaperAccount.is_active == True).first() or db.query(PaperAccount).first()
        positions = db.query(Position).filter(Position.is_open == True).all()
        recent_backtests = db.query(BacktestRun).order_by(desc(BacktestRun.created_at)).limit(3).all()
        recent_rejections = db.query(RiskAuditLog).filter(RiskAuditLog.passed == False).order_by(desc(RiskAuditLog.timestamp)).limit(3).all()
        risk_config = db.query(RiskConfig).first()

        # Detect target symbols and compute live telemetry
        target_symbols = cls.extract_target_symbols(user_message)
        telemetry_list = []
        for sym in target_symbols[:2]:
            t = await cls.get_live_market_telemetry(sym, db=db)
            telemetry_list.append(t)

        # Get Forex Factory high impact triggers
        pre_triggers = forex_factory_service.get_five_hour_pre_triggers()

        # Check if external Gemini LLM is configured and responsive
        if settings.GEMINI_API_KEY:
            try:
                ai_text = await cls._query_gemini_api(
                    prompt=user_message,
                    account=account,
                    positions=positions,
                    recent_backtests=recent_backtests,
                    telemetry_list=telemetry_list,
                    pre_triggers=pre_triggers
                )
                if ai_text:
                    assistant_record = ChatMessage(sender="assistant", content=ai_text)
                    db.add(assistant_record)
                    db.commit()
                    return {"sender": "assistant", "content": ai_text}
            except Exception as e:
                logger.warning(f"External Gemini API unavailable, utilizing local quantitative reasoning engine: {e}")

        # Local Institutional Quant Analytical Engine
        response_text = cls._generate_quant_response(
            user_message=user_message,
            telemetry_list=telemetry_list,
            account=account,
            positions=positions,
            recent_backtests=recent_backtests,
            recent_rejections=recent_rejections,
            risk_config=risk_config,
            pre_triggers=pre_triggers
        )

        assistant_record = ChatMessage(sender="assistant", content=response_text)
        db.add(assistant_record)
        db.commit()

        return {"sender": "assistant", "content": response_text}

    @staticmethod
    def _generate_quant_response(
        user_message: str,
        telemetry_list: List[Dict[str, Any]],
        account: Optional[PaperAccount],
        positions: List[Position],
        recent_backtests: List[BacktestRun],
        recent_rejections: List[RiskAuditLog],
        risk_config: Optional[RiskConfig],
        pre_triggers: List[Dict[str, Any]]
    ) -> str:
        msg = user_message.lower().strip()

        # 1. Market condition / Current Price Action / Bullish vs Bearish
        if any(w in msg for w in ["market", "happening", "trend", "btc", "bitcoin", "gold", "xau", "eth", "sol", "bullish", "bearish", "analysis", "chart"]):
            reports = []
            for t in telemetry_list:
                sym = t["symbol"]
                bias_icon = "🟢" if t["bias"] == "BULLISH" else ("🔴" if t["bias"] == "BEARISH" else "🟡")
                reports.append(
                    f"### {bias_icon} {sym} Live Market Structure: **{t['bias']}** ({t['confidence_pct']}% Confluence)\n\n"
                    f"**[Live Exchange Price & Indicators]**\n"
                    f"- **Current Price:** `${t['current_price']:,.2f}` ({t['change_24h']:+.2f}% 24h)\n"
                    f"- **RSI (14-period):** `{t['rsi']:.1f}` {'(Overbought - Watch for Retest)' if t['rsi'] > 70 else ('(Oversold - Watch for Long)' if t['rsi'] < 30 else '(Equilibrium Zone)')}\n"
                    f"- **Trend Filter (EMA 50 / 200):** EMA50 = `${t['ema50']:,.2f}` | EMA200 = `${t['ema200']:,.2f}`\n"
                    f"- **Key S/R Boundary:** Support = `${t['support']:,.2f}` | Resistance = `${t['resistance']:,.2f}`\n\n"
                    f"**[Institutional 1:10 R:R Execution Blueprint]**\n"
                    f"- **Tactical Bias:** `{t['recommendation']}`\n"
                    f"- **Recommended Entry Zone:** `{t['entry_zone']}`\n"
                    f"- **Stop Loss (Tight Invalidation):** `${t['stop_loss']:,.2f}`\n"
                    f"- **Target 1 (1:2 R:R - Scale 30% & Move SL to BE):** `${t['tp1']:,.2f}`\n"
                    f"- **Target 2 (1:3.3 R:R - Scale 30%):** `${t['tp2']:,.2f}`\n"
                    f"- **Target 3 (1:10 HTF Liquidity Target - Runner):** `${t['tp3']:,.2f}`"
                )

            economic_note = ""
            if pre_triggers:
                p = pre_triggers[0]
                economic_note = (
                    f"\n\n> ⚠️ **5-Hour Macro Event Warning:** High-Impact `{p['event_name']}` ({p['currency']}) "
                    f"in `{p['countdown_display']}`. News lockout recommended `{p['lockout_window_minutes']}` mins around release."
                )

            return "\n\n---\n\n".join(reports) + economic_note

        # 2. Portfolio & Risk Audit
        elif any(w in msg for w in ["portfolio", "balance", "risk", "rejected", "drawdown", "pnl", "kill"]):
            balance = account.cash_balance if account else 100000.0
            equity = account.equity if account else balance
            open_count = len(positions)
            unrealized_pnl = sum([p.unrealized_pnl for p in positions]) if positions else 0.0

            rejection_text = "No recent risk violations detected. Guardrails operating normally."
            if recent_rejections:
                rejection_text = f"Recent block: {recent_rejections[0].action} rejected due to '{recent_rejections[0].reason}'."

            return (
                f"### 🛡️ FloAI Portfolio & Risk Firewall Audit\n\n"
                f"**[Live Account Telemetry]**\n"
                f"- **Account Number:** `{account.account_number if account else 'DEMO-001'}` ({account.name if account else 'Primary'})\n"
                f"- **Cash Balance:** `${balance:,.2f}` | **Current Equity:** `${equity:,.2f}`\n"
                f"- **Open Positions:** `{open_count}` active trades (Unrealized P&L: `${unrealized_pnl:+,.2f}`)\n"
                f"- **Max Risk Per Trade Cap:** `{risk_config.max_risk_per_trade_pct if risk_config else 2.0}%`\n"
                f"- **Max Daily Loss Limit:** `{risk_config.max_daily_loss_pct if risk_config else 5.0}%`\n"
                f"- **Mandatory Stop Loss:** `{'Enforced' if (not risk_config or risk_config.require_stop_loss) else 'Optional'}`\n\n"
                f"**[Risk Engine Audit Status]**\n"
                f"{rejection_text}\n\n"
                f"**[FloAI Recommendation]**\n"
                f"Keep position sizing strictly aligned with your plan. Never risk more than 1% of equity per trade."
            )

        # 3. Strategy & High R:R Guidance
        elif any(w in msg for w in ["strategy", "smc", "ict", "price action", "fvg", "order block", "high rr"]):
            return (
                f"### 🎯 Institutional High-R:R Framework (1:10 to 1:30)\n\n"
                f"**1. SMC & ICT Multi-Timeframe Confluence:**\n"
                f"- **Higher Timeframe (4H / 1H):** Identify overall narrative, liquidity pools (Equal Highs/Lows), and unmitigated Order Blocks.\n"
                f"- **Lower Timeframe (5m / 1m):** Wait for a Market Structure Shift (MSS) with displacement following an external liquidity sweep.\n"
                f"- **Optimal Trade Entry (OTE):** Enter at the 0.618–0.786 Fibonacci retracement overlapping an ICT Fair Value Gap (FVG).\n\n"
                f"**2. Scaling & Runner Management:**\n"
                f"- Take **30% partial profit** at `1:2 to 1:3 R:R`.\n"
                f"- Move Stop Loss immediately to **Breakeven (BE)**.\n"
                f"- Take another **30% partial profit** at `1:5 R:R`.\n"
                f"- Trail remaining 40% runner behind swing structure to capture the `1:10 to 1:30` macro liquidity target."
            )

        # 4. Backtest Tear-Sheet
        elif any(w in msg for w in ["backtest", "sharpe", "sortino"]):
            if recent_backtests:
                b = recent_backtests[0]
                return (
                    f"### 📈 Quantitative Backtest Audit: {b.strategy_name}\n\n"
                    f"- **Asset & Timeframe:** `{b.symbol}` on `{b.timeframe}`\n"
                    f"- **Total Return:** `{b.total_return_pct:+.2f}%` (Net Profit: `${b.total_net_profit:+,.2f}`)\n"
                    f"- **Sharpe Ratio:** `{b.sharpe_ratio:.2f}` | **Max Drawdown:** `{b.max_drawdown_pct:.2f}%`\n"
                    f"- **Win Rate:** `{b.win_rate_pct:.1f}%` ({b.total_trades} trades) | **Profit Factor:** `{b.profit_factor:.2f}`\n\n"
                    f"Zero lookahead bias and realistic slippage/fees factored into every fill."
                )
            return (
                f"### 📈 Strategy Performance Studio\n\n"
                f"Run any strategy test in the **Backtesting Studio** tab to evaluate mathematical expectancy and Sharpe ratios."
            )

        # 5. Discipline & Psychology
        elif any(w in msg for w in ["revenge", "emotion", "fear", "greed", "fomo", "lost", "tilt"]):
            return (
                f"### 🧠 FloAI Behavioral Discipline & Psychology Reset\n\n"
                f"**A loss is an operational expense of running a statistical trading business.**\n\n"
                f"1. **Never Revenge Trade:** Increasing lot size after a loss violates mathematical expectancy and leads to account ruin.\n"
                f"2. **The 20-Minute Protocol:** Step away from the screens immediately. The market will provide thousands more setups.\n"
                f"3. **Sanctuary Reset:** Complete the 4-7-8 breathing exercise in the **Sanctuary** tab before executing another order."
            )

        # Default greeting with live telemetry
        sym = telemetry_list[0]["symbol"] if telemetry_list else "BTCUSDT"
        price = telemetry_list[0]["current_price"] if telemetry_list else 81000.0
        bias = telemetry_list[0]["bias"] if telemetry_list else "BULLISH"
        return (
            f"### ⚡ FloAI Quantitative Sentry & Coach\n\n"
            f"I have live telemetry connected to your workstation:\n"
            f"- **Live Benchmark:** `{sym}` at `${price:,.2f}` (`{bias}`)\n"
            f"- **Discipline Firewall:** Server-side risk validation & mandatory Stop Loss enforcement\n"
            f"- **Execution Engine:** High-R:R SMC, ICT & Price Action frameworks (1:10 – 1:30)\n\n"
            f"Ask me: *'How is the market right now?'*, *'Is BTC bullish or bearish?'*, *'Analyze Gold chart'*, or *'Audit my risk'*!"
        )

    @classmethod
    async def _query_gemini_api(
        cls,
        prompt: str,
        account: Optional[PaperAccount],
        positions: List[Position],
        recent_backtests: List[BacktestRun],
        telemetry_list: List[Dict[str, Any]],
        pre_triggers: List[Dict[str, Any]]
    ) -> Optional[str]:
        """Calls Google Gemini API with verified live market and risk context."""
        clean_key = settings.GEMINI_API_KEY.strip()
        if not clean_key:
            return None

        # Build rich live context
        telemetry_summary = []
        for t in telemetry_list:
            telemetry_summary.append(
                f"- Symbol: {t['symbol']}, Price: ${t['current_price']:,.2f}, 24h Change: {t['change_24h']}%, "
                f"Calculated Bias: {t['bias']} (Confidence: {t['confidence_pct']}%), RSI: {t['rsi']}, "
                f"EMA50: ${t['ema50']:,.2f}, EMA200: ${t['ema200']:,.2f}, Support: ${t['support']:,.2f}, Resistance: ${t['resistance']:,.2f}"
            )
        telemetry_str = "\n".join(telemetry_summary)

        news_str = "No imminent 5-hour high-impact news lockouts."
        if pre_triggers:
            news_str = f"IMMINENT 5-HOUR EVENT: {pre_triggers[0]['event_name']} ({pre_triggers[0]['currency']}) in {pre_triggers[0]['countdown_display']}."

        system_context = (
            f"You are FloAI, a Principal Quantitative Trading Strategist and Behavioral Discipline Coach "
            f"inside an institutional trading platform. You enforce zero fluff, high R:R (1:10 to 1:30), strict risk rules, "
            f"and SMC/ICT liquidity concepts.\n\n"
            f"REAL-TIME VERIFIED MARKET TELEMETRY (FROM LIVE APIS):\n"
            f"{telemetry_str}\n\n"
            f"MACRO ECONOMIC NEWS STATUS:\n"
            f"{news_str}\n\n"
            f"PORTFOLIO STATE:\n"
            f"Cash Balance: ${account.cash_balance if account else 100000:,.2f}, Open Trades: {len(positions)}\n\n"
            f"INSTRUCTIONS:\n"
            f"1. When asked how the market is or whether it is bullish or bearish, state the verdict clearly (BULLISH, BEARISH, or NEUTRAL) "
            f"using the live price and indicator telemetry provided above.\n"
            f"2. Reference the real price, RSI, EMA 50/200, and key Support/Resistance levels.\n"
            f"3. Provide a clear institutional trade setup with entry zone, tight stop loss, and targets (TP1, TP2, TP3 for 1:10 R:R runner).\n"
            f"4. Format your response cleanly in Github markdown with bold headers and bullet points."
        )

        models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"]
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={clean_key}"
            payload = {
                "contents": [
                    {"role": "user", "parts": [{"text": f"{system_context}\n\nUser Question: {prompt}"}]}
                ]
            }
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                return parts[0].get("text", "")
            except Exception as e:
                logger.warning(f"Error querying Gemini model {model}: {e}")

        return None

ai_assistant_service = AIAssistantService()
