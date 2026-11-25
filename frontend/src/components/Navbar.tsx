import React, { useState } from 'react';
import {
  Activity,
  ShieldAlert,
  Wifi,
  DollarSign,
  Volume2,
  VolumeX,
  Power,
  Shield,
  Zap,
  Lock
} from 'lucide-react';
import { Ticker24h, PortfolioSummary, RiskDashboardSummary } from '../types';
import { DemoAccountSwitcher } from './DemoAccountSwitcher';
import { soundEngine } from '../audio/SoundEngine';
import { api } from '../services/api';

interface NavbarProps {
  btcTicker: Ticker24h | null;
  portfolio: PortfolioSummary | null;
  riskSummary: RiskDashboardSummary | null;
  isWsConnected: boolean;
  onSwitchTo3DLanding?: () => void;
  onKillSwitchToggled?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  btcTicker,
  portfolio,
  riskSummary,
  isWsConnected,
  onSwitchTo3DLanding,
  onKillSwitchToggled
}) => {
  const [executionMode, setExecutionMode] = useState<'DEMO' | 'LIVE'>('DEMO');
  const [isMuted, setIsMuted] = useState(soundEngine.getMuted());
  const [isTogglingKillSwitch, setIsTogglingKillSwitch] = useState(false);

  const isKillSwitchActive = riskSummary?.kill_switch_active ?? false;
  const priceChange = btcTicker?.price_change_pct_24h ?? 0;

  const handleToggleSound = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      soundEngine.playConfirmationChime();
    }
  };

  const handleToggleExecutionMode = () => {
    soundEngine.playHoverTick();
    if (executionMode === 'DEMO') {
      const confirmLive = window.confirm(
        'CAUTION: You are about to switch to LIVE EXECUTION.\n\nAll orders will route to live broker/exchange endpoints subject to server-side risk firewalls.\n\nDo you want to proceed?'
      );
      if (confirmLive) {
        setExecutionMode('LIVE');
        soundEngine.playFrostLock();
      }
    } else {
      setExecutionMode('DEMO');
      soundEngine.playChime();
    }
  };

  const handleEmergencyKillSwitch = async () => {
    setIsTogglingKillSwitch(true);
    soundEngine.playHoverTick();
    try {
      const res = await api.toggleKillSwitch();
      if (res.kill_switch_active) {
        soundEngine.playFrostLock();
        alert('EMERGENCY KILL SWITCH ACTIVATED // All positions flattened and algorithmic trading halted.');
      } else {
        soundEngine.playChime();
      }
      if (onKillSwitchToggled) onKillSwitchToggled();
    } catch (err: any) {
      alert(`Kill Switch Error: ${err.message}`);
    } finally {
      setIsTogglingKillSwitch(false);
    }
  };

  return (
    <header className="h-14 bg-[#070b14]/90 backdrop-blur-xl border-b border-blue-500/20 px-5 flex items-center justify-between select-none z-30 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
      {/* Brand logo & platform title with 3D Holographic Accent */}
      <div className="flex items-center gap-3">
        <div
          onClick={onSwitchTo3DLanding}
          className="relative group cursor-pointer"
          title="Return to 3D Cryogenic Field"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.4)] text-white text-base font-black transform transition hover:rotate-12 hover:scale-105">
            ⚡
          </div>
          <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 opacity-30 blur-sm group-hover:opacity-75 transition" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              onClick={onSwitchTo3DLanding}
              className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent cursor-pointer"
            >
              NEXUS QUANT
            </span>
            {onSwitchTo3DLanding && (
              <button
                onClick={onSwitchTo3DLanding}
                className="hidden sm:flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-500/25 transition shadow-[0_0_12px_rgba(125,249,255,0.25)]"
              >
                <span>3D PORTAL</span>
                <span className="text-cyan-400">➔</span>
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 font-medium font-mono">
            Discipline-First Autonomous Trading Superapp
          </p>
        </div>
      </div>

      {/* Center: Global DEMO vs LIVE Toggle */}
      <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono">
        <button
          onClick={handleToggleExecutionMode}
          className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${executionMode === 'DEMO'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]'
              : 'text-slate-400 hover:text-white'
            }`}
        >
          <Shield className="w-3.5 h-3.5" />
          PAPER / DEMO
        </button>
        <button
          onClick={handleToggleExecutionMode}
          className={`px-3 py-1 rounded-lg font-bold text-[11px] transition-all flex items-center gap-1.5 ${executionMode === 'LIVE'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(255,51,102,0.4)] animate-pulse'
              : 'text-slate-400 hover:text-white'
            }`}
        >
          <Zap className="w-3.5 h-3.5" />
          LIVE BROKER
        </button>
      </div>

      {/* Real-time Status Pills */}
      <div className="flex items-center gap-3">
        {/* BTC Ticker Pill */}
        {btcTicker && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 font-semibold">BTC/USDT:</span>
            <span className="font-bold text-white">
              ${btcTicker?.last_price != null ? btcTicker.last_price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
            </span>
            <span
              className={`text-[11px] font-semibold ${priceChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
            >
              {priceChange >= 0 ? '+' : ''}
              {typeof priceChange === 'number' ? priceChange.toFixed(2) : '0.00'}%
            </span>
          </div>
        )}

        {/* Multi-Demo Account Switcher & Manager */}
        <DemoAccountSwitcher />

        {/* Emergency Kill Switch Button */}
        <button
          onClick={handleEmergencyKillSwitch}
          disabled={isTogglingKillSwitch}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition shadow-lg active:scale-95 ${isKillSwitchActive
              ? 'bg-rose-950 text-rose-300 border-rose-600 animate-pulse shadow-rose-900/50'
              : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
            }`}
          title="Emergency Protocol: Flatten all positions and halt algos immediately"
        >
          <Power className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {isKillSwitchActive ? 'HALT ARMED' : 'KILL SWITCH'}
          </span>
        </button>

        {/* Procedural Audio Toggle */}
        <button
          onClick={handleToggleSound}
          className={`p-2 rounded-lg border text-xs transition ${!isMuted
              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
              : 'bg-slate-900/80 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
          title={!isMuted ? 'Procedural Sound: ON' : 'Procedural Sound: MUTED'}
        >
          {!isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Live Stream / WS Status */}
        <div
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 font-mono"
          title={isWsConnected ? 'Market Stream Active (WebSocket)' : 'Market Stream Polling'}
        >
          <span className={`w-2 h-2 rounded-full ${isWsConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
          <span className="text-[11px]">{isWsConnected ? 'LIVE' : 'SYNC'}</span>
        </div>
      </div>
    </header>
  );
};
