import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Target,
  Shield,
  Activity,
  Code2,
  FileCode,
  Languages,
  Sliders,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Send,
  BarChart3,
  Flame,
  Check,
  ChevronRight
} from 'lucide-react';
import { api } from '../services/api';
import { soundEngine } from '../audio/SoundEngine';

export const BacktestingPage: React.FC = () => {
  // Strategy Definition State
  const [strategyFormat, setStrategyFormat] = useState<'python' | 'pine' | 'english' | 'config'>('python');
  const [strategyName, setStrategyName] = useState('Institutional SMC Momentum');
  const [strategyCode, setStrategyCode] = useState('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1h');
  const [limitBars, setLimitBars] = useState(500);

  // Institutional Execution Parameters
  const [initialCapital, setInitialCapital] = useState(100000);
  const [riskPerTrade, setRiskPerTrade] = useState(1.0);
  const [targetRR, setTargetRR] = useState(10.0);
  const [stopLossAtr, setStopLossAtr] = useState(1.5);
  const [spreadPips, setSpreadPips] = useState(1.0);
  const [commissionLot, setCommissionLot] = useState(5.0);
  const [slippageBps, setSlippageBps] = useState(3.0);
  const [leverage, setLeverage] = useState(50);

  // Execution & Results State
  const [running, setRunning] = useState(false);
  const [presets, setPresets] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const res = await api.getStrategyPresets();
      setPresets(res);
      // Preload first Python preset
      if (res?.python?.length > 0) {
        setStrategyCode(res.python[0].code);
        setStrategyName(res.python[0].name);
      }
    } catch (err) {
      console.error('Error loading strategy presets:', err);
    }
  };

  const handleSelectPreset = (preset: any, format: 'python' | 'pine' | 'english' | 'config') => {
    soundEngine.playTick();
    if (format !== 'config') {
      setStrategyFormat(format);
    }
    setStrategyName(preset.name);
    setStrategyCode(preset.code);
  };

  const handleRunSimulation = async () => {
    setRunning(true);
    setDeploySuccess(null);
    soundEngine.playTick();
    try {
      const res = await api.runCustomBacktest({
        strategy_name: strategyName,
        strategy_format: strategyFormat,
        strategy_code: strategyCode,
        symbol,
        timeframe,
        limit_bars: limitBars,
        initial_capital: initialCapital,
        risk_per_trade_pct: riskPerTrade,
        spread_pips: spreadPips,
        commission_per_lot: commissionLot,
        slippage_bps: slippageBps,
        leverage,
        target_rr: targetRR,
        stop_loss_atr_mult: stopLossAtr
      });
      setReport(res);
      soundEngine.playChime();
    } catch (err: any) {
      soundEngine.playFrostLock();
      alert(`Backtest Simulation Error: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  const handleDeployToAlgo = async () => {
    if (!report) return;
    setDeploying(true);
    soundEngine.playTick();
    try {
      const res = await api.deployToAlgo({
        strategy_name: strategyName,
        strategy_format: strategyFormat,
        strategy_code: strategyCode,
        symbol,
        target_rr: targetRR,
        risk_per_trade_pct: riskPerTrade
      });
      setDeploySuccess(res.message);
      soundEngine.playChime();
    } catch (err: any) {
      soundEngine.playFrostLock();
      alert(`Algo Promotion Error: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  };

  // Render SVG Equity Curve
  const renderEquityCurve = () => {
    if (!report || !report.equity_curve || report.equity_curve.length < 2) return null;

    const points = report.equity_curve;
    const equities = points.map((p: any) => p.equity);
    const minEq = Math.min(...equities) * 0.99;
    const maxEq = Math.max(...equities) * 1.01;
    const range = maxEq - minEq || 1;

    const width = 800;
    const height = 220;

    const polylinePoints = points
      .map((p: any, i: number) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - ((p.equity - minEq) / range) * (height - 30) - 15;
        return `${x},${y}`;
      })
      .join(' ');

    const isProfitable = report.total_return_pct >= 0;
    const strokeColor = isProfitable ? '#00F5A0' : '#FF3366';

    return (
      <div className="w-full bg-[#0d121d]/80 p-5 rounded-2xl border border-slate-800/80 shadow-2xl">
        <div className="flex items-center justify-between text-xs mb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono font-bold text-slate-200 tracking-wider">EQUITY TRAJECTORY</span>
          </div>
          <span className="font-mono text-cyan-400">
            ${report.initial_capital.toLocaleString()} ➔ ${report.final_capital.toLocaleString()} ({report.total_return_pct > 0 ? '+' : ''}{report.total_return_pct}%)
          </span>
        </div>
        <div className="w-full overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible">
            <defs>
              <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <polygon
              points={`0,${height} ${polylinePoints} ${width},${height}`}
              fill="url(#eqGrad)"
            />
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.5"
              points={polylinePoints}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    );
  };

  // Render High-R:R Distribution Histogram
  const renderRDistribution = () => {
    if (!report || !report.r_distribution) return null;
    const dist = report.r_distribution;

    const buckets = [
      { label: '-1R (Loss)', count: dist.loss_full, color: 'bg-rose-500' },
      { label: '0R (BE)', count: dist.breakeven, color: 'bg-slate-500' },
      { label: '1R - 3R', count: dist['1R_to_3R'], color: 'bg-cyan-500' },
      { label: '3R - 5R', count: dist['3R_to_5R'], color: 'bg-blue-500' },
      { label: '5R - 10R', count: dist['5R_to_10R'], color: 'bg-indigo-500' },
      { label: '10R - 20R', count: dist['10R_to_20R'], color: 'bg-emerald-500' },
      { label: '20R - 30R', count: dist['20R_to_30R'], color: 'bg-emerald-400' },
      { label: '30R+ (Jackpot)', count: dist['30R_plus'], color: 'bg-amber-400' }
    ];

    const maxCount = Math.max(...buckets.map(b => b.count), 1);

    return (
      <div className="bg-[#0d121d]/80 p-5 rounded-2xl border border-slate-800/80 shadow-2xl">
        <div className="flex items-center justify-between text-xs mb-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="font-mono font-bold text-slate-200 tracking-wider">R-MULTIPLE HARVEST (1:10 TO 1:30)</span>
          </div>
          <span className="font-mono text-emerald-400 text-[11px]">E[R]: {report.expectancy_r > 0 ? '+' : ''}{report.expectancy_r}R / Trade</span>
        </div>
        <div className="grid grid-cols-8 gap-2 h-28 items-end pt-2">
          {buckets.map((b, idx) => {
            const heightPct = Math.max((b.count / maxCount) * 100, 6);
            return (
              <div key={idx} className="flex flex-col items-center h-full justify-end group">
                <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                  {b.count}
                </span>
                <div
                  className={`w-full rounded-t-md ${b.color} transition-all duration-500 shadow-lg`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[9px] font-mono text-slate-400 mt-2 truncate max-w-full text-center">
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 p-6 space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Code2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                QUANT STRATEGY BACKTESTING STUDIO
                <span className="text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                  PHASE 4 // EVENT-DRIVEN
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Zero-Fluff Backtester: Python AST Sandboxing • Pine Script v5 Transpiler • Plain-English Rules • Real OHLCV
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {report && (
            <button
              onClick={handleDeployToAlgo}
              disabled={deploying}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold transition-all shadow-lg hover:shadow-emerald-500/10"
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              {deploying ? 'PROMOTING...' : '1-CLICK DEPLOY TO ALGO ENGINE'}
            </button>
          )}

          <button
            onClick={handleRunSimulation}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-mono font-bold transition-all shadow-xl hover:shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
          >
            <Play className={`w-4 h-4 fill-current ${running ? 'animate-spin' : ''}`} />
            {running ? 'SIMULATING REAL BARS...' : 'EXECUTE INSTITUTIONAL BACKTEST'}
          </button>
        </div>
      </div>

      {deploySuccess && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{deploySuccess}</span>
          </div>
          <span className="text-[10px] text-emerald-400/80">Active in Algo Coordinator (High-R:R Runner)</span>
        </div>
      )}

      {/* Main Grid: Code Editor on Left, Simulation Parameters & Presets on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Code / Rule Editor (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#0b0f19] border border-slate-800/80 rounded-2xl p-5 shadow-2xl flex flex-col h-[560px]">
            {/* Format Selector Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStrategyFormat('python'); soundEngine.playTick(); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    strategyFormat === 'python'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3.5 h-3.5" />
                  PYTHON CODE
                </button>
                <button
                  onClick={() => { setStrategyFormat('pine'); soundEngine.playTick(); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    strategyFormat === 'pine'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  PINE SCRIPT v5
                </button>
                <button
                  onClick={() => { setStrategyFormat('english'); soundEngine.playTick(); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
                    strategyFormat === 'english'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Languages className="w-3.5 h-3.5" />
                  PLAIN ENGLISH
                </button>
              </div>

              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="Strategy Name"
                className="bg-slate-900/60 border border-slate-800 text-xs font-mono text-cyan-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-cyan-500/50 w-56 text-right"
              />
            </div>

            {/* Code / Rule Text Area */}
            <div className="relative flex-1">
              <textarea
                value={strategyCode}
                onChange={(e) => setStrategyCode(e.target.value)}
                spellCheck="false"
                placeholder={
                  strategyFormat === 'python'
                    ? "def generate_signals(df):\n    # Custom Python AST logic\n    return signals"
                    : strategyFormat === 'pine'
                    ? "//@version=5\nstrategy('My Script')\nfast = ta.ema(close, 9)..."
                    : "Buy when RSI is below 30 and price is above EMA 200. Exit when RSI > 70. SL at 1.5 ATR, TP at 1:10 RR"
                }
                className="w-full h-full bg-[#07090e] border border-slate-800/80 rounded-xl p-4 font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 resize-none leading-relaxed tracking-wide selection:bg-cyan-500/20"
              />
            </div>

            {/* Editor Footer / Compiler Info */}
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-3 border-t border-slate-800/60 mt-3">
              <span>Security: Safe AST Execution • Zero-Lookahead Bias Guaranteed</span>
              <span className="text-cyan-400/80">Format: {strategyFormat.toUpperCase()}</span>
            </div>
          </div>

          {/* Institutional Presets */}
          {presets && (
            <div className="bg-[#0b0f19] border border-slate-800/80 rounded-2xl p-4 shadow-xl">
              <div className="text-xs font-mono font-bold text-slate-300 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                INSTITUTIONAL STRATEGY PRESETS (1-CLICK LOAD)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {presets[strategyFormat]?.map((p: any) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPreset(p, strategyFormat)}
                    className="p-3 rounded-xl bg-slate-900/60 hover:bg-cyan-500/10 border border-slate-800 hover:border-cyan-500/30 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-300">
                        {p.name}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {p.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Execution Parameters & Real Market Data Config (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#0b0f19] border border-slate-800/80 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                EXECUTION SIMULATOR CONTROLS
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">ASSET SYMBOL</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-cyan-300 p-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="BTCUSDT">BTC/USDT (Crypto)</option>
                  <option value="ETHUSDT">ETH/USDT (Crypto)</option>
                  <option value="SOLUSDT">SOL/USDT (Crypto)</option>
                  <option value="EURUSD">EUR/USD (Forex)</option>
                  <option value="GBPUSD">GBP/USD (Forex)</option>
                  <option value="XAUUSD">XAU/USD (Gold Metal)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">TIMEFRAME</label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-cyan-300 p-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50"
                >
                  <option value="5m">5 Minutes (Sniper)</option>
                  <option value="15m">15 Minutes (LTF Confirmation)</option>
                  <option value="1h">1 Hour (HTF Swing)</option>
                  <option value="4h">4 Hours (Macro Bias)</option>
                  <option value="1d">1 Day (Institutional)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">INITIAL CAPITAL ($)</label>
                <input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Number(e.target.value))}
                  className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-slate-200 p-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">REAL BARS LOOKBACK</label>
                <input
                  type="number"
                  value={limitBars}
                  onChange={(e) => setLimitBars(Number(e.target.value))}
                  className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-slate-200 p-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">TARGET R:R MULTIPLIER</label>
                <select
                  value={targetRR}
                  onChange={(e) => setTargetRR(Number(e.target.value))}
                  className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-emerald-400 p-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 font-bold"
                >
                  <option value={5}>1:5 R:R (Standard Momentum)</option>
                  <option value={10}>1:10 R:R (Price Action Sniper)</option>
                  <option value={15}>1:15 R:R (SMC Order Flow)</option>
                  <option value={20}>1:20 R:R (ICT Silver Bullet)</option>
                  <option value={30}>1:30 R:R (Institutional Runner)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-slate-400 block mb-1">RISK PER TRADE (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={riskPerTrade}
                  onChange={(e) => setRiskPerTrade(Number(e.target.value))}
                  className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-slate-200 p-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>

            <div className="border-t border-slate-800/80 pt-3">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-2 font-bold">
                REALISTIC SLIPPAGE & SPREAD FRICTION
              </span>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-0.5">SPREAD (PIPS)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={spreadPips}
                    onChange={(e) => setSpreadPips(Number(e.target.value))}
                    className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-slate-300 p-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-0.5">COMMISSION ($/LOT)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={commissionLot}
                    onChange={(e) => setCommissionLot(Number(e.target.value))}
                    className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-slate-300 p-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono text-slate-500 block mb-0.5">SLIPPAGE (BPS)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={slippageBps}
                    onChange={(e) => setSlippageBps(Number(e.target.value))}
                    className="w-full bg-[#07090e] border border-slate-800 text-xs font-mono text-slate-300 p-2 rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Results Dashboard */}
      {report && (
        <div className="space-y-6 animate-fadeIn">
          {/* Key Metric Gauges */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">NET RETURN</span>
              <span className={`text-lg font-mono font-bold ${report.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {report.total_return_pct >= 0 ? '+' : ''}{report.total_return_pct}%
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">${report.net_profit?.toLocaleString()}</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">WIN RATE</span>
              <span className="text-lg font-mono font-bold text-cyan-400">
                {report.win_rate_pct}%
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">{report.winning_trades}W / {report.losing_trades}L</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">PROFIT FACTOR</span>
              <span className="text-lg font-mono font-bold text-emerald-400">
                {report.profit_factor}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Gross W / Gross L</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">EXPECTANCY E[R]</span>
              <span className={`text-lg font-mono font-bold ${report.expectancy_r >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {report.expectancy_r >= 0 ? '+' : ''}{report.expectancy_r}R
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Per Completed Trade</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">SHARPE RATIO</span>
              <span className="text-lg font-mono font-bold text-slate-200">
                {report.sharpe_ratio}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Annualized Rf 4%</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">SORTINO RATIO</span>
              <span className="text-lg font-mono font-bold text-cyan-400">
                {report.sortino_ratio}
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Downside Adjusted</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">MAX DRAWDOWN</span>
              <span className="text-lg font-mono font-bold text-rose-400">
                {report.max_drawdown_pct}%
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Peak-to-Trough</span>
            </div>

            <div className="bg-[#0b0f19] border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[10px] font-mono text-slate-400 block">MONTE CARLO 95%</span>
              <span className="text-lg font-mono font-bold text-amber-400">
                {report.monte_carlo_95_dd_pct}%
              </span>
              <span className="text-[10px] font-mono text-slate-500 block mt-0.5">Stress Test Ruin DD</span>
            </div>
          </div>

          {/* Equity Trajectory & R-Distribution Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderEquityCurve()}
            {renderRDistribution()}
          </div>

          {/* Trade Replay Execution Table */}
          <div className="bg-[#0b0f19] border border-slate-800/80 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between text-xs mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span className="font-mono font-bold text-slate-200 tracking-wider">
                  VISUAL TRADE REPLAY LOG ({report.trades?.length || 0} EXECUTIONS)
                </span>
              </div>
              <span className="font-mono text-slate-500 text-[11px]">
                Commission Deducted: ${report.total_commissions}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-400">
                    <th className="py-2 px-3">ID</th>
                    <th className="py-2 px-3">SIDE</th>
                    <th className="py-2 px-3">ENTRY TIME</th>
                    <th className="py-2 px-3">ENTRY</th>
                    <th className="py-2 px-3">STOP LOSS</th>
                    <th className="py-2 px-3">TAKE PROFIT</th>
                    <th className="py-2 px-3">EXIT TIME</th>
                    <th className="py-2 px-3">EXIT</th>
                    <th className="py-2 px-3">REASON</th>
                    <th className="py-2 px-3 text-right">NET P&L</th>
                    <th className="py-2 px-3 text-right">REALIZED R</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {report.trades?.slice(0, 30).map((t: any) => (
                    <tr key={t.trade_id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 text-cyan-400">{t.trade_id}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300">
                          {t.side}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">{t.entry_time?.slice(0, 16)}</td>
                      <td className="py-2.5 px-3 text-slate-200">${t.entry_price?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-rose-400">${t.stop_loss?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-emerald-400">${t.take_profit?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-400">{t.exit_time?.slice(0, 16)}</td>
                      <td className="py-2.5 px-3 text-slate-200">${t.exit_price?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          t.exit_reason === 'TAKE_PROFIT_FULL'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : t.exit_reason === 'STOP_LOSS'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {t.exit_reason}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${t.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.net_pnl >= 0 ? '+' : ''}${t.net_pnl?.toLocaleString()}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${t.realized_r >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {t.realized_r >= 0 ? '+' : ''}{t.realized_r}R
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
