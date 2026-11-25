# ⚡ Nexus Quant — AI Algorithmic Trading & Investment Research Platform

A professional-grade quantitative trading workstation, strategy backtesting lab, and institutional investment research system built from scratch with **FastAPI** (Python 3.13) and **React 18 + TypeScript + Tailwind CSS** (Vite).

---

## 🚀 Quick Start (One-Click Launch)

To start both the Backend (port 8000) and Frontend (port 5173) together, double-click:
```text
start_all.bat
```
This will:
1. Open a terminal window running the FastAPI backend with live Binance & Yahoo Finance connectors.
2. Open a second terminal window running Vite React dev server on `http://localhost:5173`.
3. Automatically launch your default web browser to `http://localhost:5173`.

Alternatively, start them separately:
- **Backend:** Double-click `start_backend.bat` (or run `python -m uvicorn backend.main:app --port 8000 --reload`)
- **Frontend:** Double-click `start_frontend.bat` (or run `npm run dev` inside `frontend/`)

---

## 🌐 URLs & Access
- **Web Terminal UI:** [http://localhost:5173](http://localhost:5173)
- **FastAPI REST API:** [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **WebSocket Price Feed:** `ws://localhost:8000/ws/stream`

---

## 🏛️ Architecture & Platform Modules

```
├── backend/
│   ├── config.py                  # Platform settings, risk tolerances, fee/slippage models
│   ├── database.py                # SQLite database engine and session factory
│   ├── main.py                    # FastAPI root application, WebSocket broadcaster, CORS
│   ├── models/                    # SQLAlchemy ORM schemas
│   │   ├── market_data.py         # Instruments, Candlesticks, Provider audit logs
│   │   ├── strategy.py            # Quantitative strategies & rule parameters
│   │   ├── backtest.py            # Backtest runs, trades, equity curves
│   │   ├── trading.py             # Paper account, orders, positions, executions
│   │   ├── risk.py                # Risk limits, circuit breakers, pre-trade audit logs
│   │   ├── research.py            # Institutional dossiers & watchlist items
│   │   └── assistant.py           # Conversational AI memory & financial transcripts
│   ├── routers/                   # Modular REST API endpoints
│   │   ├── market_data.py         # Real-time tickers, historical OHLCV candles
│   │   ├── analysis.py            # Indicators, market structure, chart patterns, regimes
│   │   ├── strategies.py          # Baseline quants, rule builder, AI generator
│   │   ├── backtest.py            # Zero-lookahead backtest execution & Monte Carlo
│   │   ├── trading.py             # Risk-validated paper trading order execution
│   │   ├── risk.py                # Risk dashboard, kill switch, drawdowns
│   │   ├── research.py            # Deep institutional dossiers
│   │   ├── assistant.py           # AI quant reasoning (Gemini API + deterministic fallback)
│   │   └── system.py              # Diagnostics, connectivity health check
│   ├── services/                  # Core quantitative & financial engines
│   │   ├── market_data_service.py # Binance public REST & Yahoo Finance connectors
│   │   ├── technical_analysis.py  # RSI, MACD, EMA, BB, ATR, ADX, VWAP, Stochastic, Regimes
│   │   ├── strategy_engine.py     # 5 baseline quant strategies + AI synthesis
│   │   ├── backtesting_engine.py  # Zero-lookahead execution, fees, slippage, Monte Carlo
│   │   ├── paper_trading_service.py # Pre-trade validation, simulated execution, position P&L
│   │   ├── risk_engine.py         # Mandatory Stop-Loss, sizing caps, drawdown circuit breaker
│   │   ├── investment_research_service.py # Institutional investment dossiers
│   │   └── ai_assistant_service.py# Quantitative reasoning assistant
│   └── tests/
│       └── test_quant_platform.py # 6 comprehensive pytest suites (100% passing)
├── frontend/                      # React 18 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── components/            # CandlestickChart, Navbar, Sidebar
│   │   ├── pages/                 # 9 Dedicated Institutional Workstation Pages
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── MarketAnalysisPage.tsx
│   │   │   ├── StrategyLabPage.tsx
│   │   │   ├── BacktestingPage.tsx
│   │   │   ├── PaperTradingPage.tsx
│   │   │   ├── RiskManagementPage.tsx
│   │   │   ├── InvestmentResearchPage.tsx
│   │   │   ├── AIAssistantPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── services/api.ts        # Typed fetch client connecting to FastAPI backend
│   │   └── types/index.ts         # Full TypeScript contracts matching backend models
│   └── package.json
├── data/quant_platform.db         # Persistent SQLite database
├── start_all.bat                  # One-click launcher for Windows
├── start_backend.bat              # Backend launcher
├── start_frontend.bat             # Frontend launcher
└── .env                           # API keys & configuration
```

---

## 🛡️ Risk & Safety Rules
1. **Live trading is permanently disabled by default** (`LIVE_TRADING_ENABLED=False` in `.env`).
2. **Pre-Trade Risk Firewall:** All paper trades must have a valid Stop-Loss price in the correct direction (below entry for BUY, above entry for SELL) and a minimum 1.5:1 Risk/Reward ratio.
3. **Realistic Friction:** All backtests and paper trades apply 4 bps taker fee and 5 bps simulated market slippage.
4. **Emergency Kill-Switch:** Accessible at any moment from the UI or via API `POST /api/v1/risk/kill-switch`.
