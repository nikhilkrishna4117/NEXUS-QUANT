import React, { useState, useEffect } from 'react';
import {
  Brain,
  PlusCircle,
  Play,
  Pause,
  Save,
  CheckCircle,
  Sparkles,
  Sliders,
  Layers,
  ArrowRight,
  Zap,
  Target,
  Shield,
  Activity,
  Crosshair
} from 'lucide-react';
import { api } from '../services/api';
import { Strategy } from '../types';
import { soundEngine } from '../audio/SoundEngine';

export const StrategyLabPage: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [aiRegime, setAiRegime] = useState<string | null>(null);

  // High-R:R Autonomous Algo Bots State
  const [algoBots, setAlgoBots] = useState<any[]>([]);
  const [activeSignals, setActiveSignals] = useState<any[]>([]);
  const [scanningSymbol, setScanningSymbol] = useState('BTCUSDT');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Strategy Builder State
  const [builderName, setBuilderName] = useState('');
  const [builderDesc, setBuilderDesc] = useState('');
  const [builderCategory, setBuilderCategory] = useState('trend_following');
  const [builderSymbol, setBuilderSymbol] = useState('BTCUSDT');
  const [builderTimeframe, setBuilderTimeframe] = useState('1h');
  const [strategyType, setStrategyType] = useState('ema_crossover');

  // Parameters
  const [fastPeriod, setFastPeriod] = useState(9);
  const [slowPeriod, setSlowPeriod] = useState(21);
  const [rsiThreshold, setRsiThreshold] = useState(30);
  const [stopLossAtr, setStopLossAtr] = useState(2.0);
  const [takeProfitAtr, setTakeProfitAtr] = useState(4.5);
  const [riskPerTrade, setRiskPerTrade] = useState(2.0);

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadStrategies();
    loadAlgoBots();
    loadAlgoSignals();
    const interval = setInterval(() => {
      loadAlgoBots();
      loadAlgoSignals();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAlgoBots = async () => {
    try {
      const res = await api.getAlgoBots();
      if (res?.bots) setAlgoBots(res.bots);
    } catch {}
  };

  const loadAlgoSignals = async () => {
    try {
      const res = await api.getAlgoSignals(10);
      if (res?.signals) setActiveSignals(res.signals);
    } catch {}
  };

  const handleToggleBot = async (botId: string, currentStatus: boolean) => {
    soundEngine.playTick();
    try {
      await api.toggleAlgoBot(botId, !currentStatus);
      soundEngine.playChime();
      await loadAlgoBots();
    } catch (err: any) {
      alert(`Failed to toggle bot: ${err.message}`);
    }
  };

  const handleManualScan = async (sym: string) => {
    setIsScanning(true);
    soundEngine.playTick();
    setScanMessage(null);
    try {
      const res = await api.scanAlgo(sym);
      if (res?.signal) {
        soundEngine.playChime();
        setScanMessage(`🎯 High-R:R Signal Triggered on ${sym}! Executed via Pre-Trade Firewall.`);
      } else {
        setScanMessage(res?.message || `Scan completed: No setup met strict 1:10+ criteria.`);
      }
      await Promise.all([loadAlgoBots(), loadAlgoSignals()]);
    } catch (err: any) {
      setScanMessage(`Scan error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const loadStrategies = async () => {
    try {
      const list = await api.getStrategies();
      setStrategies(list);
      setLoading(false);
    } catch (err) {
      console.error('Error loading strategies:', err);
      setLoading(false);
    }
  };

  const handleGenerateAIStrategies = async () => {
    setGenerating(true);
    try {
      const res = await api.generateAIStrategies('BTCUSDT', '1h');
      setAiRegime(res.market_regime);
      await loadStrategies();
      setGenerating(false);
    } catch (err) {
      console.error('Error generating AI candidate strategies:', err);
      setGenerating(false);
    }
  };

  const handleSaveCustomStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!builderName.trim()) return;

    try {
      const config = {
        type: strategyType,
        fast_period: fastPeriod,
        slow_period: slowPeriod,
        oversold_threshold: rsiThreshold,
        stop_loss_atr_mult: stopLossAtr,
        take_profit_atr_mult: takeProfitAtr,
        risk_per_trade_pct: riskPerTrade,
      };

      await api.createStrategy({
        name: builderName,
        description: builderDesc,
        category: builderCategory,
        symbol: builderSymbol,
        timeframe: builderTimeframe,
        config,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      setBuilderName('');
      setBuilderDesc('');
      await loadStrategies();
    } catch (err: any) {
      alert(`Failed to save strategy: ${err.message}`);
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
      {/* ============================================================== */}
      {/* 1. HIGH-R:R AUTONOMOUS ALGO ENGINE CONTROL PANEL (1:10 - 1:30) */}
      {/* ============================================================== */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#070b14] via-[#0b1222] to-[#070b14] border border-cyan-500/30 shadow-[0_15px_40px_rgba(0,0,0,0.6)] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-[0_0_20px_rgba(56,189,248,0.4)]">
              <Crosshair className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white tracking-wide">
                  HIGH-R:R AUTONOMOUS ALGO ENGINE
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 animate-pulse">
                  1:10 TO 1:30 ASYMMETRY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Timeframe confluence (4H Macro Bias + 5m Sniper Entry) with automated 1:3 Breakeven, 1:5 Partial Scale-Out, and Trailing Runners.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 font-mono text-xs">
              <span className="text-slate-400">Scan:</span>
              <select
                value={scanningSymbol}
                onChange={(e) => setScanningSymbol(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none"
              >
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="XAUUSD">XAU/USD (Gold)</option>
                <option value="EURUSD">EUR/USD</option>
              </select>
            </div>

            <button
              onClick={() => handleManualScan(scanningSymbol)}
              disabled={isScanning}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-mono font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(56,189,248,0.4)] transition"
            >
              <Zap className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'SCAN & EXECUTE'}</span>
            </button>
          </div>
        </div>

        {scanMessage && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 font-mono text-xs text-cyan-300 flex items-center gap-2 animate-in fade-in duration-200">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>{scanMessage}</span>
          </div>
        )}

        {/* 3 Autonomous Bot Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {algoBots.map((bot) => {
            const isActive = bot.is_active;
            return (
              <div
                key={bot.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-slate-900/60 border-cyan-500/40 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                    : 'bg-slate-900/20 border-slate-800 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {bot.framework}
                  </span>
                  <button
                    onClick={() => handleToggleBot(bot.id, isActive)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold border transition ${
                      isActive
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {isActive ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
                    <span>{isActive ? 'ACTIVE' : 'PAUSED'}</span>
                  </button>
                </div>

                <h3 className="text-sm font-black text-white line-clamp-1">{bot.name}</h3>

                <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 font-mono text-center">
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Target R:R</span>
                    <span className="text-xs font-black text-emerald-400">1:{bot.target_rr}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Risk/Trade</span>
                    <span className="text-xs font-black text-cyan-300">{bot.risk_per_trade_pct}%</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-[9px] text-slate-400 block">Fills</span>
                    <span className="text-xs font-black text-white">{bot.trades_count}</span>
                  </div>
                </div>

                {bot.last_signal && (
                  <div className="mt-3 p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[10px] font-mono text-slate-300">
                    <span className="text-cyan-400 font-bold block mb-0.5">LATEST TRIGGER:</span>
                    <span>{bot.last_signal.side} @ ${bot.last_signal.entry_price} → TP3: ${bot.last_signal.take_profit_3}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Strategy Lab Banner */}
      <div className="bg-gradient-to-r from-blue-950/60 via-[#0c1017] to-cyan-950/40 border border-blue-900/40 rounded-2xl p-6 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-extrabold text-white">AI Strategy Development Lab</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Autonomous Quant Generator
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Continuously evaluates live market regimes, synthesizes multi-condition quantitative rules,
            optimizes stop-loss/take-profit boundaries, and filters candidates based on mathematical expectancy.
          </p>
          {aiRegime && (
            <p className="text-xs font-mono text-emerald-400 mt-2">
              ✨ Last generated tailored strategies for regime: <span className="font-bold">{aiRegime}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleGenerateAIStrategies}
          disabled={generating}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/25 transition disabled:opacity-50"
        >
          <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
          <span>{generating ? 'Synthesizing Candidates...' : 'Synthesize AI Strategies'}</span>
        </button>
      </div>

      {/* Grid: Strategy Catalog & Visual Strategy Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Visual Strategy Builder (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Visual Strategy Builder</span>
            </div>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                <CheckCircle className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveCustomStrategy} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Strategy Name</label>
              <input
                type="text"
                required
                placeholder="e.g. BTC Asymmetric Breakout Model"
                value={builderName}
                onChange={(e) => setBuilderName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Strategy Type / Architecture</label>
              <select
                value={strategyType}
                onChange={(e) => setStrategyType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-blue-500"
              >
                <option value="ema_crossover">EMA Trend Crossover (Fast / Slow + 200 Filter)</option>
                <option value="rsi_reversion">RSI Mean Reversion (Oversold Dip in Bull Regime)</option>
                <option value="macd_momentum">MACD Momentum Breakout + Volume Filter</option>
                <option value="bollinger_reversion">Bollinger Band Mean Reversion (2-Sigma Rebound)</option>
                <option value="atr_breakout">ATR Channel Breakout (Donchian Expansion)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Asset Symbol</label>
                <select
                  value={builderSymbol}
                  onChange={(e) => setBuilderSymbol(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                >
                  <option value="BTCUSDT">BTCUSDT</option>
                  <option value="ETHUSDT">ETHUSDT</option>
                  <option value="SOLUSDT">SOLUSDT</option>
                  <option value="GC=F">GC=F (Gold)</option>
                  <option value="RELIANCE.NS">RELIANCE.NS</option>
                  <option value="^NSEI">^NSEI (NIFTY)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Timeframe</label>
                <select
                  value={builderTimeframe}
                  onChange={(e) => setBuilderTimeframe(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
                >
                  <option value="15m">15m</option>
                  <option value="30m">30m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                  <option value="1d">1d</option>
                </select>
              </div>
            </div>

            {/* Strategy Parameters */}
            <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 space-y-3">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">Rule Parameters</span>

              {strategyType === 'ema_crossover' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400">Fast EMA Period</label>
                    <input
                      type="number"
                      value={fastPeriod}
                      onChange={(e) => setFastPeriod(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-white mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400">Slow EMA Period</label>
                    <input
                      type="number"
                      value={slowPeriod}
                      onChange={(e) => setSlowPeriod(Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-white mt-1"
                    />
                  </div>
                </div>
              )}

              {strategyType === 'rsi_reversion' && (
                <div>
                  <label className="text-[11px] text-slate-400">Oversold Threshold (RSI &lt; X)</label>
                  <input
                    type="number"
                    value={rsiThreshold}
                    onChange={(e) => setRsiThreshold(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-white mt-1"
                  />
                </div>
              )}

              {/* Risk Management & Sizing Settings */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <label className="text-slate-400">Stop-Loss (ATR)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={stopLossAtr}
                    onChange={(e) => setStopLossAtr(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Take-Profit (ATR)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={takeProfitAtr}
                    onChange={(e) => setTakeProfitAtr(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400">Risk % / Trade</label>
                  <input
                    type="number"
                    step="0.1"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 font-mono text-white mt-1"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Description / Research Hypothesis</label>
              <textarea
                rows={2}
                placeholder="Explain the quantitative rationale behind this strategy configuration..."
                value={builderDesc}
                onChange={(e) => setBuilderDesc(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white text-xs font-sans focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Strategy Configuration
            </button>
          </form>
        </div>

        {/* Right Column: Strategy Catalog & Comparison Matrix (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Strategy Catalog & Evaluation</span>
            </div>
            <span className="text-xs font-mono text-slate-400">{strategies.length} strategies</span>
          </div>

          <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
            {strategies.map((strat) => (
              <div
                key={strat.id}
                className={`p-4 rounded-xl border text-xs transition ${
                  strat.is_ai_generated
                    ? 'bg-gradient-to-r from-blue-950/30 to-purple-950/20 border-blue-900/40 hover:border-blue-700'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-100 text-sm">{strat.name}</h4>
                      {strat.is_ai_generated && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          AI LAB
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{strat.description}</p>
                  </div>

                  <span
                    className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold font-mono ${
                      strat.evaluation_label.includes('Strong')
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : strat.evaluation_label.includes('Promising')
                        ? 'bg-blue-950 text-blue-400 border border-blue-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {strat.evaluation_label}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                  <span>
                    Category: <strong className="text-slate-200 capitalize">{strat.category.replace('_', ' ')}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Target: <strong className="text-slate-200">{strat.symbol}</strong> ({strat.timeframe})
                  </span>
                  <span>•</span>
                  <span>
                    Rating Score: <strong className="text-blue-400">{strat.evaluation_score}</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
