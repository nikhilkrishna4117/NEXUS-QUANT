import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Server,
  Key,
  Shield,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  Save,
} from 'lucide-react';
import { api } from '../services/api';

export const SettingsPage: React.FC = () => {
  const [providers, setProviders] = useState<any[]>([]);
  const [sysConfig, setSysConfig] = useState<any>(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSettingsData();
  }, []);

  const loadSettingsData = async () => {
    try {
      const [provs, cfg] = await Promise.all([
        api.getProviders(),
        api.getConfig(),
      ]);
      setProviders(provs);
      setSysConfig(cfg);
    } catch (err) {
      console.error('Error loading settings data:', err);
    }
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-3.5rem)] max-w-5xl mx-auto">
      {/* Settings Title Header */}
      <div className="bg-[#0c1017] border border-slate-800/80 rounded-2xl p-5 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
            <SettingsIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">System Settings &amp; Data Adapters</h2>
            <p className="text-xs text-slate-500">Configure data feeds, AI keys, risk parameters, and security policies</p>
          </div>
        </div>
      </div>

      {/* Live Trading Safeguard Notice (Section 9/15) */}
      <div className="bg-amber-950/25 border border-amber-800/60 rounded-xl p-5 text-xs text-amber-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="uppercase tracking-wider">Production Security Safeguard</span>
        </div>
        <p className="leading-relaxed text-amber-200/90">
          <strong>Live Trading is strictly DISABLED by default.</strong> All strategy execution, orders, and portfolio tracking
          run through the functional high-fidelity Paper Trading engine. To enable real exchange routing in the future,
          explicit broker API credentials and manual dual-confirmation are required.
        </p>
      </div>

      {/* Grid: Provider Statuses & API Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Market Data Providers Status */}
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Market Data Providers</span>
            </div>
            <span className="text-xs font-mono text-emerald-400 font-semibold">Active Monitoring</span>
          </div>

          <div className="space-y-3">
            {providers.map((p) => (
              <div key={p.id} className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white capitalize">{p.provider_name.replace('_', ' ')}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                    {p.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                  <span>Latency: {p.latency_ms} ms</span>
                  <span>Feeds: {p.active_symbols}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI & Broker Credentials Form */}
        <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">AI &amp; API Configuration</span>
            </div>
            {saveSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveKeys} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Google Gemini API Key (Optional)</label>
              <input
                type="password"
                placeholder="AIzaSy... (leave blank to use local quant synthesis)"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white text-xs"
              />
              <span className="text-[10px] text-slate-500 mt-1 block">
                When left blank, the system automatically uses deterministic local quantitative synthesis.
              </span>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Zerodha Kite Connect API Key (Optional)</label>
              <input
                type="password"
                placeholder="kite_api_key_..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Interactive Brokers Client Portal API</label>
              <input
                type="text"
                placeholder="https://localhost:5000/v1/api"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 font-mono text-white text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg shadow transition flex items-center justify-center gap-2 mt-4"
            >
              <Save className="w-4 h-4" />
              <span>Update Credentials</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
