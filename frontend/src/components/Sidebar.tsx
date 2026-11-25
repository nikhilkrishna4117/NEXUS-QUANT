import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  Brain,
  History,
  TrendingUp,
  Shield,
  FileSearch,
  MessageSquare,
  KeyRound,
  Zap
} from 'lucide-react';
import { soundEngine } from '../audio/SoundEngine';

export type PageId =
  | 'dashboard'
  | 'market_analysis'
  | 'strategy_lab'
  | 'backtesting'
  | 'paper_trading'
  | 'risk_management'
  | 'investment_research'
  | 'ai_assistant'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
}

const MENU_ITEMS = [
  { id: 'dashboard', code: '01', label: 'Main Terminal', icon: LayoutDashboard },
  { id: 'paper_trading', code: '02', label: 'Execution & Charts', icon: TrendingUp },
  { id: 'strategy_lab', code: '03', label: 'High-R:R Algo Engine', icon: Brain },
  { id: 'backtesting', code: '04', label: 'Backtesting Studio', icon: History },
  { id: 'risk_management', code: '05', label: 'Discipline Firewall', icon: Shield },
  { id: 'market_analysis', code: '06', label: 'Market Scanner', icon: LineChart },
  { id: 'investment_research', code: '07', label: 'Research Dossiers', icon: FileSearch },
  { id: 'ai_assistant', code: '08', label: 'FloAI Quant Coach', icon: MessageSquare },
  { id: 'settings', code: '09', label: 'Broker Key Vault', icon: KeyRound },
] as const;

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage }) => {
  return (
    <aside className="w-64 bg-[#070a14]/90 backdrop-blur-xl border-r border-blue-500/20 flex flex-col justify-between py-4 select-none shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.4)]">
      <div className="space-y-1 px-3">
        <p className="px-3 text-[10px] font-mono font-bold text-cyan-400/80 uppercase tracking-widest mb-3 flex items-center justify-between">
          <span>QUANT MODULES</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        </p>

        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                soundEngine.playHoverTick();
                onSelectPage(item.id as PageId);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-mono transition-all group relative overflow-hidden ${isActive
                  ? 'bg-gradient-to-r from-blue-600/30 to-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1 bottom-1 w-1 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-r shadow-[0_0_8px_#38bdf8]" />
              )}
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive
                      ? 'text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]'
                      : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                />
                <span className="tracking-tight font-sans font-semibold">{item.label}</span>
              </div>
              <span className={`text-[10px] font-mono ${isActive ? 'text-cyan-400 font-bold' : 'text-slate-600 group-hover:text-slate-400'}`}>
                {item.code}
              </span>
            </button>
          );
        })}
      </div>

      {/* Safety Notice Footer */}
      <div className="px-4 py-3 mx-3 bg-gradient-to-br from-slate-900/90 to-slate-950/90 rounded-2xl border border-slate-800/80 text-[11px] shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl pointer-events-none" />
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
          <p className="text-slate-200 font-bold font-mono">FIREWALL ONLINE</p>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight font-mono">
          Non-custodial AES-256 vault armed. 5-hour news gatekeeper active.
        </p>
      </div>
    </aside>
  );
};
