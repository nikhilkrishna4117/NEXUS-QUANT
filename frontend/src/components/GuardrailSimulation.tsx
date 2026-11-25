import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Lock, Unlock, AlertOctagon, TrendingDown, RefreshCw } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';
import { ScrambleText } from './ScrambleText';

export const GuardrailSimulation: React.FC = () => {
  const [maxLossLimit, setMaxLossLimit] = useState(250);
  const [simulatedLoss, setSimulatedLoss] = useState(120);
  const [attemptedLots, setAttemptedLots] = useState(2.5);

  const isLocked = simulatedLoss >= maxLossLimit;

  const handleSimulateLoss = (amount: number) => {
    const newLoss = Math.max(0, simulatedLoss + amount);
    setSimulatedLoss(newLoss);

    if (newLoss >= maxLossLimit) {
      soundEngine.playFrostLock();
    } else {
      soundEngine.playHoverTick();
    }
  };

  const handleReset = () => {
    setSimulatedLoss(0);
    soundEngine.playHoverTick();
  };

  return (
    <div className={`relative rounded-3xl backdrop-blur-2xl border transition-all duration-500 overflow-hidden p-6 sm:p-8 shadow-2xl ${
      isLocked
        ? 'bg-gradient-to-b from-[#1b080f]/90 via-[#10050a]/90 to-[#070204]/90 border-rose-500/60 shadow-[0_0_50px_rgba(255,51,102,0.25)]'
        : 'bg-gradient-to-b from-[#0e1626]/85 via-[#0a0f1d]/85 to-[#060912]/85 border-cyan-500/30 shadow-[0_0_40px_rgba(125,249,255,0.12)]'
    }`}>
      {/* Cryogenic Frost Overlay on Lock */}
      {isLocked && (
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(255,51,102,0.15),transparent_70%)] animate-pulse" />
      )}

      {/* Header Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${
            isLocked
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-[0_0_15px_#ff3366]'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_15px_#7df9ff]'
          }`}>
            {isLocked ? <Lock className="w-5 h-5 animate-bounce" /> : <ShieldCheck className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-slate-400">
                ACTIVE GUARDRAIL SIMULATOR
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isLocked
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              }`}>
                {isLocked ? 'CRYOGENIC LOCKDOWN' : 'FIREWALL ARMED'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-white mt-0.5 tracking-tight">
              Pre-Execution Discipline Shield
            </h3>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs font-mono text-slate-300 hover:text-white hover:border-slate-500 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reset Demo
        </button>
      </div>

      {/* Middle Interactive Sliders */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
        {/* Daily Max Loss Limit Control */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Daily Max Loss Threshold:</span>
            <span className="text-rose-400 font-bold">-${maxLossLimit} USD</span>
          </div>
          <input
            type="range"
            min="100"
            max="1000"
            step="50"
            value={maxLossLimit}
            onChange={(e) => setMaxLossLimit(Number(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>$100 (Tight)</span>
            <span>$500 (Moderate)</span>
            <span>$1000 (Loose)</span>
          </div>
        </div>

        {/* Current Simulated Loss Gauge */}
        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
          <div className="flex justify-between text-xs font-mono">
            <span className="text-slate-400">Current Session Loss:</span>
            <span className={`font-bold ${isLocked ? 'text-rose-400 text-sm animate-pulse' : 'text-slate-200'}`}>
              -${simulatedLoss} USD ({Math.min(100, Math.round((simulatedLoss / maxLossLimit) * 100))}%)
            </span>
          </div>
          <div className="w-full bg-slate-800/80 rounded-full h-3 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isLocked
                  ? 'bg-gradient-to-r from-rose-600 to-red-400 shadow-[0_0_15px_#ff3366]'
                  : 'bg-gradient-to-r from-cyan-400 to-blue-500'
              }`}
              style={{ width: `${Math.min(100, (simulatedLoss / maxLossLimit) * 100)}%` }}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => handleSimulateLoss(75)}
              className="flex-1 py-1 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-mono font-medium transition"
            >
              + Sim Loss (-$75)
            </button>
            <button
              onClick={() => handleSimulateLoss(150)}
              className="flex-1 py-1 px-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-bold transition"
            >
              + Big Drop (-$150)
            </button>
          </div>
        </div>
      </div>

      {/* Target Execution Order Box */}
      <div className={`relative z-10 p-5 rounded-2xl border transition-all duration-500 ${
        isLocked
          ? 'bg-rose-950/40 border-rose-600/50'
          : 'bg-slate-900/60 border-slate-800'
      }`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono text-slate-400">Proposed High-Risk Market Order:</div>
            <div className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <span>BUY 2.50 BTCUSDT @ $64,250.00</span>
              <span className="text-[11px] font-normal text-slate-400">(Notional: $160,625)</span>
            </div>
          </div>

          <div className="w-full sm:w-auto">
            {isLocked ? (
              <div className="flex items-center gap-3 px-6 py-3.5 rounded-xl bg-gradient-to-r from-rose-900 to-red-950 border border-rose-500 text-rose-200 shadow-[0_0_25px_rgba(255,51,102,0.4)] cursor-not-allowed">
                <Lock className="w-5 h-5 text-rose-400 animate-pulse" />
                <div className="text-left font-mono">
                  <div className="text-xs font-bold uppercase tracking-wider text-white">
                    ORDER LOCKED BY GUARDRAIL
                  </div>
                  <div className="text-[10px] text-rose-300">
                    Revenge trading blocked at protocol level
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  soundEngine.playHoverTick();
                  alert('Order Routed Successfully! Simulated paper trade filled.');
                }}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-sm tracking-wide shadow-[0_0_20px_rgba(0,245,160,0.4)] transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                EXECUTE ORDER (PASSED AUDIT)
              </button>
            )}
          </div>
        </div>

        {isLocked && (
          <div className="mt-3 pt-3 border-t border-rose-500/20 flex items-center gap-2 text-xs font-mono text-rose-400">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>
              SYSTEM STATUS: Daily loss limit reached (${simulatedLoss} &ge; ${maxLossLimit}). Broker API order routing disabled for remainder of session.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
