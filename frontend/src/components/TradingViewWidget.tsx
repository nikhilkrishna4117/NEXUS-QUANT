import React, { useEffect, useState, useId, memo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  CheckCircle2,
  X,
  Zap,
  ChevronDown,
  ChevronUp,
  Sliders,
  Maximize2
} from 'lucide-react';
import { api } from '../services/api';
import { soundEngine } from '../audio/SoundEngine';

interface TradingViewWidgetProps {
  symbol: string;
  timeframe?: string;
  height?: number;
  onTradeExecuted?: () => void;
}

const mapSymbolToTradingView = (symbol: string): string => {
  const upper = symbol.toUpperCase().trim();
  if (upper === 'BTCUSDT' || upper === 'BTC/USDT') return 'BINANCE:BTCUSDT';
  if (upper === 'ETHUSDT' || upper === 'ETH/USDT') return 'BINANCE:ETHUSDT';
  if (upper === 'SOLUSDT' || upper === 'SOL/USDT') return 'BINANCE:SOLUSDT';
  if (upper === 'GC=F' || upper === 'XAUUSD' || upper === 'GOLD') return 'TVC:GOLD';
  if (upper === 'EURUSD=X' || upper === 'EURUSD') return 'FX:EURUSD';
  if (upper === 'GBPUSD=X' || upper === 'GBPUSD') return 'FX:GBPUSD';
  if (upper === 'USDJPY=X' || upper === 'USDJPY') return 'FX:USDJPY';
  if (upper === 'RELIANCE.NS' || upper === 'RELIANCE') return 'BSE:RELIANCE';
  if (upper === '^NSEI' || upper === 'NIFTY') return 'NSE:NIFTY';
  if (upper.endsWith('USDT')) return `BINANCE:${upper}`;
  if (upper.endsWith('.NS')) return `NSE:${upper.replace('.NS', '')}`;
  return `BINANCE:${upper}`;
};

const mapTimeframeToTradingView = (tf: string): string => {
  switch (tf) {
    case '1m': return '1';
    case '5m': return '5';
    case '15m': return '15';
    case '30m': return '30';
    case '1h': return '60';
    case '4h': return '240';
    case '1d': return 'D';
    case '1w': return 'W';
    default: return '60';
  }
};

