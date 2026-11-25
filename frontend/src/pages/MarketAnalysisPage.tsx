import React, { useState, useEffect } from 'react';
import {
  Compass,
  Layers,
  Activity,
  Maximize2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Box,
  LineChart,
  Tv,
} from 'lucide-react';
import { CandlestickChart } from '../components/CandlestickChart';
import { ThreeMarketLandscape } from '../components/ThreeMarketLandscape';
import { TradingViewWidget } from '../components/TradingViewWidget';
import { TiltCard } from '../components/TiltCard';
import { api } from '../services/api';
import { Candle, MarketAnalysisResponse } from '../types';

export const MarketAnalysisPage: React.FC = () => {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [chartMode, setChartMode] = useState<'tv' | '3d' | '2d'>('tv');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [analysis, setAnalysis] = useState<MarketAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const instruments = [
    { symbol: 'BTCUSDT', name: 'Bitcoin (Binance)' },
    { symbol: 'ETHUSDT', name: 'Ethereum (Binance)' },
    { symbol: 'SOLUSDT', name: 'Solana (Binance)' },
    { symbol: 'GC=F', name: 'Gold Futures (Yahoo)' },
    { symbol: 'EURUSD=X', name: 'EUR/USD Forex (Yahoo)' },
    { symbol: 'RELIANCE.NS', name: 'Reliance NSE (Yahoo)' },
    { symbol: '^NSEI', name: 'NIFTY 50 Index (Yahoo)' },
  ];

  const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

  useEffect(() => {
    fetchMarketAnalysis();
  }, [symbol, timeframe]);

  const fetchMarketAnalysis = async () => {
    setLoading(true);
    try {
      const [candleRes, analysisRes] = await Promise.all([
        api.getCandles(symbol, timeframe, 150),
        api.getAnalysis(symbol, timeframe, 150),
      ]);
      setCandles(candleRes.candles || []);
      setAnalysis(analysisRes);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching market analysis:', err);
      setLoading(false);
    }
  };

  const ind = analysis?.indicators;
  const reg = analysis?.regime;
  const struct = analysis?.structure;

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0c1017] p-4 rounded-xl border border-slate-800/80 shadow-lg">
        {/* Symbol Selector */}
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium">Instrument:</label>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-white font-mono font-semibold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
          >
            {instruments.map((inst) => (
              <option key={inst.symbol} value={inst.symbol}>
                {inst.symbol} - {inst.name}
              </option>
            ))}
          </select>
        </div>

        {/* Timeframe Pills */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-xs font-mono font-semibold transition ${timeframe === tf
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* Perspective Mode Switcher: TradingView vs 3D vs 2D */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setChartMode('tv')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition ${
              chartMode === 'tv'
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-cyan-300" />
            TradingView Live
          </button>
          <button
            onClick={() => setChartMode('3d')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition ${
              chartMode === '3d'
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-cyan-300" />
            3D Depth Terrain
          </button>
          <button
            onClick={() => setChartMode('2d')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-semibold transition ${
              chartMode === '2d'
                ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.5)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LineChart className="w-3.5 h-3.5" />
            Quant Canvas
          </button>
        </div>

        {/* Refresh Button */}
        <button
          onClick={fetchMarketAnalysis}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Analysis</span>
        </button>
      </div>

      {/* Main Real-Time Chart: TradingView vs 3D vs Quant 2D */}
      {chartMode === 'tv' ? (
        <TradingViewWidget symbol={symbol} timeframe={timeframe} height={520} />
      ) : chartMode === '3d' ? (
        <ThreeMarketLandscape candles={candles} symbol={symbol} height={480} />
      ) : (
        <CandlestickChart
          candles={candles}
          symbol={symbol}
          timeframe={timeframe}
          indicators={ind}
          height={480}
        />
      )}

      {/* Market Regime & Condition Banner */}
      {reg && (
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <Compass className="w-5 h-5 text-blue-400" />
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Market Condition Classification</span>
                <h3 className="text-lg font-black text-white">{reg.regime}</h3>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${reg.bias === 'Bullish'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : reg.bias === 'Bearish'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
              >
                {reg.bias.toUpperCase()} BIAS
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                Confidence: {(reg.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">Quantitative Evidence & Technical Rationale:</p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 font-mono">
              {reg.rationale.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/50">
                  <span className="text-blue-400 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Grid: Market Structure & Pattern Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Structure Recognition */}
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Market Structure & Liquidity</span>
            </div>
            <span className="text-xs font-mono text-cyan-400 font-semibold">{struct?.structure || 'Analyzing...'}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[11px]">Last Swing High</span>
              <p className="text-sm font-bold text-emerald-400 mt-1">
                {struct?.last_swing_high ? `$${struct.last_swing_high.toFixed(2)}` : '--'}
              </p>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[11px]">Last Swing Low</span>
              <p className="text-sm font-bold text-rose-400 mt-1">
                {struct?.last_swing_low ? `$${struct.last_swing_low.toFixed(2)}` : '--'}
              </p>
            </div>
          </div>

          {/* Key Support and Resistance clusters */}
          <div className="space-y-3 pt-2 text-xs">
            <div>
              <span className="text-slate-400 font-semibold text-[11px]">Dynamic Resistance Ceilings</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {struct?.resistance_levels && struct.resistance_levels.length > 0 ? (
                  struct.resistance_levels.map((lvl, i) => (
                    <span key={i} className="px-2.5 py-1 bg-rose-950/40 text-rose-400 border border-rose-800/60 rounded font-mono font-semibold">
                      ${lvl.toFixed(2)}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 font-mono">No immediate resistance detected</span>
                )}
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-semibold text-[11px]">Dynamic Support Floors</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {struct?.support_levels && struct.support_levels.length > 0 ? (
                  struct.support_levels.map((lvl, i) => (
                    <span key={i} className="px-2.5 py-1 bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 rounded font-mono font-semibold">
                      ${lvl.toFixed(2)}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-500 font-mono">No immediate support detected</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chart Patterns Detected */}
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Detected Chart Patterns</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">{analysis?.patterns.length ?? 0} active</span>
          </div>

          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {analysis?.patterns && analysis.patterns.length > 0 ? (
              analysis.patterns.map((pat, idx) => (
                <div key={idx} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-200">{pat.name}</span>
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${pat.type === 'bullish'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                    >
                      {pat.type} ({(pat.confidence * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">{pat.description}</p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No dominant geometric chart patterns currently active in the selected window.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Technical Indicators Deep Dive Table */}
      {ind && (
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Technical Indicator Matrix</span>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px]">RSI (14)</span>
              <p className={`text-base font-bold mt-1 ${ind.rsi > 70 ? 'text-rose-400' : ind.rsi < 30 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {ind.rsi}
              </p>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px]">MACD Histogram</span>
              <p className={`text-base font-bold mt-1 ${ind.macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ind.macd.histogram}
              </p>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px]">ADX Trend Velocity</span>
              <p className={`text-base font-bold mt-1 ${ind.adx.adx > 25 ? 'text-amber-400' : 'text-slate-400'}`}>
                {ind.adx.adx}
              </p>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px]">ATR Volatility</span>
              <p className="text-base font-bold text-slate-200 mt-1">${ind.atr}</p>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px]">VWAP</span>
              <p className="text-base font-bold text-pink-400 mt-1">${ind.vwap}</p>
            </div>
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800">
              <span className="text-slate-500 text-[10px]">Volume vs 20-SMA</span>
              <p className={`text-base font-bold mt-1 ${ind.volume.ratio > 1.2 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {ind.volume.ratio}x
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
