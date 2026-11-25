import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Shield,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Box,
  LineChart,
} from 'lucide-react';
import { CandlestickChart } from '../components/CandlestickChart';
import { ThreeMarketLandscape } from '../components/ThreeMarketLandscape';
import { TradingViewWidget } from '../components/TradingViewWidget';
import { TiltCard } from '../components/TiltCard';
import { api } from '../services/api';
import { Candle, PortfolioSummary, RiskDashboardSummary, Strategy } from '../types';

export const DashboardPage: React.FC = () => {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [risk, setRisk] = useState<RiskDashboardSummary | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [tickers, setTickers] = useState<Record<string, any>>({});
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [chartMode, setChartMode] = useState<'tv' | '3d' | '2d'>('tv');
  const [loading, setLoading] = useState(true);

  const symbolsToTrack = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'GC=F', '^NSEI', 'RELIANCE.NS'];

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 8000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const loadDashboardData = async () => {
    try {
      const [candleRes, portRes, riskRes, stratRes] = await Promise.all([
        api.getCandles(selectedSymbol, '1h', 150),
        api.getPortfolio(),
        api.getRiskDashboard(),
        api.getStrategies(),
      ]);

      setCandles(candleRes.candles || []);
      setPortfolio(portRes);
      setRisk(riskRes);
      setStrategies(stratRes);

      // Fetch tickers for cards
      const tickerMap: Record<string, any> = {};
      for (const sym of symbolsToTrack) {
        try {
          const t = await api.getTicker(sym);
          tickerMap[sym] = t;
        } catch { }
      }
      setTickers(tickerMap);
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
      {/* Top Asset Carousel / Tickers */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {symbolsToTrack.map((sym) => {
          const t = tickers[sym];
          const isSelected = selectedSymbol === sym;
          const isUp = (t?.price_change_pct_24h ?? 0) >= 0;
          return (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={`p-3 rounded-xl border text-left transition-all ${isSelected
                ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10'
                : 'bg-[#0c1017] border-slate-800/80 hover:border-slate-700'
                }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-200">{sym.replace('.NS', '')}</span>
                <span className={`flex items-center text-[11px] font-mono font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {t?.price_change_pct_24h != null ? `${t.price_change_pct_24h.toFixed(1)}%` : '--'}
                </span>
              </div>
              <div className="font-mono text-sm font-extrabold text-white">
                {t?.last_price != null ? `$${t.last_price.toLocaleString(undefined, { minimumFractionDigits: sym.includes('=X') ? 4 : 2 })}` : '...'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 capitalize">{t?.provider || 'verified api'}</div>
            </button>
          );
        })}
      </div>

      {/* Main Row: Candlestick Chart / 3D Landscape & Portfolio Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {/* 2D / 3D Perspective Mode Switcher */}
          <div className="flex items-center justify-between bg-[#0a0f1d]/80 border border-slate-800/80 rounded-xl px-4 py-2 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                Market Visualization:
              </span>
              <span className="text-xs font-mono font-bold text-cyan-400">{selectedSymbol}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setChartMode('tv')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition ${
                  chartMode === 'tv'
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Activity className="w-3.5 h-3.5 text-cyan-300" />
                TradingView
              </button>
              <button
                onClick={() => setChartMode('3d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition ${
                  chartMode === '3d'
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Box className="w-3.5 h-3.5 text-cyan-300" />
                3D Volatility
              </button>
              <button
                onClick={() => setChartMode('2d')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition ${
                  chartMode === '2d'
                    ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LineChart className="w-3.5 h-3.5" />
                Quant Canvas
              </button>
            </div>
          </div>

          {chartMode === 'tv' ? (
            <TradingViewWidget symbol={selectedSymbol} timeframe="1h" height={450} />
          ) : chartMode === '3d' ? (
            <ThreeMarketLandscape candles={candles} symbol={selectedSymbol} height={420} />
          ) : (
            <CandlestickChart candles={candles} symbol={selectedSymbol} timeframe="1h" height={420} />
          )}
        </div>

        {/* Portfolio & Risk Health Column (1 Col) with 3D Tilt */}
        <div className="space-y-4">
          {/* Portfolio Metric Card (3D Tilt) */}
          <TiltCard glowColor="blue">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Paper Trading Account</span>
              <span className="text-xs font-mono text-cyan-400 font-semibold">{portfolio?.account_number || 'MASTER'}</span>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <p className="text-[11px] text-slate-400">Total Account Equity</p>
                <p className="text-2xl font-black font-mono text-white tracking-tight">
                  ${portfolio?.equity != null ? portfolio.equity.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/60 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Available Cash</span>
                  <p className="font-mono font-semibold text-slate-200">
                    ${portfolio?.cash_balance != null ? portfolio.cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Margin Allocated</span>
                  <p className="font-mono font-semibold text-slate-200">
                    ${portfolio?.margin_used != null ? portfolio.margin_used.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Realized P&L</span>
                  <p
                    className={`font-mono font-semibold ${(portfolio?.realized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                  >
                    ${portfolio?.realized_pnl != null ? portfolio.realized_pnl.toFixed(2) : '0.00'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px]">Unrealized P&L</span>
                  <p
                    className={`font-mono font-semibold ${(portfolio?.unrealized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                  >
                    ${portfolio?.unrealized_pnl != null ? portfolio.unrealized_pnl.toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            </div>
          </TiltCard>

          {/* Risk Firewall Card (3D Tilt) */}
          <TiltCard glowColor={risk?.kill_switch_active ? 'rose' : 'emerald'}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Risk Firewall & Exposure</span>
              <Shield className={`w-4 h-4 ${risk?.kill_switch_active ? 'text-rose-500' : 'text-emerald-400'}`} />
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Current Portfolio Drawdown</span>
                  <span className="font-mono font-bold text-white">{risk?.current_drawdown_pct ?? 0}% / {risk?.max_drawdown_limit_pct ?? 15}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden p-0.5">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-all shadow-[0_0_10px_#38bdf8]"
                    style={{ width: `${Math.min(100, ((risk?.current_drawdown_pct ?? 0) / (risk?.max_drawdown_limit_pct ?? 15)) * 100)}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Active Position Exposure</span>
                  <span className="font-mono font-bold text-white">{risk?.exposure_pct ?? 0}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, risk?.exposure_pct ?? 0)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                <span className="text-slate-400">Open Positions:</span>
                <span className="font-mono font-bold text-white">
                  {risk?.open_positions_count ?? 0} / {risk?.max_open_positions ?? 5} allowed
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Kill Switch Status:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${risk?.kill_switch_active ? 'bg-rose-950 text-rose-400 border border-rose-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    }`}
                >
                  {risk?.kill_switch_active ? 'HALTED' : 'NORMAL'}
                </span>
              </div>
            </div>
          </TiltCard>
        </div>
      </div>

      {/* Bottom Row: Active Strategies & Recent Executions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Strategies Panel */}
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Quant Strategy Roster</span>
            <span className="text-xs text-slate-500 font-mono">{strategies.length} loaded</span>
          </div>

          <div className="mt-3 divide-y divide-slate-800/60 max-h-64 overflow-y-auto">
            {strategies.map((strat) => (
              <div key={strat.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-200">{strat.name}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                    <span className="capitalize">{strat.category.replace('_', ' ')}</span>
                    <span>•</span>
                    <span className="font-mono">{strat.symbol} ({strat.timeframe})</span>
                    <span>•</span>
                    <span className="text-blue-400 font-semibold">{strat.evaluation_label}</span>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await api.toggleStrategyActive(strat.id);
                    loadDashboardData();
                  }}
                  className={`px-3 py-1 rounded text-xs font-semibold transition ${strat.is_active
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-white'
                    }`}
                >
                  {strat.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Executions Panel */}
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Recent Executions</span>
            <span className="text-xs text-slate-500 font-mono">Real Fills</span>
          </div>

          <div className="mt-3 max-h-64 overflow-y-auto">
            {portfolio?.recent_executions && portfolio.recent_executions.length > 0 ? (
              <table className="w-full text-xs text-left">
                <thead className="text-[11px] text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="pb-2">Time</th>
                    <th className="pb-2">Symbol</th>
                    <th className="pb-2">Side</th>
                    <th className="pb-2">Price</th>
                    <th className="pb-2">Qty</th>
                    <th className="pb-2">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {portfolio.recent_executions.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-900/40">
                      <td className="py-2.5 text-slate-400">{new Date(e.executed_at).toLocaleTimeString()}</td>
                      <td className="py-2.5 font-bold text-slate-200">{e.symbol}</td>
                      <td className={`py-2.5 font-bold ${e.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {e.side}
                      </td>
                      <td className="py-2.5 text-slate-200">${e.executed_price.toFixed(2)}</td>
                      <td className="py-2.5 text-slate-400">{e.quantity}</td>
                      <td className="py-2.5 text-slate-500">${e.fee.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No orders executed yet. Visit the Paper Trading tab to submit simulated orders.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
