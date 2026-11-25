import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Radio,
  Zap,
  Lock
} from 'lucide-react';
import { api } from '../services/api';
import { soundEngine } from '../audio/SoundEngine';

interface NewsTrigger {
  id: string;
  title: string;
  currency: string;
  impact: string;
  event_time_utc: string;
  seconds_until: number;
  is_within_five_hours: boolean;
  is_lockout_active: boolean;
}

export const NewsManipulationHUD: React.FC = () => {
  const [triggers, setTriggers] = useState<NewsTrigger[]>([]);
  const [isLockoutActive, setIsLockoutActive] = useState(false);
  const [nextEvent, setNextEvent] = useState<NewsTrigger | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('--:--:--');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [judasSwingDetected, setJudasSwingDetected] = useState(false);
  const [judasDetails, setJudasDetails] = useState<string | null>(null);

  useEffect(() => {
    fetchNewsStatus();
    checkManipulationStatus();

    const fetchInterval = setInterval(() => {
      fetchNewsStatus();
      checkManipulationStatus();
    }, 15000);

    return () => clearInterval(fetchInterval);
  }, []);

  // 1-second countdown ticker
  useEffect(() => {
    const timer = setInterval(() => {
      if (nextEvent) {
        const diff = Math.max(0, nextEvent.seconds_until - 1);
        nextEvent.seconds_until = diff;
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        setTimeRemaining(
          `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );

        if (diff <= 900 && !isLockoutActive) {
          setIsLockoutActive(true);
          soundEngine.playFrostLock();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [nextEvent, isLockoutActive]);

  const fetchNewsStatus = async () => {
    try {
      const res = await api.getFiveHourPreTriggers();
      if (res?.triggers) {
        setTriggers(res.triggers);
        setIsLockoutActive(res.is_any_lockout_active);

        // Find closest high-impact trigger
        const highImpact = res.triggers.filter((t: any) => t.impact === 'HIGH' || t.impact === 'High');
        const sorted = (highImpact.length > 0 ? highImpact : res.triggers).sort(
          (a: any, b: any) => a.seconds_until - b.seconds_until
        );

        if (sorted.length > 0) {
          setNextEvent(sorted[0]);
        }
      }
    } catch (err) {
      // quiet fallback
    }
  };

  const checkManipulationStatus = async () => {
    try {
      const candleRes = await api.getCandles('BTCUSDT', '15m', 5).catch(() => null);
      if (candleRes?.candles && candleRes.candles.length > 1) {
        const c = candleRes.candles[candleRes.candles.length - 1];
        const prev = candleRes.candles[candleRes.candles.length - 2];
        const res = await api.checkManipulation({
          symbol: 'BTCUSDT',
          high_price: c.high,
          low_price: c.low,
          open_price: c.open,
          close_price: c.close,
          pre_news_high: prev.high,
          pre_news_low: prev.low,
          volume_current: c.volume,
          volume_average: prev.volume
        });
        if (res?.manipulation_detected || res?.detected) {
          setJudasSwingDetected(true);
          setJudasDetails(res.description || res.warning || 'Judas Swing Stop-Hunt detected: Retail stops swept into unmitigated institutional Order Block.');
        } else {
          setJudasSwingDetected(false);
          setJudasDetails(null);
        }
      }
    } catch {
      // quiet fallback
    }
  };

  return (
    <div className="relative z-20">
      {/* Top Banner Bar */}
      <div
        className={`px-4 py-1.5 flex items-center justify-between text-xs font-mono select-none transition-all duration-300 border-b ${
          isLockoutActive
            ? 'bg-rose-950/90 border-rose-600/80 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.3)] animate-pulse'
            : nextEvent?.is_within_five_hours
            ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
            : 'bg-[#060913]/90 border-slate-800/80 text-slate-300'
        }`}
      >
        {/* Left: Lockout / Countdown Alert */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {isLockoutActive ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                <Lock className="w-3.5 h-3.5" />
                <span>FIREWALL LOCKOUT ACTIVE // ZERO NEW ORDERS PERMITTED</span>
              </span>
            ) : nextEvent?.is_within_five_hours ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>5-HOUR PRE-NEWS TRIGGER ARMED</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>MARKET REGIME STABLE</span>
              </span>
            )}
          </div>

          {/* Next High-Impact Event Description */}
          {nextEvent && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-bold">
                {nextEvent.currency}
              </span>
              <span className="font-semibold text-slate-200 truncate max-w-xs md:max-w-md">
                {nextEvent.title}
              </span>
              <span className="text-slate-400">T-minus</span>
              <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {timeRemaining}
              </span>
            </div>
          )}
        </div>

        {/* Right: Judas Swing Sweep Detector & Details Toggle */}
        <div className="flex items-center gap-4">
          {/* Retail Judas Swing Indicator */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] ${
              judasSwingDetected
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-[0_0_12px_rgba(255,51,102,0.4)] animate-bounce'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}
            title={judasDetails || 'Monitoring institutional Judas Swings and retail stop hunts'}
          >
            <Flame className={`w-3.5 h-3.5 ${judasSwingDetected ? 'text-rose-400' : 'text-slate-500'}`} />
            <span>
              {judasSwingDetected ? 'JUDAS SWING DETECTED' : 'MANIPULATION: DORMANT'}
            </span>
          </div>

          {/* Forex Factory Drawer Toggle */}
          <button
            onClick={() => {
              soundEngine.playTick();
              setIsDrawerOpen(!isDrawerOpen);
            }}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">FOREX FACTORY CALENDAR</span>
            {isDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable High-Impact News Drawer */}
      {isDrawerOpen && (
        <div className="bg-[#080d1a]/95 border-b border-cyan-500/30 p-4 shadow-2xl backdrop-blur-xl animate-fadeIn">
          <div className="flex items-center justify-between mb-3 text-xs font-mono">
            <span className="font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              FOREX FACTORY LIVE HIGH-IMPACT RELEASES (REAL-TIME STREAM)
            </span>
            <span className="text-slate-400 text-[11px]">
              Pre-Trade Firewall Lockout: ±15m Around High-Impact Events
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
            {triggers.slice(0, 8).map((ev: any) => {
              const isEventLockout = ev.seconds_until <= 900;
              const isClose = ev.is_within_five_hours;
              return (
                <div
                  key={ev.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isEventLockout
                      ? 'bg-rose-950/60 border-rose-500 text-rose-200'
                      : isClose
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 font-bold text-cyan-300 text-[10px]">
                      {ev.currency}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        ev.impact === 'HIGH' || ev.impact === 'High'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {ev.impact} IMPACT
                    </span>
                  </div>

                  <p className="font-bold text-[11px] text-slate-100 truncate mb-1" title={ev.title}>
                    {ev.title}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                    <span>{ev.event_time_utc?.slice(11, 16)} UTC</span>
                    <span className="font-bold text-cyan-400">
                      {Math.floor(ev.seconds_until / 3600)}h {Math.floor((ev.seconds_until % 3600) / 60)}m left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
