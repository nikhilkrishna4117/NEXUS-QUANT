import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Shield, ArrowUpRight, Radio, Compass } from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';

interface TradingHUDProps {
  scrollProgress: number; // 0.0 to 1.0
  currentPhase: string;
  onLaunchTerminal: () => void;
  onJumpToPhase: (phaseIndex: number) => void;
}

const PHASES = [
  { name: 'CALIBRATION', depth: '000.0M' },
  { name: 'ARCHITECTURE', depth: '018.4M' },
  { name: 'MONOLITHS', depth: '042.8M' },
  { name: 'GUARDRAILS', depth: '074.2M' },
  { name: 'LIQUIDITY', depth: '099.9M' },
];

export const TradingHUD: React.FC<TradingHUDProps> = ({
  scrollProgress,
  currentPhase,
  onLaunchTerminal,
  onJumpToPhase,
}) => {
  const [isMuted, setIsMuted] = useState(soundEngine.getMuted());

  const handleToggleSound = () => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
    if (!muted) {
      soundEngine.playConfirmationChime();
    }
  };

  const calculatedDepth = (scrollProgress * 99.9).toFixed(1).padStart(4, '0');

  return (
    <div className="pointer-events-none fixed inset-0 z-40 select-none overflow-hidden">
      {/* Top-Left: Minimal Brand Mark + Live Status Dot */}
      <div className="pointer-events-auto absolute top-6 left-6 sm:left-10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(125,249,255,0.4)] text-black font-black text-sm">
          ⚡
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-wider text-sm text-white">NEXUS // QUANT</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <p className="text-[10px] font-mono text-slate-400 tracking-tight">
            ENGINE: ACTIVE // GUARDRAILS ARMED
          </p>
        </div>
      </div>

      {/* Top-Right: Sound Visualizer + Launch Terminal CTA Button */}
      <div className="pointer-events-auto absolute top-6 right-6 sm:right-10 flex items-center gap-3 sm:gap-4">
        {/* Sound Toggle Button with Animated 4-Bar Waveform */}
        <button
          onClick={handleToggleSound}
          className={`px-3 py-2 rounded-xl border backdrop-blur-xl flex items-center gap-2.5 transition-all text-xs font-mono font-semibold ${
            !isMuted
              ? 'bg-cyan-950/40 border-cyan-400/50 text-cyan-300 shadow-[0_0_15px_rgba(125,249,255,0.25)]'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
          }`}
          title="Toggle Procedural Audio Engine"
        >
          {!isMuted ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden sm:inline">{!isMuted ? 'SOUND ON' : 'SOUND OFF'}</span>

          {/* 4-bar Waveform Visualizer */}
          <div className="flex items-end gap-0.5 h-3">
            {[1, 2, 3, 4].map((bar) => (
              <span
                key={bar}
                className={`w-0.5 rounded-full transition-all ${
                  !isMuted ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600 h-1'
                }`}
                style={
                  !isMuted
                    ? {
                        height: `${Math.max(3, (bar * 3.5) % 12)}px`,
                        animationDuration: `${0.3 + bar * 0.15}s`,
                      }
                    : {}
                }
              />
            ))}
          </div>
        </button>

        {/* Launch Full Institutional Workstation */}
        <button
          onClick={() => {
            soundEngine.playSubDrop();
            onLaunchTerminal();
          }}
          className="group relative px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-xs tracking-wider transition-all shadow-[0_0_20px_rgba(125,249,255,0.4)] flex items-center gap-1.5 transform hover:scale-105 active:scale-95"
        >
          <span>LAUNCH TERMINAL</span>
          <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>

      {/* Bottom-Left: Live 3D Camera Depth & Broker Connectivity Strip */}
      <div className="pointer-events-auto absolute bottom-6 left-6 sm:left-10 flex flex-col gap-1 font-mono text-xs select-none">
        <div className="flex items-center gap-2 text-cyan-300 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 w-fit">
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-white font-bold">DEPTH {calculatedDepth}M</span>
          <span className="text-slate-500">//</span>
          <span className="text-slate-400 uppercase">PHASE: {currentPhase}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 tracking-tight hidden sm:block">
          CONNECTIVITY: cTrader · TradeLocker · Binance · 1,250+ Brokers
        </div>
      </div>

      {/* Bottom-Right: Minimal Scroll Progress Rail with Magnetic Chapter Markers */}
      <div className="pointer-events-auto absolute bottom-6 right-6 sm:right-10 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          {PHASES.map((p, idx) => (
            <button
              key={p.name}
              onClick={() => {
                soundEngine.playHoverTick();
                onJumpToPhase(idx);
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                currentPhase === p.name
                  ? 'bg-cyan-400 shadow-[0_0_8px_#7df9ff] scale-125'
                  : 'bg-slate-700 hover:bg-slate-500'
              }`}
              title={`Jump to ${p.name}`}
            />
          ))}
        </div>
        <span className="text-[11px] text-slate-400 tabular-nums">
          {Math.round(scrollProgress * 100)}%
        </span>
      </div>
    </div>
  );
};