const TradingViewWidgetComponent: React.FC<TradingViewWidgetProps> = ({
  symbol,
  timeframe = '1h',
  height = 520,
  onTradeExecuted,
}) => {
  const rawId = useId();
  const containerId = `tv_chart_${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const tvSymbol = mapSymbolToTradingView(symbol);
  const tvInterval = mapTimeframeToTradingView(timeframe);
  const [useIframeFallback, setUseIframeFallback] = useState(false);

  // Live Trading Execution State
  const [quantity, setQuantity] = useState<number>(0.1);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [activePosition, setActivePosition] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderToast, setOrderToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showOrderSettings, setShowOrderSettings] = useState(false);
  const [slPercent, setSlPercent] = useState<number>(1.0); // 1.0% stop loss
  const [tpPercent, setTpPercent] = useState<number>(3.0); // 3.0% take profit (1:3 R:R)
  const [activeAccountLabel, setActiveAccountLabel] = useState<string>('Master Account');

  // Fetch live price for current symbol
  useEffect(() => {
    let isMounted = true;
    const fetchPriceAndPosition = async () => {
      try {
        const [tickerRes, portRes] = await Promise.all([
          api.getTicker(symbol).catch(() => null),
          api.getPortfolio().catch(() => null),
        ]);

        if (isMounted) {
          if (tickerRes?.last_price) {
            setLivePrice(tickerRes.last_price);
          }
          if (portRes?.account_name) {
            setActiveAccountLabel(portRes.account_name);
          }
          if (portRes?.open_positions) {
            const pos = portRes.open_positions.find(
              (p: any) => p.symbol.toUpperCase() === symbol.toUpperCase()
            );
            setActivePosition(pos || null);
          }
        }
      } catch {}
    };

    fetchPriceAndPosition();
    const interval = setInterval(fetchPriceAndPosition, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [symbol]);

  // Handle Instant Buy or Sell Execution
  const handleExecuteTrade = async (side: 'BUY' | 'SELL') => {
    if (!livePrice || isSubmitting) return;

    soundEngine.playHoverTick();
    setIsSubmitting(true);
    setOrderToast(null);

    // Calculate exact Stop Loss & Take Profit from percentages
    const currentPrice = livePrice;
    let stopLoss: number;
    let takeProfit: number;

    if (side === 'BUY') {
      stopLoss = currentPrice * (1 - slPercent / 100);
      takeProfit = currentPrice * (1 + tpPercent / 100);
    } else {
      stopLoss = currentPrice * (1 + slPercent / 100);
      takeProfit = currentPrice * (1 - tpPercent / 100);
    }

    try {
      const response = await api.submitOrder({
        symbol: symbol.toUpperCase(),
        side: side,
        quantity: quantity,
        order_type: 'MARKET',
        price: currentPrice,
        stop_loss: parseFloat(stopLoss.toFixed(2)),
        take_profit: parseFloat(takeProfit.toFixed(2)),
      });

      soundEngine.playSubDrop();
      setOrderToast({
        type: 'success',
        message: `ORDER FILLED: ${side} ${quantity} ${symbol} @ $${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} // SL: $${stopLoss.toFixed(2)} // TP: $${takeProfit.toFixed(2)}`,
      });

      // Refresh portfolio position
      const portRes = await api.getPortfolio().catch(() => null);
      if (portRes?.open_positions) {
        const pos = portRes.open_positions.find(
          (p: any) => p.symbol.toUpperCase() === symbol.toUpperCase()
        );
        setActivePosition(pos || null);
      }

      if (onTradeExecuted) onTradeExecuted();
    } catch (err: any) {
      soundEngine.playFrostLock();
      setOrderToast({
        type: 'error',
        message: err.message || 'Trade blocked by Discipline Firewall Guardrails.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close open position directly from chart
  const handleClosePosition = async () => {
    if (!activePosition || isSubmitting) return;
    setIsSubmitting(true);
    soundEngine.playHoverTick();

    try {
      await api.closePosition(activePosition.id);
      soundEngine.playSubDrop();
      setActivePosition(null);
      setOrderToast({
        type: 'success',
        message: `POSITION CLOSED: ${activePosition.side} ${activePosition.quantity} ${symbol} flattened at market.`,
      });
      if (onTradeExecuted) onTradeExecuted();
    } catch (err: any) {
      soundEngine.playFrostLock();
      setOrderToast({
        type: 'error',
        message: err.message || 'Failed to close position.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mount TradingView Widget
  useEffect(() => {
    let scriptLoaded = false;
    let widget: any = null;

    const initWidget = () => {
      if ((window as any).TradingView) {
        try {
          const container = document.getElementById(containerId);
          if (container) {
            container.innerHTML = '';
          }
          widget = new (window as any).TradingView.widget({
            autosize: true,
            symbol: tvSymbol,
            interval: tvInterval,
            timezone: 'Etc/UTC',
            theme: 'dark',
            style: '1',
            locale: 'en',
            toolbar_bg: '#04060c',
            enable_publishing: false,
            hide_top_toolbar: false,
            hide_legend: false,
            save_image: true,
            container_id: containerId,
            withdateranges: true,
            hide_side_toolbar: false,
            allow_symbol_change: true,
            show_popup_button: true,
            popup_width: '1000',
            popup_height: '650',
            studies: [
              'RSI@tv-basicstudies',
              'MASimple@tv-basicstudies',
              'MACD@tv-basicstudies',
            ],
            overrides: {
              'paneProperties.background': '#05070d',
              'paneProperties.vertGridProperties.color': '#0d1322',
              'paneProperties.horzGridProperties.color': '#0d1322',
              'mainSeriesProperties.candleStyle.upColor': '#00f5a0',
              'mainSeriesProperties.candleStyle.downColor': '#ff3366',
              'mainSeriesProperties.candleStyle.wickUpColor': '#00f5a0',
              'mainSeriesProperties.candleStyle.wickDownColor': '#ff3366',
            },
          });
        } catch (e) {
          setUseIframeFallback(true);
        }
      } else {
        setUseIframeFallback(true);
      }
    };

    const existingScript = document.getElementById('tradingview-tv-js');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'tradingview-tv-js';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => {
        scriptLoaded = true;
        initWidget();
      };
      script.onerror = () => {
        setUseIframeFallback(true);
      };
      document.head.appendChild(script);
    } else {
      if ((window as any).TradingView) {
        initWidget();
      } else {
        existingScript.addEventListener('load', initWidget);
      }
    }

    return () => {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [tvSymbol, tvInterval, containerId]);

  const directEmbedUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(
    tvSymbol
  )}&interval=${tvInterval}&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=04060c&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides=%7B%7D&overrides=%7B%22paneProperties.background%22%3A%22%2305070d%22%2C%22paneProperties.vertGridProperties.color%22%3A%22%230d1322%22%2C%22paneProperties.horzGridProperties.color%22%3A%22%230d1322%22%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&locale=en&utm_source=localhost`;

  // Calculated bid and ask spreads
  const spreadOffset = (livePrice || 50000) * 0.00015;
  const bidPrice = livePrice ? (livePrice - spreadOffset).toFixed(2) : '--';
  const askPrice = livePrice ? (livePrice + spreadOffset).toFixed(2) : '--';
  const rrRatio = (tpPercent / slPercent).toFixed(1);

  return (
    <div className="relative rounded-2xl bg-[#05070d] border border-cyan-500/30 overflow-hidden shadow-[0_0_40px_rgba(2,132,199,0.2)] group flex flex-col">
      {/* ============================================================== */}
      {/* 1. TOP LIVE TRADING EXECUTION BAR OVERLAID DIRECTLY ON CHART   */}
      {/* ============================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#070b16] border-b border-slate-800/90 z-20 select-none">
        {/* Left: Asset Identifier & Live Telemetry */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-white font-extrabold text-sm tracking-tight">{symbol}</span>
            <span className="text-cyan-400 font-mono text-xs font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
              {tvSymbol}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
            <span className="text-slate-400">LAST:</span>
            <span className="text-white font-black text-sm tracking-tight">
              ${livePrice != null ? livePrice.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '...'}
            </span>
          </div>

          {/* Active Demo Account Target */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-500/25 text-[10px] font-mono text-cyan-300">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-bold truncate max-w-[130px]">{activeAccountLabel}</span>
          </div>
        </div>

        {/* Center / Right: INSTITUTIONAL ONE-CLICK BUY & SELL CONSOLE */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Quantity Selector */}
          <div className="flex items-center bg-[#0b1222] border border-slate-700/80 rounded-xl p-1 font-mono text-xs">
            <button
              onClick={() => {
                soundEngine.playHoverTick();
                setQuantity((prev) => Math.max(0.01, parseFloat((prev - 0.1).toFixed(2))));
              }}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Decrease Quantity"
            >
              -
            </button>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
              className="w-16 bg-transparent text-center font-bold text-white focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 pr-1">LOTS</span>
            <button
              onClick={() => {
                soundEngine.playHoverTick();
                setQuantity((prev) => parseFloat((prev + 0.1).toFixed(2)));
              }}
              className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Increase Quantity"
            >
              +
            </button>
          </div>

          {/* Quick Preset Pills */}
          <div className="hidden md:flex items-center gap-1 font-mono text-[10px]">
            {[0.01, 0.1, 0.5, 1.0].map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  soundEngine.playHoverTick();
                  setQuantity(preset);
                }}
                className={`px-1.5 py-1 rounded border transition ${
                  quantity === preset
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* INSTANT SELL (SHORT) BUTTON */}
          <button
            onClick={() => handleExecuteTrade('SELL')}
            disabled={isSubmitting}
            className="group relative px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-white font-extrabold text-xs font-mono transition-all shadow-[0_0_20px_rgba(244,63,94,0.35)] flex items-center gap-2 transform active:scale-95 cursor-pointer"
          >
            <TrendingDown className="w-4 h-4 text-rose-200" />
            <div className="text-left">
              <div className="text-[10px] text-rose-200 uppercase leading-none font-bold">SELL</div>
              <div className="text-xs font-black tracking-tight">${bidPrice}</div>
            </div>
          </button>

          {/* INSTANT BUY (LONG) BUTTON */}
          <button
            onClick={() => handleExecuteTrade('BUY')}
            disabled={isSubmitting}
            className="group relative px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs font-mono transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] flex items-center gap-2 transform active:scale-95 cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-emerald-200" />
            <div className="text-left">
              <div className="text-[10px] text-emerald-200 uppercase leading-none font-bold">BUY</div>
              <div className="text-xs font-black tracking-tight">${askPrice}</div>
            </div>
          </button>

          {/* SL / TP Settings Toggle */}
          <button
            onClick={() => {
              soundEngine.playHoverTick();
              setShowOrderSettings(!showOrderSettings);
            }}
            className={`p-2 rounded-xl border transition ${
              showOrderSettings
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Configure Stop Loss & Take Profit Guardrails"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 2. SL / TP GUARDRAIL SLIDER EXPANSION PANEL                    */}
      {/* ============================================================== */}
      {showOrderSettings && (
        <div className="px-4 py-2.5 bg-[#090e1d] border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-300 animate-in fade-in slide-in-from-top-2 duration-200 z-20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-rose-400 font-bold">STOP LOSS (SL):</span>
              <input
                type="number"
                step="0.1"
                min="0.2"
                max="10"
                value={slPercent}
                onChange={(e) => setSlPercent(parseFloat(e.target.value) || 1.0)}
                className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-rose-300 font-bold"
              />
              <span className="text-slate-500">%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">TAKE PROFIT (TP):</span>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="30"
                value={tpPercent}
                onChange={(e) => setTpPercent(parseFloat(e.target.value) || 3.0)}
                className="w-14 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-center text-emerald-300 font-bold"
              />
              <span className="text-slate-500">%</span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/30 text-cyan-300 font-bold text-[11px]">
              <span>TARGET R:R: 1:{rrRatio}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pre-Trade Server Firewall Active (Min 1.5:1 R:R Enforced)</span>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. ACTIVE OPEN POSITION OVERLAY BANNER (When Trade is Active)  */}
      {/* ============================================================== */}
      {activePosition && (
        <div className="px-4 py-2 bg-gradient-to-r from-blue-950/90 via-[#0a1226]/90 to-blue-950/90 border-b border-cyan-500/30 flex items-center justify-between text-xs font-mono z-20 select-none">
          <div className="flex items-center gap-3">
            <span className={`px-2 py-0.5 rounded font-black text-[11px] ${
              activePosition.side === 'BUY' || activePosition.side === 'LONG'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}>
              ● ACTIVE {activePosition.side} ({activePosition.quantity} LOTS)
            </span>
            <span className="text-slate-400">
              ENTRY: <strong className="text-white">${activePosition.entry_price?.toLocaleString()}</strong>
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400">
              P&L:{' '}
              <strong
                className={`font-black ${
                  (activePosition.unrealized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {(activePosition.unrealized_pnl ?? 0) >= 0 ? '+' : ''}$
                {activePosition.unrealized_pnl?.toFixed(2) ?? '0.00'} (
                {activePosition.unrealized_pnl_pct != null
                  ? `${activePosition.unrealized_pnl_pct.toFixed(2)}%`
                  : '0.00%'}
                )
              </strong>
            </span>
          </div>

          <button
            onClick={handleClosePosition}
            disabled={isSubmitting}
            className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-500/40 font-bold text-[11px] transition flex items-center gap-1 active:scale-95"
          >
            <span>FLATTEN / CLOSE</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. EXECUTION TOAST ALERT BANNER (Order Fills & Firewall Blocks)*/}
      {/* ============================================================== */}
      {orderToast && (
        <div
          className={`px-4 py-2 flex items-center justify-between text-xs font-mono z-20 select-none animate-in fade-in duration-200 ${
            orderToast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-b border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
              : 'bg-rose-950/90 text-rose-300 border-b border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
          }`}
        >
          <div className="flex items-center gap-2">
            {orderToast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-semibold">{orderToast.message}</span>
          </div>

          <button
            onClick={() => setOrderToast(null)}
            className="p-1 hover:opacity-75 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MAIN TRADINGVIEW CHART CONTAINER                            */}
      {/* ============================================================== */}
      <div style={{ height: `${height}px` }} className="w-full relative bg-[#05070d]">
        {useIframeFallback ? (
          <iframe
            title={`TradingView-${tvSymbol}`}
            src={directEmbedUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="fullscreen; clipboard-write;"
          />
        ) : (
          <div id={containerId} style={{ width: '100%', height: '100%' }} />
        )}
      </div>
    </div>
  );
};

export const TradingViewWidget = memo(TradingViewWidgetComponent);
