import React, { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import { CryoScene, MonolithData, MONOLITHS } from '../components/CryoScene';
import { TradingHUD } from '../components/TradingHUD';
import { ScrambleText } from '../components/ScrambleText';
import { GuardrailSimulation } from '../components/GuardrailSimulation';
import { ParticleField } from '../components/ParticleField';
import { MonolithModal } from '../components/MonolithModal';
import { soundEngine } from '../audio/SoundEngine';
import {
  ArrowDown,
  Shield,
  Zap,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Terminal,
} from 'lucide-react';

interface CryogenicQuantLandingProps {
  onLaunchWorkstation: (targetModule?: string) => void;
}

export const CryogenicQuantLanding: React.FC<CryogenicQuantLandingProps> = ({
  onLaunchWorkstation,
}) => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('CALIBRATION');
  const [selectedMonolith, setSelectedMonolith] = useState<MonolithData | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    let lastScroll = 0;

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    lenis.on('scroll', (e: any) => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? e.scroll / scrollHeight : 0;
      setScrollProgress(Math.max(0, Math.min(1, progress)));

      // Velocity whoosh audio
      const velocity = e.velocity || (e.scroll - lastScroll);
      soundEngine.playScrollWhoosh(velocity);
      lastScroll = e.scroll;

      // Update Phase calculation
      if (progress < 0.15) {
        setCurrentPhase('CALIBRATION');
      } else if (progress < 0.35) {
        setCurrentPhase('ARCHITECTURE');
      } else if (progress < 0.65) {
        setCurrentPhase('MONOLITHS');
      } else if (progress < 0.85) {
        setCurrentPhase('GUARDRAILS');
      } else {
        setCurrentPhase('LIQUIDITY');
      }
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  const handleJumpToPhase = (phaseIndex: number) => {
    if (!lenisRef.current) return;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const targetScroll = (phaseIndex / 4) * scrollHeight;
    lenisRef.current.scrollTo(targetScroll, { duration: 1.6 });
  };

  return (
    <div className="relative min-h-[600vh] bg-[#070a13] text-slate-100 font-sans selection:bg-cyan-400 selection:text-black">
      {/* 3D Background Canvas (Persistent Flight) */}
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <CryoScene
          scrollProgress={scrollProgress}
          onSelectMonolith={(m) => setSelectedMonolith(m)}
        />
      </div>

      {/* Persistent Minimalist Trading HUD Frame */}
      <TradingHUD
        scrollProgress={scrollProgress}
        currentPhase={currentPhase}
        onLaunchTerminal={() => onLaunchWorkstation()}
        onJumpToPhase={handleJumpToPhase}
      />

      {/* Scrollable Content Stream (Overlaid on 3D World) */}
      <div ref={containerRef} className="relative z-10 pointer-events-none">
        {/* ========================================================= */}
        {/* SECTION 1: HERO / BOOT PROTOCOL (0 - 100vh) */}
        {/* ========================================================= */}
        <section className="h-screen flex flex-col justify-center px-6 sm:px-12 md:px-24 max-w-6xl mx-auto">
          <div className="space-y-6 pointer-events-auto max-w-3xl">
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-xs font-mono font-bold text-cyan-300 shadow-[0_0_20px_rgba(125,249,255,0.2)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <ScrambleText text="DISCIPLINE-FIRST CRYOGENIC QUANT" />
            </div>

            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.05] text-white">
              The Protocol That <br />
              <span className="bg-gradient-to-r from-cyan-300 via-white to-blue-400 bg-clip-text text-transparent">
                Locks Out Emotion.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 font-sans max-w-xl leading-relaxed">
              Where procedural crystalline 3D architecture meets institutional execution. Mandatory pre-trade risk firewalls, automated journal DNA, and deep quantitative backtesting.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button
                onClick={() => {
                  soundEngine.playSubDrop();
                  onLaunchWorkstation();
                }}
                onMouseEnter={() => soundEngine.playHoverTick()}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-sm tracking-wider transition-all shadow-[0_0_30px_rgba(125,249,255,0.4)] flex items-center gap-2 transform hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>ENTER TRADING TERMINAL</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  soundEngine.playHoverTick();
                  handleJumpToPhase(2);
                }}
                onMouseEnter={() => soundEngine.playHoverTick()}
                className="px-6 py-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-700/80 text-white font-mono text-xs font-semibold transition backdrop-blur-md flex items-center gap-2 cursor-pointer"
              >
                <span>EXPLORE 3D MONOLITHS</span>
                <ArrowDown className="w-3.5 h-3.5 text-cyan-400 animate-bounce" />
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 2: WIREFRAME-TO-SOLID TECHNICAL WORKFLOW (100 - 200vh) */}
        {/* ========================================================= */}
        <section className="min-h-screen py-32 flex flex-col justify-center px-6 sm:px-12 md:px-24 max-w-6xl mx-auto">
          <div className="space-y-12 pointer-events-auto">
            <div className="max-w-2xl">
              <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block mb-2">
                // SYSTEM ARCHITECTURE
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Three Phases of Mathematical Certainty
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  phase: 'PHASE 01',
                  label: 'BEFORE EXECUTION',
                  title: 'Edge Trade Plan & Risk Audit',
                  desc: 'Algorithmic pre-flight checks verify R:R minimums (1.5:1), volatility regimes, and position notional before the order is permitted to reach the broker.',
                  color: 'border-cyan-500/40 shadow-[0_0_25px_rgba(125,249,255,0.1)]',
                  tag: '01 // VERIFICATION',
                },
                {
                  phase: 'PHASE 02',
                  label: 'DURING EXECUTION',
                  title: 'Cryogenic Guardrails & Sentry',
                  desc: 'Hard-coded protocol lockout stops revenge trading cold. When session drawdown limits are breached, execution routes are instantly locked in ice.',
                  color: 'border-rose-500/40 shadow-[0_0_25px_rgba(255,51,102,0.1)]',
                  tag: '02 // CRYOGENIC LOCK',
                },
                {
                  phase: 'PHASE 03',
                  label: 'AFTER EXECUTION',
                  title: 'Automated DNA Journal & FloAI',
                  desc: 'Every tick, slippage point, and decision timestamp is categorized. FloAI reconstructs what worked and what violated your rulebook.',
                  color: 'border-emerald-500/40 shadow-[0_0_25px_rgba(0,245,160,0.1)]',
                  tag: '03 // QUANT AUDIT',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`p-6 sm:p-8 rounded-3xl bg-slate-950/75 backdrop-blur-2xl border transition-transform duration-300 hover:-translate-y-2 ${item.color}`}
                >
                  <div className="flex justify-between items-center text-xs font-mono mb-4 text-slate-400">
                    <span className="text-cyan-400 font-bold">{item.phase}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px]">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 3: PROCEDURAL 3D MONOLITHS SHOWCASE (200 - 350vh) */}
        {/* ========================================================= */}
        <section className="min-h-screen py-32 flex flex-col justify-center px-6 sm:px-12 md:px-24 max-w-6xl mx-auto">
          <div className="space-y-10 pointer-events-auto">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block mb-2">
                  // 3D GEOMETRIC ARTIFACTS
                </span>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                  The Six Crystalline Monoliths
                </h2>
              </div>
              <p className="text-xs font-mono text-slate-400">
                Hover or click floating artifacts in the 3D space to inspect
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {MONOLITHS.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    soundEngine.playSubDrop();
                    setSelectedMonolith(m);
                  }}
                  onMouseEnter={() => soundEngine.playHoverTick()}
                  className="group cursor-pointer p-6 rounded-3xl bg-gradient-to-b from-[#0e1626]/80 via-[#0a0f1d]/80 to-[#070b14]/80 backdrop-blur-2xl border border-cyan-500/20 hover:border-cyan-400/60 transition-all duration-300 shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:shadow-[0_0_40px_rgba(125,249,255,0.2)] hover:-translate-y-1.5"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {m.title}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                  </div>
                  <h4 className="text-base font-bold text-white mb-3 group-hover:text-cyan-200 transition-colors">
                    {m.subtitle}
                  </h4>
                  <div className="space-y-1 pt-2 border-t border-white/5 text-[11px] font-mono text-slate-400">
                    {m.specs.map((s, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="text-cyan-400">•</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 4: INTERACTIVE GUARDRAIL SIMULATION (350 - 450vh) */}
        {/* ========================================================= */}
        <section className="min-h-screen py-32 flex flex-col justify-center px-6 sm:px-12 md:px-24 max-w-5xl mx-auto">
          <div className="space-y-8 pointer-events-auto">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-xs font-mono font-bold text-rose-400 uppercase tracking-widest block mb-2">
                // LIVE TACTICAL SIMULATOR
              </span>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                Experience the Frost Lock
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-sans mt-2">
                Test how the platform physically halts revenge trading in real time before execution orders can reach the broker.
              </p>
            </div>

            <GuardrailSimulation />
          </div>
        </section>

        {/* ========================================================= */}
        {/* SECTION 5: VOLUMETRIC GPU PARTICLE FINALE (450 - 600vh) */}
        {/* ========================================================= */}
        <section className="min-h-screen py-32 flex flex-col justify-center px-6 sm:px-12 md:px-24 max-w-6xl mx-auto">
          <div className="space-y-8 pointer-events-auto">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-widest block mb-2">
                  // GPU PARTICLE ENGINE
                </span>
                <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
                  Volumetric Liquidity Dynamics
                </h2>
              </div>
              <p className="text-xs font-mono text-slate-400">
                15,000+ GPU particles • Interactive magnetic turbulence & vortex pull
              </p>
            </div>

            <ParticleField height={520} />

            {/* Terminal Launch Banner */}
            <div className="mt-12 p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-blue-950/60 border border-cyan-400/40 backdrop-blur-2xl flex flex-wrap items-center justify-between gap-6 shadow-[0_0_60px_rgba(125,249,255,0.15)]">
              <div className="space-y-2 max-w-xl">
                <div className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                  INSTITUTIONAL QUANT WORKSTATION
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Ready to deploy real-time market strategies?
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 font-sans">
                  Launch the 9-page institutional terminal with live TradingView streaming, 3D volatility landscapes, automated backtesting, and paper execution.
                </p>
              </div>

              <button
                onClick={() => {
                  soundEngine.playSubDrop();
                  onLaunchWorkstation();
                }}
                className="px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-extrabold text-sm tracking-wider transition-all shadow-[0_0_30px_rgba(125,249,255,0.5)] flex items-center gap-2 transform hover:scale-105 active:scale-95"
              >
                <span>OPEN FULL WORKSTATION</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Monolith Zoom Preview Modal */}
      <MonolithModal
        monolith={selectedMonolith}
        onClose={() => setSelectedMonolith(null)}
        onLaunchWorkstationModule={(mod) => {
          setSelectedMonolith(null);
          onLaunchWorkstation(mod);
        }}
      />
    </div>
  );
};
