export interface Instrument {
  id: number;
  symbol: string;
  name: string;
  asset_class: string;
  base_asset: string;
  quote_asset: string;
  provider: string;
  is_active: boolean;
  min_quantity: number;
  price_precision: number;
  quantity_precision: number;
}

export interface Candle {
  symbol: string;
  timeframe: string;
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover?: number;
  provider?: string;
  is_closed?: boolean;
}

export interface Ticker24h {
  symbol: string;
  last_price: number;
  price_change_24h: number;
  price_change_pct_24h: number;
  high_24h: number;
  low_24h: number;
  volume_24h: number;
  quote_volume_24h?: number;
  bid: number;
  ask: number;
  provider: string;
  updated_at: string;
}

export interface MarketAnalysisResponse {
  symbol: string;
  timeframe: string;
  last_updated: string;
  current_price: number;
  regime: {
    regime: string;
    bias: string;
    confidence: number;
    volatility_state: string;
    rationale: string[];
  };
  structure: {
    structure: string;
    last_swing_high: number | null;
    last_swing_low: number | null;
    support_levels: number[];
    resistance_levels: number[];
    liquidity_pool_high: number;
    liquidity_pool_low: number;
    total_swing_highs_detected: number;
    total_swing_lows_detected: number;
  };
  patterns: Array<{
    name: string;
    type: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    description: string;
  }>;
  indicators: {
    current_price: number;
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
    ema: { ema9: number; ema21: number; ema50: number; ema200: number };
    sma: { sma20: number; sma50: number; sma200: number };
    bollinger_bands: {
      upper: number;
      middle: number;
      lower: number;
      bandwidth_pct: number;
      percent_b: number;
    };
    atr: number;
    adx: { adx: number; plus_di: number; minus_di: number };
    vwap: number;
    stochastic: { k: number; d: number };
    volume: { current: number; sma20: number; ratio: number };
    series?: {
      timestamps: string[];
      close: number[];
      ema9: number[];
      ema21: number[];
      ema50: number[];
      sma20: number[];
      bb_upper: number[];
      bb_lower: number[];
      rsi: number[];
      macd_line: number[];
      macd_signal: number[];
      macd_hist: number[];
      vwap: number[];
    };
  };
}

export interface Strategy {
  id: number;
  name: string;
  description?: string;
  category: string;
  symbol: string;
  timeframe: string;
  config: Record<string, any>;
  is_active: boolean;
  is_ai_generated: boolean;
  evaluation_label: string;
  evaluation_score: number;
  created_at: string;
}

export interface BacktestReport {
  id?: number;
  strategy_name: string;
  symbol: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  final_capital: number;
  total_net_profit: number;
  total_return_pct: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  monte_carlo_95_drawdown_pct: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  expectancy: number;
  avg_win: number;
  avg_loss: number;
  risk_reward_ratio: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  avg_holding_bars: number;
  total_fees: number;
  total_slippage: number;
  out_of_sample_return_pct?: number;
  evaluation_score: number;
  evaluation_label: string;
  trades: Array<{
    symbol: string;
    side: string;
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    quantity: number;
    gross_pnl: number;
    net_pnl: number;
    return_pct: number;
    fees: number;
    exit_reason: string;
    holding_bars: number;
  }>;
  equity_curve: Array<{
    timestamp: string;
    equity: number;
    cash: number;
    drawdown_pct: number;
  }>;
  execution_assumptions: Record<string, any>;
  limitations: string;
}

export interface DemoAccount {
  id: number;
  account_number: string;
  name: string;
  account_type: string;
  initial_balance: number;
  cash_balance: number;
  equity: number;
  margin_used: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  currency: string;
  is_active: boolean;
  open_positions_count: number;
  created_at?: string;
}

export interface PortfolioSummary {
  account_id?: number;
  account_number: string;
  account_name?: string;
  account_type?: string;
  is_active?: boolean;
  initial_balance: number;
  cash_balance: number;
  equity: number;
  margin_used: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  total_return_pct: number;
  open_positions: Array<{
    id: number;
    symbol: string;
    side: string;
    quantity: number;
    entry_price: number;
    current_price: number;
    stop_loss?: number;
    take_profit?: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
    opened_at: string;
  }>;
  recent_orders: Array<{
    id: number;
    client_order_id: string;
    symbol: string;
    side: string;
    order_type: string;
    quantity: number;
    price?: number;
    status: string;
    reject_reason?: string;
    created_at: string;
  }>;
  recent_executions: Array<{
    id: number;
    symbol: string;
    side: string;
    executed_price: number;
    quantity: number;
    fee: number;
    executed_at: string;
  }>;
}

export interface RiskDashboardSummary {
  account_equity: number;
  available_capital: number;
  used_margin: number;
  exposure_pct: number;
  unrealized_pnl: number;
  realized_pnl: number;
  daily_pnl: number;
  daily_pnl_pct: number;
  current_drawdown_pct: number;
  max_drawdown_limit_pct: number;
  max_daily_loss_limit_pct: number;
  max_risk_per_trade_pct: number;
  open_positions_count: number;
  max_open_positions: number;
  kill_switch_active: boolean;
  live_trading_enabled: boolean;
  recent_audit_logs: Array<{
    id: number;
    timestamp: string;
    symbol: string;
    action_type: string;
    passed: boolean;
    reason: string;
  }>;
}

export interface ResearchReport {
  id: number;
  symbol: string;
  name: string;
  asset_class: string;
  headline: string;
  investment_thesis: string;
  fundamental_metrics: Record<string, any>;
  technical_bias: string;
  bull_case: string;
  bear_case: string;
  key_catalysts: string[];
  major_risks: string[];
  sources: Array<{ title: string; source: string; date: string }>;
  confidence_score: number;
  time_horizon: string;
  created_at: string;
}

export interface WatchlistItem {
  id: number;
  symbol: string;
  name: string;
  asset_class: string;
  target_entry_price?: number;
  target_exit_price?: number;
  notes?: string;
  is_favorite: boolean;
}

export interface ChatMessage {
  id?: number;
  sender: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}
