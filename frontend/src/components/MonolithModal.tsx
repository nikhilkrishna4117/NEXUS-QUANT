import React from 'react';
import { X, ArrowLeft, ArrowUpRight, CheckCircle2, Shield, Cpu, Activity, Zap } from 'lucide-react';
import { MonolithData } from './CryoScene';
import { soundEngine } from '../audio/SoundEngine';
import { ScrambleText } from './ScrambleText';

interface MonolithModalProps {
  monolith: MonolithData | null;
  onClose: () => void;
  onLaunchWorkstationModule: (moduleName: string) => void;
}

export const MonolithModal: React.FC<MonolithModalProps> = ({
  monolith,
  onClose,
  onLaunchWorkstationModule,
}) => {
  if (!monolith) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#050811]/90 backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-300">
      <div className="relative w-full max-w-3xl rounded-3xl bg-gradient-to-b from-[#0f172a]/95 via-[#0a0f1d]/95 to-[#060912]/95 border border-cyan-500/40 p-6 sm:p-8 shadow-[0_0_80px_rgba(125,249,255,0.18)] overflow-hidden">
        {/* Ambient Top Glow */}
        <div
          className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-48 rounded-full blur-3xl opacity-25"
          style={{ backgroundColor: monolith.color }}
        />

        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-5 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundEngine.playHoverTick();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-xs font-mono text-slate-300 hover:text-white transition group"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
              <span>BACK TO FIELD</span>
            </button>
            <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-widest hidden sm:inline">
              // TELEMETRY DECODER
            </span>
          </div>

          <button
            onClick={() => {
              soundEngine.playHoverTick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Monolith Detailed Content */}
        <div className="mt-6 space-y-6 relative z-10">
          <div>
            <div className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400">
              <ScrambleText text={monolith.title} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              {monolith.subtitle}
            </h2>
          </div>

          {/* Key Engineering Specifications */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {monolith.specs.map((spec, i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs font-mono"
              >
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">
                  PARAM_{i + 1}
                </span>
                <span className="text-white font-bold">{spec}</span>
              </div>
            ))}
          </div>

          {/* Deep Architectural Context */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 font-bold">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>QUANTITATIVE DISCIPLINE ARCHITECTURE</span>
            </div>
            <p>
              Engineered with zero-compromise institutional execution parameters. All algorithmic orders and discretionary entries pass through mandatory pre-trade guardrail audits to prevent emotional sizing, slippage degradation, and tilt-induced loss spirals.
            </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
            <div className="text-xs font-mono text-slate-400">
              STATUS: <span className="text-emerald-400 font-bold">READY TO DEPLOY IN TERMINAL</span>
            </div>

            <button
              onClick={() => {
                soundEngine.playSubDrop();
                onLaunchWorkstationModule(monolith.id);
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(125,249,255,0.4)] flex items-center gap-2"
            >
              <span>OPEN MODULE IN TERMINAL</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
