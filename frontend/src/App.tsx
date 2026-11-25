import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { NewsManipulationHUD } from './components/NewsManipulationHUD';
import { Sidebar, PageId } from './components/Sidebar';
import { ThreeCandlestickBackground } from './components/ThreeCandlestickBackground';
import { TradingViewTickerTape } from './components/TradingViewTickerTape';
import { CryogenicQuantLanding } from './pages/CryogenicQuantLanding';
import { DashboardPage } from './pages/DashboardPage';
import { MarketAnalysisPage } from './pages/MarketAnalysisPage';
import { StrategyLabPage } from './pages/StrategyLabPage';
import { BacktestingPage } from './pages/BacktestingPage';
import { PaperTradingPage } from './pages/PaperTradingPage';
import { RiskManagementPage } from './pages/RiskManagementPage';
import { InvestmentResearchPage } from './pages/InvestmentResearchPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { SettingsPage } from './pages/SettingsPage';
import { api } from './services/api';
import { Ticker24h, PortfolioSummary, RiskDashboardSummary } from './types';

export const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'landing' | 'workstation'>('landing');
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [btcTicker, setBtcTicker] = useState<Ticker24h | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskDashboardSummary | null>(null);
  const [isWsConnected, setIsWsConnected] = useState(false);

  // Poll global header metrics every 5 seconds
  useEffect(() => {
    const fetchGlobalMetrics = async () => {
      try {
        const [ticker, port, risk] = await Promise.all([
          api.getTicker('BTCUSDT'),
          api.getPortfolio(),
          api.getRiskDashboard(),
        ]);
        setBtcTicker(ticker);
        setPortfolio(port);
        setRiskSummary(risk);
      } catch (err) {
        // quiet error on initial polling
      }
    };

    fetchGlobalMetrics();
    const interval = setInterval(fetchGlobalMetrics, 5000);
    return () => clearInterval(interval);
  }, []);

  // Connect WebSocket for live ticks
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/stream`;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'TICK' && data.symbol === 'BTCUSDT') {
              setBtcTicker((prev) =>
                prev ? { ...prev, last_price: data.price } : null
              );
            }
          } catch { }
        };

        ws.onclose = () => {
          setIsWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 5000);
        };

        ws.onerror = () => {
          setIsWsConnected(false);
        };
      } catch {
        setIsWsConnected(false);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleLaunchWorkstation = (targetModule?: string) => {
    setViewMode('workstation');
    if (targetModule) {
      if (targetModule === 'execution') setCurrentPage('paper_trading');
      else if (targetModule === 'guardrails') setCurrentPage('risk_management');
      else if (targetModule === 'edge_plan') setCurrentPage('strategy_lab');
      else if (targetModule === 'journal') setCurrentPage('dashboard');
      else if (targetModule === 'flo_ai') setCurrentPage('ai_assistant');
      else if (targetModule === 'analytics') setCurrentPage('backtesting');
    }
  };

  // Render current selected page in workstation mode
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'market_analysis':
        return <MarketAnalysisPage />;
      case 'strategy_lab':
        return <StrategyLabPage />;
      case 'backtesting':
        return <BacktestingPage />;
      case 'paper_trading':
        return <PaperTradingPage />;
      case 'risk_management':
        return <RiskManagementPage />;
      case 'investment_research':
        return <InvestmentResearchPage />;
      case 'ai_assistant':
        return <AIAssistantPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  // If in 3D Cryogenic Quant Landing Mode:
  if (viewMode === 'landing') {
    return <CryogenicQuantLanding onLaunchWorkstation={handleLaunchWorkstation} />;
  }

  // Full Institutional Trading Workstation
  return (
    <div className="h-screen w-screen flex flex-col bg-[#04060c]/80 text-slate-100 font-sans overflow-hidden relative">
      {/* 3D Smooth Motion Moving Candlesticks WebGL Background */}
      <ThreeCandlestickBackground />
      <Navbar
        btcTicker={btcTicker}
        portfolio={portfolio}
        riskSummary={riskSummary}
        isWsConnected={isWsConnected}
        onSwitchTo3DLanding={() => setViewMode('landing')}
        onKillSwitchToggled={() => {
          api.getRiskDashboard().then(setRiskSummary).catch(() => null);
        }}
      />
      {/* 5-Hour News Lockout & Retail Manipulation HUD */}
      <NewsManipulationHUD />
      <TradingViewTickerTape />
      <div className="flex-1 flex overflow-hidden z-10 relative">
        <Sidebar currentPage={currentPage} onSelectPage={setCurrentPage} />
        <main className="flex-1 overflow-hidden">{renderPage()}</main>
      </div>
    </div>
  );
};

export default App;
