import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  XCircle,
  Send,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Briefcase,
  Zap,
  Trash2,
  X,
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { PortfolioSummary, Strategy, Ticker24h, DemoAccount } from '../types';
import { soundEngine } from '../audio/SoundEngine';

export const PaperTradingPage: React.FC = () => {
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [ticker, setTicker] = useState<Ticker24h | null>(null);

  // Multi-Demo Accounts State
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<DemoAccount | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [accountToReset, setAccountToReset] = useState<DemoAccount | null>(null);

  // Create Account Form
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState('PROP_FIRM');
  const [newAccBalance, setNewAccBalance] = useState<number>(100000);
  const [customBalanceInput, setCustomBalanceInput] = useState('100000');
  const [resetBalanceAmt, setResetBalanceAmt] = useState<number>(100000);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Order Ticket State
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState(0.05);
  const [orderType, setOrderType] = useState('MARKET');
  const [stopLoss, setStopLoss] = useState(62000.0);
  const [takeProfit, setTakeProfit] = useState(68000.0);

  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPaperTradingData();
    loadAccounts();
    const interval = setInterval(() => {
      loadPaperTradingData();
      loadAccounts();
    }, 4000);
    return () => clearInterval(interval);
  }, [symbol]);

  const loadAccounts = async () => {
    try {
      const res = await api.getAccounts();
      if (res?.accounts) {
        setAccounts(res.accounts);
        const active = res.accounts.find((a) => a.is_active) || res.accounts[0] || null;
        setActiveAccount(active);
      }
    } catch (err) {
      console.error('Error loading demo accounts:', err);
    }
  };

  const loadPaperTradingData = async () => {
    try {
      const [port, strats, tick] = await Promise.all([
        api.getPortfolio(),
        api.getStrategies(),
        api.getTicker(symbol),
      ]);
      setPortfolio(port);
      setStrategies(strats);
      setTicker(tick);

      // Auto-populate reasonable SL / TP based on live price if not touched
      if (tick && tick.last_price > 0 && Math.abs(stopLoss - tick.last_price) > tick.last_price * 0.2) {
        if (side === 'BUY') {
          setStopLoss(Math.round(tick.last_price * 0.97));
          setTakeProfit(Math.round(tick.last_price * 1.06));
        } else {
          setStopLoss(Math.round(tick.last_price * 1.03));
          setTakeProfit(Math.round(tick.last_price * 0.94));
        }
      }
    } catch (err) {
      console.error('Error loading paper trading data:', err);
    }
  };

  const handleSwitchAccount = async (account: DemoAccount) => {
    if (account.id === activeAccount?.id) return;
    setIsActionLoading(true);
    soundEngine.playTick();
    try {
      await api.switchAccount(account.id);
      soundEngine.playChime();
      await Promise.all([loadAccounts(), loadPaperTradingData()]);
    } catch (err: any) {
      alert(`Failed to switch account: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    setIsActionLoading(true);
    try {
      await api.createAccount({
        name: newAccName.trim(),
        initial_balance: Number(newAccBalance),
        account_type: newAccType,
        currency: 'USD',
        set_active: true
      });
      soundEngine.playChime();
      setIsCreateModalOpen(false);
      setNewAccName('');
      await Promise.all([loadAccounts(), loadPaperTradingData()]);
    } catch (err: any) {
      alert(`Failed to create account: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResetSpecificAccount = async () => {
    const target = accountToReset || activeAccount;
    if (!target) return;
    setIsActionLoading(true);
    try {
      await api.resetAccount(Number(resetBalanceAmt), target.id);
      soundEngine.playSubDrop();
      setIsResetModalOpen(false);
      setAccountToReset(null);
      await Promise.all([loadAccounts(), loadPaperTradingData()]);
    } catch (err: any) {
      alert(`Failed to reset account: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.MouseEvent, accountId: number) => {
    e.stopPropagation();
    if (accounts.length <= 1) {
      alert('Cannot delete the only remaining account.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this demo account?')) {
      return;
    }
    try {
      await api.deleteAccount(accountId);
      soundEngine.playTick();
      await Promise.all([loadAccounts(), loadPaperTradingData()]);
    } catch (err: any) {
      alert(`Failed to delete account: ${err.message}`);
    }
  };

  const getAccountBadge = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'PROP_FIRM':
        return { label: 'PROP FIRM', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
      case 'CHALLENGE':
        return { label: 'CHALLENGE', color: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
      case 'SCALPER':
        return { label: 'SCALPER', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
      case 'SWING':
        return { label: 'SWING', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
      default:
        return { label: 'STANDARD', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setOrderError(null);
    setOrderSuccess(null);

    try {
      const res = await api.submitOrder({
        symbol,
        side,
        quantity: Number(quantity),
        order_type: orderType,
        price: ticker?.last_price,
        stop_loss: Number(stopLoss),
        take_profit: Number(takeProfit),
      });

      setOrderSuccess(`Order Filled: ${res.side} ${res.quantity} ${res.symbol} @ $${res.executed_price.toFixed(2)}`);
      await loadPaperTradingData();
    } catch (err: any) {
      setOrderError(err.message || 'Trade rejected by Risk Engine.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClosePosition = async (posId: number) => {
    try {
      await api.closePosition(posId);
      await loadPaperTradingData();
    } catch (err: any) {
      alert(`Failed to close position: ${err.message}`);
    }
  };

  const handleResetAccount = async () => {
    if (confirm('Are you sure you want to reset paper account balance to $100,000 and close all open positions?')) {
      try {
        await api.resetPaperAccount(100000.0);
        await loadPaperTradingData();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const currentPrice = ticker?.last_price ?? 64000.0;
  const riskAmount = Math.abs(currentPrice - stopLoss) * quantity;
  const rewardAmount = Math.abs(takeProfit - currentPrice) * quantity;
  const riskReward = rewardAmount / (riskAmount + 1e-10);

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
      {/* ============================================================== */}
      {/* MULTI-DEMO & PROP FIRM ACCOUNT MANAGER BANNER & SELECTOR       */}
      {/* ============================================================== */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#090e1a] via-[#0d1527] to-[#090e1a] border border-cyan-500/25 shadow-[0_10px_30px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(125,249,255,0.3)]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">
                  MULTI-DEMO &amp; PROP FIRM ACCOUNT MANAGER
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                  {accounts.length} ACCOUNTS ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Deploy, switch, and isolate positions, orders, and P&amp;L across distinct prop challenge &amp; simulation profiles.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundEngine.playChime();
                setIsCreateModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl text-xs font-mono font-black bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)] flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ DEPLOY NEW ACCOUNT</span>
            </button>
          </div>
        </div>

        {/* Account Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2">
          {accounts.map((acc) => {
            const isActive = acc.id === activeAccount?.id;
            const badge = getAccountBadge(acc.account_type);
            const pnlPositive = (acc.total_pnl ?? 0) >= 0;

            return (
              <div
                key={acc.id}
                className={`relative p-4 rounded-xl border transition-all ${
                  isActive
                    ? 'bg-cyan-950/40 border-cyan-400/60 shadow-[0_0_20px_rgba(125,249,255,0.18)]'
                    : 'bg-[#0a0f1d]/80 hover:bg-[#0f172a]/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Active Indicator Ribbon */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                    {badge.label}
                  </span>

                  {isActive ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40 shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      ACTIVE PROFILE
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSwitchAccount(acc)}
                      disabled={isActionLoading}
                      className="text-[10px] font-mono font-bold text-slate-400 hover:text-cyan-300 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 rounded border border-slate-700 transition"
                    >
                      SWITCH TO THIS
                    </button>
                  )}
                </div>

                {/* Account Name & Number */}
                <h4 className="text-sm font-extrabold text-white line-clamp-1">{acc.name}</h4>
                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                  ID: <span className="text-slate-300">{acc.account_number}</span>
                </p>

                {/* Account Metrics */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Equity</span>
                    <span className="text-sm font-black text-white">
                      ${acc.equity != null ? acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Total P&amp;L</span>
                    <span className={`text-xs font-bold ${pnlPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {pnlPositive ? '+' : ''}${acc.total_pnl != null ? acc.total_pnl.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-3 pt-2 border-t border-slate-800/50 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-500">
                    {acc.open_positions_count ?? 0} positions
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        soundEngine.playTick();
                        setAccountToReset(acc);
                        setIsResetModalOpen(true);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition"
                      title="Reset Account Balance"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    {accounts.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteAccount(e, acc.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/20 transition"
                        title="Delete Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account Balances Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl shadow-lg">
          <span className="text-[11px] text-slate-400">Account Equity</span>
          <p className="text-xl font-black font-mono text-white mt-1">
            ${portfolio?.equity != null ? portfolio.equity.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">Paper Master Account</span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl shadow-lg">
          <span className="text-[11px] text-slate-400">Cash Available</span>
          <p className="text-xl font-black font-mono text-slate-200 mt-1">
            ${portfolio?.cash_balance != null ? portfolio.cash_balance.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">Unallocated Liquidity</span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl shadow-lg">
          <span className="text-[11px] text-slate-400">Unrealized P&amp;L</span>
          <p
            className={`text-xl font-black font-mono mt-1 ${(portfolio?.unrealized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
          >
            ${portfolio?.unrealized_pnl != null ? portfolio.unrealized_pnl.toFixed(2) : '0.00'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">Live Mark-to-Market</span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl shadow-lg">
          <span className="text-[11px] text-slate-400">Realized P&amp;L</span>
          <p
            className={`text-xl font-black font-mono mt-1 ${(portfolio?.realized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
          >
            ${portfolio?.realized_pnl != null ? portfolio.realized_pnl.toFixed(2) : '0.00'}
          </p>
          <span className="text-[10px] text-slate-500 font-mono">Settled Gains/Losses</span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl shadow-lg">
          <span className="text-[11px] text-slate-400">Total Return</span>
          <p
            className={`text-xl font-black font-mono mt-1 ${(portfolio?.total_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
          >
            {(portfolio?.total_return_pct ?? 0) >= 0 ? '+' : ''}
            {portfolio?.total_return_pct != null ? portfolio.total_return_pct.toFixed(2) : '0.00'}%
          </p>
          <span className="text-[10px] text-slate-500 font-mono">Cumulative Performance</span>
        </div>

        <div className="p-4 bg-[#0c1017] border border-slate-800/80 rounded-xl shadow-lg flex items-center justify-center">
          <button
            onClick={handleResetAccount}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg border border-slate-700 flex items-center justify-center gap-2 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Account ($100k)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Order Ticket & Active Positions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Pre-Trade Order Entry Ticket (5 cols) */}
        <div className="lg:col-span-5 bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Order Execution Ticket</span>
            <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Risk Engine Verified</span>
            </div>
          </div>

          {/* Feedback Alerts */}
          {orderError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Order Rejected by Risk Engine</p>
                <p className="text-[11px] text-rose-400/90 mt-0.5">{orderError}</p>
              </div>
            </div>
          )}

          {orderSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{orderSuccess}</span>
            </div>
          )}

          <form onSubmit={handleOrderSubmit} className="space-y-4 text-xs">
            {/* Side Selector (BUY / SELL) */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSide('BUY')}
                className={`py-2 rounded-lg font-bold text-xs uppercase transition ${side === 'BUY' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Long / Buy
              </button>
              <button
                type="button"
                onClick={() => setSide('SELL')}
                className={`py-2 rounded-lg font-bold text-xs uppercase transition ${side === 'SELL' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Short / Sell
              </button>
            </div>

            {/* Symbol & Price Info */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Instrument</label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white"
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
                <label className="block text-slate-400 mb-1 font-medium">Market Reference Price</label>
                <div className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono font-bold text-white">
                  ${ticker?.last_price != null ? ticker.last_price.toFixed(2) : '0.00'}
                </div>
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Order Quantity</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                Estimated Order Notional: ${(quantity * currentPrice).toFixed(2)}
              </span>
            </div>

            {/* Stop Loss & Take Profit (Mandatory for Risk Verification) */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-rose-400 mb-1">
                  Stop-Loss Price <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={stopLoss}
                  onChange={(e) => setStopLoss(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-rose-900/60 rounded p-1.5 font-mono text-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Risk: ${riskAmount.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                  Take-Profit Price <span className="text-emerald-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-emerald-900/60 rounded p-1.5 font-mono text-white"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Reward: ${rewardAmount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Risk-Reward Indicator */}
            <div className="flex items-center justify-between text-xs font-mono px-3 py-2 bg-slate-900 rounded-lg border border-slate-800">
              <span className="text-slate-400">Calculated R:R Ratio:</span>
              <span className={`font-bold ${riskReward >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}`}>
                1 : {riskReward.toFixed(2)} {riskReward < 1.5 ? '(Minimum 1.5 required)' : '✓ Valid'}
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3 rounded-xl font-bold text-xs uppercase shadow-lg transition flex items-center justify-center gap-2 ${side === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                  : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25'
                } disabled:opacity-50`}
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Auditing & Submitting...' : `Submit Paper ${side} Order`}</span>
            </button>
          </form>
        </div>

        {/* Right: Active Open Positions & Order History (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Open Positions Card */}
          <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Active Open Positions ({portfolio?.open_positions.length ?? 0})
              </span>
              <span className="text-xs font-mono text-slate-400">Live Mark-to-Market P&amp;L</span>
            </div>

            <div className="overflow-x-auto">
              {portfolio?.open_positions && portfolio.open_positions.length > 0 ? (
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="pb-2">Symbol</th>
                      <th className="pb-2">Side</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Entry</th>
                      <th className="pb-2">Current</th>
                      <th className="pb-2">SL / TP</th>
                      <th className="pb-2">Unrealized P&amp;L</th>
                      <th className="pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {portfolio.open_positions.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 font-bold text-white">{p.symbol}</td>
                        <td className={`py-2.5 font-bold ${p.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {p.side}
                        </td>
                        <td className="py-2.5 text-slate-300">{p.quantity}</td>
                        <td className="py-2.5 text-slate-300">${p.entry_price.toFixed(2)}</td>
                        <td className="py-2.5 font-bold text-white">${p.current_price.toFixed(2)}</td>
                        <td className="py-2.5 text-[11px] text-slate-400">
                          {p.stop_loss ? `$${p.stop_loss}` : '--'} / {p.take_profit ? `$${p.take_profit}` : '--'}
                        </td>
                        <td className={`py-2.5 font-bold ${p.unrealized_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ${p.unrealized_pnl.toFixed(2)} ({p.unrealized_pnl_pct.toFixed(1)}%)
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => handleClosePosition(p.id)}
                            className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded text-[11px] font-sans font-semibold transition"
                          >
                            Close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-10 text-center text-slate-500 text-xs">
                  No active open positions. Submit a paper order using the order ticket on the left.
                </div>
              )}
            </div>
          </div>

          {/* Recent Orders Log & Rejection Audits */}
          <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Order Submissions &amp; Risk Firewall Audit Log
              </span>
              <span className="text-xs font-mono text-slate-500">Last 15 records</span>
            </div>

            <div className="max-h-56 overflow-y-auto">
              {portfolio?.recent_orders && portfolio.recent_orders.length > 0 ? (
                <table className="w-full text-xs text-left">
                  <thead className="text-[11px] text-slate-500 border-b border-slate-800 sticky top-0 bg-[#0c1017]">
                    <tr>
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Symbol</th>
                      <th className="pb-2">Side</th>
                      <th className="pb-2">Qty</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Details / Rejection Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {portfolio.recent_orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-900/40">
                        <td className="py-2 text-slate-400">{new Date(o.created_at).toLocaleTimeString()}</td>
                        <td className="py-2 font-bold text-white">{o.symbol}</td>
                        <td className={`py-2 font-bold ${o.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {o.side}
                        </td>
                        <td className="py-2 text-slate-300">{o.quantity}</td>
                        <td className="py-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${o.status === 'FILLED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-2 text-slate-400 text-[11px] font-sans truncate max-w-xs">
                          {o.reject_reason || 'Filled successfully'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No order history recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CREATE NEW DEMO ACCOUNT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#090d16] border border-cyan-500/30 shadow-[0_0_50px_rgba(56,189,248,0.25)] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border-b border-cyan-500/20 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-widest text-cyan-400 font-bold uppercase">
                  INSTITUTIONAL CAPITAL DISPATCHER
                </p>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>Deploy New Demo / Prop Account</span>
                  <Zap className="w-4 h-4 text-cyan-400" />
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Account Name / Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FTMO $100K Phase 1 / High-Leverage Scalp"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-cyan-400 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Account Framework Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'PROP_FIRM', label: 'Prop Firm Challenge', desc: 'Simulated 2-step evaluation rules' },
                    { id: 'STANDARD', label: 'Standard Master', desc: 'General discretionary & algo sandbox' },
                    { id: 'SCALPER', label: 'Sniper Scalp (1:10+)', desc: 'High frequency tight stop tests' },
                    { id: 'SWING', label: 'Macro Swing Portfolio', desc: 'Multi-day HTF liquidity trades' }
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => {
                        soundEngine.playTick();
                        setNewAccType(t.id);
                      }}
                      className={`p-3 text-left rounded-xl border transition ${
                        newAccType === t.id
                          ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-[0_0_15px_rgba(125,249,255,0.2)]'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <p className="text-xs font-bold">{t.label}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Starting Virtual Capital (USD)
                </label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[10000, 25000, 50000, 100000, 200000, 500000].map((amt) => (
                    <button
                      type="button"
                      key={amt}
                      onClick={() => {
                        soundEngine.playTick();
                        setNewAccBalance(amt);
                        setCustomBalanceInput(amt.toString());
                      }}
                      className={`py-2 text-center rounded-xl font-mono text-xs font-bold border transition ${
                        newAccBalance === amt
                          ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      ${(amt / 1000).toFixed(0)}K
                    </button>
                  ))}
                </div>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-2.5 text-slate-500 font-mono text-sm">$</span>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={customBalanceInput}
                    onChange={(e) => {
                      setCustomBalanceInput(e.target.value);
                      setNewAccBalance(Number(e.target.value));
                    }}
                    className="w-full pl-7 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={isActionLoading}
                  className="px-6 py-2.5 rounded-xl text-xs font-mono font-black bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)] disabled:opacity-50 transition"
                >
                  {isActionLoading ? 'DEPLOYING...' : '⚡ DEPLOY ACCOUNT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET ACCOUNT MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-[#090d16] border border-rose-500/30 shadow-[0_0_40px_rgba(244,63,94,0.25)] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border-b border-rose-500/20 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono tracking-widest text-rose-400 font-bold uppercase">
                  ACCOUNT BALANCE RESET
                </p>
                <h3 className="text-base font-black text-white">
                  Reset {(accountToReset || activeAccount)?.name || 'Account'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsResetModalOpen(false);
                  setAccountToReset(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300">
                This will liquidate any open positions on this account and restore starting liquidity back to the specified amount:
              </p>

              <div className="grid grid-cols-4 gap-2">
                {[25000, 50000, 100000, 200000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setResetBalanceAmt(amt)}
                    className={`py-2 text-center rounded-xl font-mono text-xs font-bold border transition ${
                      resetBalanceAmt === amt
                        ? 'bg-rose-950/60 border-rose-400 text-rose-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    ${(amt / 1000).toFixed(0)}K
                  </button>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetModalOpen(false);
                    setAccountToReset(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleResetSpecificAccount}
                  disabled={isActionLoading}
                  className="px-5 py-2 rounded-xl text-xs font-mono font-black bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] disabled:opacity-50 transition"
                >
                  {isActionLoading ? 'RESETTING...' : 'CONFIRM RESET'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
