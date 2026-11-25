import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Sliders,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  Save,
} from 'lucide-react';
import { api } from '../services/api';
import { RiskDashboardSummary } from '../types';

export const RiskManagementPage: React.FC = () => {
  const [summary, setSummary] = useState<RiskDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Config Form State
  const [maxRiskPerTrade, setMaxRiskPerTrade] = useState(2.0);
  const [maxDrawdown, setMaxDrawdown] = useState(15.0);
  const [maxDailyLoss, setMaxDailyLoss] = useState(5.0);
  const [maxOpenPositions, setMaxOpenPositions] = useState(5);
  const [minRR, setMinRR] = useState(1.5);
  const [requireSL, setRequireSL] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadRiskData();
    const interval = setInterval(loadRiskData, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadRiskData = async () => {
    try {
      const data = await api.getRiskDashboard();
      setSummary(data);
      setMaxRiskPerTrade(data.max_risk_per_trade_pct);
      setMaxDrawdown(data.max_drawdown_limit_pct);
      setMaxDailyLoss(data.max_daily_loss_limit_pct);
      setMaxOpenPositions(data.max_open_positions);
      setLoading(false);
    } catch (err) {
      console.error('Error loading risk dashboard:', err);
      setLoading(false);
    }
  };

  const handleToggleKillSwitch = async () => {
    try {
      const res = await api.toggleKillSwitch();
      await loadRiskData();
      alert(res.message);
    } catch (err: any) {
      alert(`Error toggling kill switch: ${err.message}`);
    }
  };

  const handleSaveRiskConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateRiskConfig({
        max_risk_per_trade_pct: Number(maxRiskPerTrade),
        max_portfolio_drawdown_pct: Number(maxDrawdown),
        max_daily_loss_pct: Number(maxDailyLoss),
        max_open_positions: Number(maxOpenPositions),
        min_risk_reward_ratio: Number(minRR),
        require_stop_loss: requireSL,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await loadRiskData();
    } catch (err: any) {
      alert(`Error saving risk configuration: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const isHalted = summary?.kill_switch_active ?? false;

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
      {/* Emergency Kill Switch Header Banner */}
      <div
        className={`p-6 rounded-2xl border flex flex-wrap items-center justify-between gap-4 shadow-2xl transition-all ${
          isHalted
            ? 'bg-rose-950/70 border-rose-600 animate-pulse text-rose-100'
            : 'bg-slate-900/80 border-slate-800 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              isHalted ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/50' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
            }`}
          >
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black tracking-wide">
              {isHalted ? 'EMERGENCY KILL SWITCH ACTIVE: TRADING HALTED' : 'Pre-Trade Institutional Risk Firewall'}
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mt-0.5">
              {isHalted
                ? 'All incoming strategy signals and manual order submissions are strictly intercepted and rejected.'
                : 'Every order is audited against portfolio exposure, stop-loss distance, and daily drawdown limits before routing.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleKillSwitch}
          className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition ${
            isHalted
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
              : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
          }`}
        >
          {isHalted ? 'Deactivate Kill Switch (Resume)' : 'Activate Emergency Kill Switch (Halt)'}
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl">
          <span className="text-[11px] text-slate-400">Total Portfolio Equity</span>
          <p className="text-2xl font-black font-mono text-white mt-1">
            ${summary?.account_equity != null ? summary.account_equity.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            Cash: ${summary?.available_capital != null ? summary.available_capital.toLocaleString() : '100,000'}
          </span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl">
          <span className="text-[11px] text-slate-400">Current Drawdown</span>
          <p
            className={`text-2xl font-black font-mono mt-1 ${
              (summary?.current_drawdown_pct ?? 0) > 10 ? 'text-rose-400' : 'text-slate-200'
            }`}
          >
            {summary?.current_drawdown_pct != null ? summary.current_drawdown_pct.toFixed(1) : '0.0'}%
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            Circuit Breaker Limit: {summary?.max_drawdown_limit_pct ?? 15}%
          </span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl">
          <span className="text-[11px] text-slate-400">Gross Portfolio Exposure</span>
          <p className="text-2xl font-black font-mono text-blue-400 mt-1">
            {summary?.exposure_pct != null ? summary.exposure_pct.toFixed(1) : '0.0'}%
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            Used Margin: ${summary?.used_margin != null ? summary.used_margin.toLocaleString() : '0.00'}
          </span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl">
          <span className="text-[11px] text-slate-400">Daily P&amp;L</span>
          <p
            className={`text-2xl font-black font-mono mt-1 ${
              (summary?.daily_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            ${summary?.daily_pnl != null ? summary.daily_pnl.toFixed(2) : '0.00'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">
            Daily Cap: {summary?.max_daily_loss_limit_pct ?? 5.0}%
          </span>
        </div>
      </div>

      {/* Main Row: Risk Limits Config & Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Risk Threshold Configuration Form (5 cols) */}
        <div className="lg:col-span-5 bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Risk Control Limits</span>
            </div>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Updated!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveRiskConfig} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Max Risk per Trade (% of Equity)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="10.0"
                value={maxRiskPerTrade}
                onChange={(e) => setMaxRiskPerTrade(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Standard institutional limit: 1.0% - 2.0%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Max Portfolio Drawdown (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={maxDrawdown}
                  onChange={(e) => setMaxDrawdown(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Max Daily Loss Limit (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={maxDailyLoss}
                  onChange={(e) => setMaxDailyLoss(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Max Open Positions</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxOpenPositions}
                  onChange={(e) => setMaxOpenPositions(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Min Risk-to-Reward Ratio</label>
                <input
                  type="number"
                  step="0.1"
                  value={minRR}
                  onChange={(e) => setMinRR(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireSL}
                  onChange={(e) => setRequireSL(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
                <span className="text-slate-300 font-semibold">Strictly Require Stop-Loss on Every Order</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Update Risk Parameters'}</span>
            </button>
          </form>
        </div>

        {/* Pre-Trade Audit Log (7 cols) */}
        <div className="lg:col-span-7 bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Pre-Trade Risk Audit Intercept Log
            </span>
            <span className="text-xs font-mono text-slate-500">Live Verification Log</span>
          </div>

          <div className="max-h-[380px] overflow-y-auto space-y-2.5">
            {summary?.recent_audit_logs && summary.recent_audit_logs.length > 0 ? (
              summary.recent_audit_logs.map((audit) => (
                <div
                  key={audit.id}
                  className={`p-3 rounded-lg border text-xs font-mono transition ${
                    audit.passed
                      ? 'bg-emerald-950/20 border-emerald-900/40 text-slate-300'
                      : 'bg-rose-950/30 border-rose-900/60 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 text-[11px]">
                    <div className="flex items-center gap-2">
                      {audit.passed ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span className="font-bold text-white">{audit.symbol}</span>
                      <span className="text-slate-500">•</span>
                      <span className="text-slate-400">{audit.action_type}</span>
                    </div>
                    <span className="text-slate-500">{new Date(audit.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] leading-relaxed pl-5 font-sans">{audit.reason}</p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs">
                No risk audit events logged yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
