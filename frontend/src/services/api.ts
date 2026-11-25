import {
  Instrument,
  Ticker24h,
  Candle,
  MarketAnalysisResponse,
  Strategy,
  BacktestReport,
  PortfolioSummary,
  RiskDashboardSummary,
  ResearchReport,
  WatchlistItem,
  ChatMessage,
  DemoAccount
} from '../types';

const API_BASE = '/api/v1';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorDetail = 'API Request failed';
    try {
      const err = await response.json();
      errorDetail = err.detail || err.message || errorDetail;
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Market Data
  getInstruments: () => fetchJson<Instrument[]>(`${API_BASE}/market/instruments`),
  getTicker: (symbol: string) => fetchJson<Ticker24h>(`${API_BASE}/market/ticker/${symbol}`),
  getCandles: (symbol: string, timeframe = '1h', limit = 300) =>
    fetchJson<{ symbol: string; timeframe: string; count: number; candles: Candle[] }>(
      `${API_BASE}/market/candles/${symbol}?timeframe=${timeframe}&limit=${limit}`
    ),
  getProviders: () => fetchJson<any[]>(`${API_BASE}/market/providers`),

  // Market Analysis
  getAnalysis: (symbol: string, timeframe = '1h', limit = 250) =>
    fetchJson<MarketAnalysisResponse>(`${API_BASE}/analysis/${symbol}?timeframe=${timeframe}&limit=${limit}`),

  // Strategy Lab
  getStrategies: () => fetchJson<Strategy[]>(`${API_BASE}/strategies`),
  createStrategy: (payload: {
    name: string;
    description?: string;
    category?: string;
    symbol: string;
    timeframe: string;
    config: Record<string, any>;
  }) => fetchJson<Strategy>(`${API_BASE}/strategies`, { method: 'POST', body: JSON.stringify(payload) }),
  generateAIStrategies: (symbol = 'BTCUSDT', timeframe = '1h') =>
    fetchJson<{ market_regime: string; candidates: Strategy[] }>(
      `${API_BASE}/strategies/ai-generate?symbol=${symbol}&timeframe=${timeframe}`,
      { method: 'POST' }
    ),
  toggleStrategyActive: (id: number) =>
    fetchJson<{ id: number; name: string; is_active: boolean }>(`${API_BASE}/strategies/${id}/toggle-active`, {
      method: 'PATCH'
    }),

  // Quantitative Backtesting Studio
  getStrategyPresets: () => fetchJson<any>(`${API_BASE}/backtest/presets`),
  runCustomBacktest: (payload: {
    strategy_name: string;
    strategy_format: 'python' | 'pine' | 'english' | 'config';
    strategy_code: string;
    symbol: string;
    timeframe: string;
    limit_bars?: number;
    initial_capital?: number;
    risk_per_trade_pct?: number;
    spread_pips?: number;
    commission_per_lot?: number;
    slippage_bps?: number;
    leverage?: number;
    target_rr?: number;
    stop_loss_atr_mult?: number;
  }) => fetchJson<any>(`${API_BASE}/backtest/run-custom`, { method: 'POST', body: JSON.stringify(payload) }),
  deployToAlgo: (payload: {
    strategy_name: string;
    strategy_format: string;
    strategy_code: string;
    symbol: string;
    target_rr?: number;
    risk_per_trade_pct?: number;
  }) => fetchJson<any>(`${API_BASE}/backtest/deploy-to-algo`, { method: 'POST', body: JSON.stringify(payload) }),
  runBacktest: (payload: {
    strategy_id?: number;
    strategy_name?: string;
    symbol: string;
    timeframe: string;
    limit_bars?: number;
    initial_capital?: number;
    risk_per_trade_pct?: number;
    fee_rate_bps?: number;
    slippage_bps?: number;
    custom_config?: Record<string, any>;
  }) => fetchJson<BacktestReport>(`${API_BASE}/backtest/run`, { method: 'POST', body: JSON.stringify(payload) }),
  getBacktestHistory: () => fetchJson<any[]>(`${API_BASE}/backtest/history`),

  // Paper Trading & Execution
  getPortfolio: () => fetchJson<PortfolioSummary>(`${API_BASE}/trading/portfolio`),
  getAccounts: () => fetchJson<{ accounts: DemoAccount[]; active_account: DemoAccount }>(`${API_BASE}/trading/accounts`),
  createAccount: (payload: {
    name: string;
    initial_balance: number;
    account_type?: string;
    currency?: string;
    set_active?: boolean;
  }) => fetchJson<{ success: boolean; account: DemoAccount }>(`${API_BASE}/trading/accounts`, {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  switchAccount: (accountId: number) =>
    fetchJson<{ success: boolean; active_account_id: number; account_number: string; name: string }>(
      `${API_BASE}/trading/accounts/${accountId}/switch`,
      { method: 'POST' }
    ),
  resetAccount: (balance = 100000.0, accountId?: number) =>
    accountId
      ? fetchJson<any>(`${API_BASE}/trading/accounts/${accountId}/reset`, { method: 'POST', body: JSON.stringify({ balance }) })
      : fetchJson<any>(`${API_BASE}/trading/reset`, { method: 'POST', body: JSON.stringify({ balance }) }),
  deleteAccount: (accountId: number) =>
    fetchJson<{ success: boolean; message: string }>(`${API_BASE}/trading/accounts/${accountId}`, { method: 'DELETE' }),
  submitOrder: (payload: {
    symbol: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    order_type?: string;
    price?: number;
    stop_loss?: number;
    take_profit?: number;
    strategy_id?: number;
  }) => fetchJson<any>(`${API_BASE}/trading/order`, { method: 'POST', body: JSON.stringify(payload) }),
  closePosition: (positionId: number) =>
    fetchJson<any>(`${API_BASE}/trading/positions/${positionId}/close`, { method: 'POST' }),
  resetPaperAccount: (balance = 100000.0) =>
    fetchJson<any>(`${API_BASE}/trading/reset`, { method: 'POST', body: JSON.stringify({ balance }) }),

  // Risk Management Engine
  getRiskDashboard: () => fetchJson<RiskDashboardSummary>(`${API_BASE}/risk/dashboard`),
  getRiskConfig: () => fetchJson<any>(`${API_BASE}/risk/config`),
  updateRiskConfig: (payload: any) =>
    fetchJson<any>(`${API_BASE}/risk/config`, { method: 'PUT', body: JSON.stringify(payload) }),
  toggleKillSwitch: () =>
    fetchJson<{ kill_switch_active: boolean; message: string }>(`${API_BASE}/risk/kill-switch`, { method: 'POST' }),

  // Investment Research
  getResearchReports: () => fetchJson<ResearchReport[]>(`${API_BASE}/research/reports`),
  getWatchlist: () => fetchJson<WatchlistItem[]>(`${API_BASE}/research/watchlist`),
  addWatchlistItem: (payload: Partial<WatchlistItem>) =>
    fetchJson<any>(`${API_BASE}/research/watchlist`, { method: 'POST', body: JSON.stringify(payload) }),

  // AI Assistant
  sendChatMessage: (message: string) =>
    fetchJson<{ sender: 'assistant'; content: string }>(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      body: JSON.stringify({ message })
    }),
  getChatHistory: () => fetchJson<ChatMessage[]>(`${API_BASE}/assistant/history`),

  // System Diagnostics
  getHealth: () => fetchJson<any>(`${API_BASE}/system/health`),
  getConfig: () => fetchJson<any>(`${API_BASE}/system/config`),

  // Forex Factory Live News & 5-Hour Pre-Triggers
  getEconomicCalendar: (forceRefresh = false) =>
    fetchJson<{ status: string; count: number; events: any[] }>(`${API_BASE}/news/calendar?force_refresh=${forceRefresh}`),
  getFiveHourPreTriggers: () =>
    fetchJson<{ status: string; active_trigger_count: number; triggers: any[]; is_any_lockout_active: boolean }>(`${API_BASE}/news/pre_triggers`),
  checkManipulation: (payload: {
    symbol: string;
    high_price: number;
    low_price: number;
    open_price: number;
    close_price: number;
    pre_news_high: number;
    pre_news_low: number;
    volume_current?: number;
    volume_average?: number;
  }) => fetchJson<any>(`${API_BASE}/news/check_manipulation`, { method: 'POST', body: JSON.stringify(payload) }),

  // Automated Post-Trade Journal
  getJournalEntries: (symbol?: string, emotion?: string, limit = 50) => {
    let q = `${API_BASE}/journal/entries?limit=${limit}`;
    if (symbol) q += `&symbol=${symbol}`;
    if (emotion) q += `&emotion=${emotion}`;
    return fetchJson<{ status: string; total: number; entries: any[] }>(q);
  },
  createJournalEntry: (payload: any) =>
    fetchJson<any>(`${API_BASE}/journal/entries`, { method: 'POST', body: JSON.stringify(payload) }),
  getJournalStats: () =>
    fetchJson<{ total_trades: number; win_rate: number; average_r: number; plan_compliance_rate: number; edge_score: number; emotion_breakdown: Record<string, any> }>(`${API_BASE}/journal/stats`),

  // Edge Active Trade Plan
  getActiveTradePlan: (symbol = 'BTCUSDT') =>
    fetchJson<{ status: string; plan: any; message?: string }>(`${API_BASE}/trade_plan/active?symbol=${symbol}`),
  createTradePlan: (payload: any) =>
    fetchJson<any>(`${API_BASE}/trade_plan/create`, { method: 'POST', body: JSON.stringify(payload) }),
  updateTradePlanChecklist: (planId: string, checklistItems: any[]) =>
    fetchJson<any>(`${API_BASE}/trade_plan/${planId}/checklist`, { method: 'PUT', body: JSON.stringify(checklistItems) }),

  // Security & AES-256 Encrypted Broker Bridges
  getBrokerStatus: () =>
    fetchJson<{ status: string; brokers: Record<string, any>; non_custodial_guarantee: string }>(`${API_BASE}/security/broker_status`),
  saveBrokerKeys: (payload: { broker_name: string; api_key: string; api_secret: string; account_id?: string }) =>
    fetchJson<any>(`${API_BASE}/security/save_broker_keys`, { method: 'POST', body: JSON.stringify(payload) }),
  triggerEmergencyKillSwitch: (reason = 'Emergency Kill Switch Triggered') =>
    fetchJson<any>(`${API_BASE}/security/kill_switch`, { method: 'POST', body: JSON.stringify({ reason }) }),
  resetEmergencyKillSwitch: () =>
    fetchJson<any>(`${API_BASE}/security/reset_kill_switch`, { method: 'POST' }),

  // High-R:R Autonomous Algo Engine (1:10 - 1:30)
  getAlgoBots: () =>
    fetchJson<{ status: string; bots: Array<{ id: string; name: string; framework: string; target_rr: number; risk_per_trade_pct: number; is_active: boolean; trades_count: number; win_count: number; total_pnl: number; last_signal: any }> }>(`${API_BASE}/algo/bots`),
  toggleAlgoBot: (botId: string, isActive?: boolean) =>
    fetchJson<{ status: string; bot: any }>(`${API_BASE}/algo/bots/${botId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ is_active: isActive })
    }),
  scanAlgo: (symbol: string) =>
    fetchJson<{ status: string; signal: any; message?: string }>(`${API_BASE}/algo/scan`, {
      method: 'POST',
      body: JSON.stringify({ symbol })
    }),
  getAlgoSignals: (limit = 20) =>
    fetchJson<{ status: string; count: number; signals: any[] }>(`${API_BASE}/algo/signals?limit=${limit}`),
};
