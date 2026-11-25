import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Plus,
  RotateCcw,
  Check,
  Shield,
  Briefcase,
  Zap,
  TrendingUp,
  Trash2,
  X,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api';
import { DemoAccount } from '../types';
import { soundEngine } from '../audio/SoundEngine';

interface DemoAccountSwitcherProps {
  onAccountSwitched?: (account: DemoAccount) => void;
  compact?: boolean;
}

export const DemoAccountSwitcher: React.FC<DemoAccountSwitcherProps> = ({
  onAccountSwitched,
  compact = false
}) => {
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [activeAccount, setActiveAccount] = useState<DemoAccount | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // New Account Form State
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('PROP_FIRM');
  const [newBalance, setNewBalance] = useState<number>(100000);
  const [customBalance, setCustomBalance] = useState<string>('100000');

  // Reset Account State
  const [resetBalance, setResetBalance] = useState<number>(100000);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchAccounts = async () => {
    try {
      const res = await api.getAccounts();
      if (res?.accounts) {
        setAccounts(res.accounts);
        const active = res.accounts.find((a) => a.is_active) || res.accounts[0] || null;
        setActiveAccount(active);
      }
    } catch (err) {
      console.error('Failed to fetch demo accounts:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 8000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchAccount = async (account: DemoAccount) => {
    if (account.id === activeAccount?.id) {
      setIsOpen(false);
      return;
    }
    setLoading(true);
    soundEngine.playTick();
    try {
      await api.switchAccount(account.id);
      await fetchAccounts();
      soundEngine.playChime();
      if (onAccountSwitched) onAccountSwitched(account);
      setIsOpen(false);
    } catch (err: any) {
      alert(`Failed to switch account: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await api.createAccount({
        name: newName.trim(),
        initial_balance: Number(newBalance),
        account_type: newType,
        currency: 'USD',
        set_active: true
      });
      soundEngine.playChime();
      setIsModalOpen(false);
      setNewName('');
      await fetchAccounts();
      if (res?.account && onAccountSwitched) {
        onAccountSwitched(res.account);
      }
    } catch (err: any) {
      alert(`Failed to create demo account: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!activeAccount) return;
    setLoading(true);
    try {
      await api.resetAccount(Number(resetBalance), activeAccount.id);
      soundEngine.playSubDrop();
      setIsResetModalOpen(false);
      await fetchAccounts();
    } catch (err: any) {
      alert(`Failed to reset account: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (e: React.MouseEvent, accountId: number) => {
    e.stopPropagation();
    if (accounts.length <= 1) {
      alert('Cannot delete the only remaining trading account.');
      return;
    }
    if (!confirm('Are you sure you want to permanently delete this demo account and its trade records?')) {
      return;
    }
    try {
      await api.deleteAccount(accountId);
      soundEngine.playTick();
      await fetchAccounts();
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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Account Pill Trigger */}
      <button
        onClick={() => {
          soundEngine.playTick();
          setIsOpen(!isOpen);
        }}
        className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border transition duration-150 ${
          isOpen
            ? 'bg-cyan-950/60 border-cyan-400/50 shadow-[0_0_15px_rgba(125,249,255,0.25)]'
            : 'bg-slate-900/90 hover:bg-slate-800/90 border-slate-800 hover:border-cyan-500/30'
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-100 group-hover:text-cyan-300 transition line-clamp-1 max-w-[130px] sm:max-w-[180px]">
              {activeAccount?.name || 'Master Trading Account'}
            </span>
            {activeAccount && (
              <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border ${getAccountBadge(activeAccount.account_type).color}`}>
                {getAccountBadge(activeAccount.account_type).label}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
            <span className="font-semibold text-emerald-400">
              ${activeAccount?.equity != null ? activeAccount.equity.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400">
              {activeAccount?.account_number || 'ACC-DEMO'}
            </span>
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#090d16]/95 backdrop-blur-2xl border border-cyan-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 overflow-hidden divide-y divide-slate-800/60 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900/80 via-cyan-950/20 to-slate-900/80 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono tracking-wider uppercase text-cyan-400 font-bold">
                MULTI-ACCOUNT DISPATCHER
              </p>
              <p className="text-xs text-slate-300 font-semibold">
                Select or Deploy Demo Accounts ({accounts.length})
              </p>
            </div>
            <button
              onClick={() => {
                soundEngine.playChime();
                setIsModalOpen(true);
                setIsOpen(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_12px_rgba(56,189,248,0.4)] transition"
            >
              <Plus className="w-3 h-3" />
              <span>NEW ACCOUNT</span>
            </button>
          </div>

          {/* Accounts List */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccount?.id;
              const badge = getAccountBadge(acc.account_type);
              const pnlPos = (acc.total_pnl ?? 0) >= 0;

              return (
                <div
                  key={acc.id}
                  onClick={() => handleSwitchAccount(acc)}
                  className={`group relative p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                    isActive
                      ? 'bg-cyan-950/40 border-cyan-400/40 shadow-[0_0_15px_rgba(125,249,255,0.12)]'
                      : 'bg-slate-900/50 hover:bg-slate-800/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-black text-xs ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_10px_rgba(125,249,255,0.3)]'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isActive ? <Check className="w-4 h-4 text-cyan-300" /> : <Briefcase className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold line-clamp-1 ${isActive ? 'text-cyan-200' : 'text-slate-200'}`}>
                          {acc.name}
                        </span>
                        <span className={`text-[8px] font-mono font-bold px-1 py-0.2 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] font-mono text-slate-400">
                        <span>{acc.account_number}</span>
                        <span>•</span>
                        <span>{acc.open_positions_count ?? 0} open pos</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-slate-100">
                        ${acc.equity != null ? acc.equity.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '100,000.00'}
                      </p>
                      <p className={`text-[10px] font-mono font-semibold ${pnlPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnlPos ? '+' : ''}${acc.total_pnl != null ? acc.total_pnl.toFixed(2) : '0.00'}
                      </p>
                    </div>

                    {accounts.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteAccount(e, acc.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition"
                        title="Delete Demo Account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-slate-900/60 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                soundEngine.playTick();
                setIsResetModalOpen(true);
                setIsOpen(false);
              }}
              className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-300 transition"
            >
              <RotateCcw className="w-3 h-3 text-cyan-400" />
              <span>Reset Active Balance</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playChime();
                setIsModalOpen(true);
                setIsOpen(false);
              }}
              className="flex items-center gap-1 text-[11px] font-mono font-bold text-cyan-400 hover:text-cyan-300 transition"
            >
              <Sparkles className="w-3 h-3 text-cyan-300" />
              <span>+ Add Prop Challenge</span>
            </button>
          </div>
        </div>
      )}

      {/* CREATE NEW DEMO ACCOUNT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#090d16] border border-cyan-500/30 shadow-[0_0_50px_rgba(56,189,248,0.25)] overflow-hidden">
            {/* Modal Header */}
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
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateAccount} className="p-6 space-y-5">
              {/* Account Name */}
              <div>
                <label className="block text-xs font-mono font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Account Name / Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FTMO $100K Phase 1 / High-Leverage Scalp"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 focus:border-cyan-400 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 transition"
                />
              </div>

              {/* Account Type Selection */}
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
                        setNewType(t.id);
                      }}
                      className={`p-3 text-left rounded-xl border transition ${
                        newType === t.id
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

              {/* Initial Capital Selection */}
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
                        setNewBalance(amt);
                        setCustomBalance(amt.toString());
                      }}
                      className={`py-2 text-center rounded-xl font-mono text-xs font-bold border transition ${
                        newBalance === amt
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
                    value={customBalance}
                    onChange={(e) => {
                      setCustomBalance(e.target.value);
                      setNewBalance(Number(e.target.value));
                    }}
                    className="w-full pl-7 pr-4 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-sm font-mono text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-400 hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl text-xs font-mono font-black bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(56,189,248,0.4)] disabled:opacity-50 transition"
                >
                  {loading ? 'DEPLOYING...' : '⚡ DEPLOY ACCOUNT'}
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
                  Reset {activeAccount?.name || 'Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300">
                This will liquidate any open positions on this account and restore starting liquidity back to the specified amount:
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[25000, 50000, 100000, 200000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setResetBalance(amt)}
                    className={`py-2 text-center rounded-xl font-mono text-xs font-bold border transition ${
                      resetBalance === amt
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
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white transition"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={loading}
                  className="px-5 py-2 rounded-xl text-xs font-mono font-black bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] disabled:opacity-50 transition"
                >
                  {loading ? 'RESETTING...' : 'CONFIRM RESET'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
