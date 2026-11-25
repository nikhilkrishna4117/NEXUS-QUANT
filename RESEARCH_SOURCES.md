# RESEARCH SOURCES & DATA PROVIDER VERIFICATION

**Date Checked:** 2026-11-18  
**Author:** Quantitative Trading Architecture Team  
**Scope:** Real-Time & Historical Market Data, Backtesting Frameworks, Broker Interfaces, AI Models

---

## 1. Market Data Providers & APIs

### A. Binance Public Market Data API
- **Official Documentation:** [https://binance-docs.github.io/apidocs/spot/en/](https://binance-docs.github.io/apidocs/spot/en/)
- **Endpoints Used:**
  - Historical Klines / OHLCV: `GET /api/v3/klines?symbol={symbol}&interval={interval}&limit={limit}`
  - Current Ticker 24hr: `GET /api/v3/ticker/24hr?symbol={symbol}`
  - Order Book / Best Bid-Ask: `GET /api/v3/ticker/bookTicker?symbol={symbol}`
  - Public WebSocket Stream: `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}`
- **Coverage:** Primary cryptocurrency spot pairs (BTCUSDT, ETHUSDT, SOLUSDT, etc.)
- **What It Is Used For:** 
  - Primary, zero-credential real-time and historical OHLCV data source for BTCUSDT and other top cryptocurrencies.
  - Generates realistic bid-ask spread and volume data for backtesting and paper trading.
- **Pricing & Access Restrictions:**
  - Free public access without API keys required for market data endpoints.
  - Rate limits: 1,200 request weight per minute per IP address (`x-mbx-used-weight-1m` header tracked).
- **Known Limitations & Geographic Policies:**
  - Direct access may be restricted or IP-blocked in specific jurisdictions (e.g. US users are routed to Binance.US, and regulatory compliances in India require FIU-registered gateways or compliant proxy routing). Handled via graceful fallback to Coinbase or Yahoo Finance.

---

### B. Coinbase Exchange Public Market Data API
- **Official Documentation:** [https://docs.cdp.coinbase.com/exchange/docs/welcome](https://docs.cdp.coinbase.com/exchange/docs/welcome)
- **Endpoints Used:**
  - Product Candles: `GET https://api.exchange.coinbase.com/products/{product_id}/candles?granularity={seconds}`
  - Product Ticker: `GET https://api.exchange.coinbase.com/products/{product_id}/ticker`
- **Coverage:** BTC-USD, ETH-USD, BTC-USDT
- **What It Is Used For:**
  - Institutional-grade cryptocurrency fallback provider when Binance endpoints face IP latency or region filtering.
- **Pricing & Access Restrictions:**
  - Free public tier (10 requests/second unauthenticated, 15 req/sec authenticated).
- **Known Limitations:**
  - Granularity is strictly constrained to 60, 300, 900, 3600, 21600, 86400 seconds (max 300 candles per query). Pagination implemented automatically in our adapter.

---

### C. Yahoo Finance Multi-Asset API
- **Official Documentation:** [https://finance.yahoo.com/](https://finance.yahoo.com/) (Standard institutional v8 chart REST endpoint)
- **Endpoints Used:**
  - Chart & OHLCV: `GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval={interval}&range={range}`
- **Coverage:**
  - **Commodities:** `GC=F` (Gold Futures / XAUUSD proxy), `CL=F` (Crude Oil)
  - **Forex:** `EURUSD=X`, `USDINR=X`, `GBPUSD=X`
  - **Indian Equities & Indices:** `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `HDFCBANK.NS`, `^NSEI` (NIFTY 50)
  - **Global Equities & ETFs:** `SPY`, `QQQ`, `AAPL`, `NVDA`
- **What It Is Used For:**
  - Multi-asset expansion across Gold, Forex, and Indian equities without requiring immediate proprietary paid broker terminals (such as Zerodha Kite Connect or Interactive Brokers) during development.
- **Pricing & Access Restrictions:**
  - Free for personal / research quantitative usage with standard browser User-Agent headers.
- **Known Limitations:**
  - Real-time streaming is not provided on unauthenticated endpoints (data can have 1-15 minute exchange-mandated delay during market hours for equity quotes). Clearly flagged with `is_delayed: true` badge in UI.

---

### D. NSE India / Zerodha Kite Connect / Interactive Brokers (Modular Adapters)
- **Official Documentation:**
  - Zerodha Kite Connect API: [https://kite.trade/docs/connect/v3/](https://kite.trade/docs/connect/v3/)
  - Interactive Brokers Client Portal Web API: [https://interactivebrokers.github.io/cpwebapi/](https://interactivebrokers.github.io/cpwebapi/)
- **What It Is Used For:**
  - Institutional broker adapter interface designed for Indian Equities (NSE/BSE), MCX Commodities, and Global Equities.
- **Access Restrictions:**
  - Requires active trading accounts and subscription API keys (e.g., Zerodha Kite Connect charges ₹2,000/month for trading API + ₹2,000/month for historical data API).
  - Production adapter interface is built and tested with simulated sandbox execution; live credentials can be inserted directly in the platform Settings page.

---

## 2. Technical Analysis & Quantitative Mathematics

- **TA Calculations (NumPy / SciPy / Custom Vectorized Engine):**
  - **RSI (Wilder's Smoothing):** Exact 14-period exponential moving average of gains/losses.
  - **MACD (12, 26, 9):** Fast EMA - Slow EMA, Signal = EMA(MACD, 9), Histogram = MACD - Signal.
  - **Bollinger Bands:** 20-period SMA ± 2 standard deviations.
  - **ATR (Average True Range):** 14-period Wilder smoothing of True Range = `max(H-L, |H-Cp|, |L-Cp|)`.
  - **ADX (Average Directional Index):** +DI, -DI directional movement normalized by ATR.
  - **VWAP:** Cumulative Volume-Weighted Average Price resetting at day boundaries.
  - **Market Structure Recognition:** ZigZag swing detection, Pivot Highs/Lows, Break of Structure (BOS), Change of Character (CHoCH), Order Block / Liquidity detection.

---

## 3. Backtesting & Risk Methodologies

- **Execution Realism:**
  - **No Look-Ahead Bias:** Order signal evaluated at bar close $t$, executed at the next bar's open $t+1$.
  - **Slippage Modeling:** Configurable percentage and fixed tick slippage model based on ATR/volatility.
  - **Maker / Taker Fee Schedules:** Standard 0.02% maker, 0.04% taker (crypto) or custom equity commission schedules.
  - **Walk-Forward Validation:** Rolling in-sample optimization (70%) and out-of-sample stress testing (30%).
  - **Statistical Metrics:** Sharpe Ratio ($R_f=0.04$), Sortino Ratio (downside semivariance only), Calmar Ratio, Maximum Drawdown (peak-to-trough equity), Expectancy, Profit Factor.

---

## 4. AI & Large Language Model Integrations

- **LLM APIs Supported (Optional & Configurable):**
  - Google Gemini API (`GEMINI_API_KEY`) via official `google-genai` / REST endpoints.
  - OpenAI / Anthropic compatible endpoint fallback.
  - **Zero-Key Mode (Deterministic Local Quant Synthesis):** When no LLM key is supplied, a comprehensive rule-based quant research engine analyzes backtest performance, market regime shifts, and risk metrics to provide structured investment memos and explanations without failing or inventing numbers.
