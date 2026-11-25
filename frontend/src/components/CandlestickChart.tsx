import React, { useState, useRef, useEffect } from 'react';
import { Candle } from '../types';

interface ChartProps {
  candles: Candle[];
  symbol: string;
  timeframe: string;
  indicators?: any;
  height?: number;
}

export const CandlestickChart: React.FC<ChartProps> = ({
  candles,
  symbol,
  timeframe,
  indicators,
  height = 480,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);

  // Overlay toggles
  const [showEMA9, setShowEMA9] = useState(true);
  const [showEMA21, setShowEMA21] = useState(true);
  const [showEMA50, setShowEMA50] = useState(false);
  const [showBB, setShowBB] = useState(true);
  const [showVWAP, setShowVWAP] = useState(false);
  const [subChart, setSubChart] = useState<'volume' | 'rsi' | 'macd'>('volume');

  // Draw chart onto Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = rect.height * 0.72; // 72% price, 28% subchart
    const subChartTop = chartHeight + 20;
    const subChartHeight = rect.height - subChartTop - 25;

    // Clear background
    ctx.fillStyle = '#0c1017';
    ctx.fillRect(0, 0, width, rect.height);

    // Compute price scale
    const prices = candles.flatMap((c) => [c.high, c.low]);
    const minPrice = Math.min(...prices) * 0.998;
    const maxPrice = Math.max(...prices) * 1.002;
    const priceRange = maxPrice - minPrice || 1;

    // Compute volume scale
    const volumes = candles.map((c) => c.volume);
    const maxVolume = Math.max(...volumes) || 1;

    const paddingRight = 75;
    const chartWidth = width - paddingRight;
    const n = candles.length;
    const barWidth = Math.max(2, (chartWidth / n) * 0.7);
    const barSpacing = chartWidth / n;

    const getY = (price: number) => {
      return chartHeight - ((price - minPrice) / priceRange) * (chartHeight - 40) - 20;
    };

    // Draw horizontal grid lines & price labels
    ctx.strokeStyle = '#1a2234';
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748b';

    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
      const priceVal = minPrice + (priceRange / gridSteps) * i;
      const y = getY(priceVal);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      ctx.fillText(priceVal.toFixed(priceVal > 500 ? 1 : 4), chartWidth + 6, y + 3);
    }

    // Draw Candlesticks & Subchart Bars
    candles.forEach((c, i) => {
      const x = i * barSpacing + barSpacing / 2;
      const isUp = c.close >= c.open;
      const candleColor = isUp ? '#10b981' : '#ef4444';

      // 1. Candlestick Wick (High to Low)
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, getY(c.high));
      ctx.lineTo(x, getY(c.low));
      ctx.stroke();

      // 2. Candlestick Body (Open to Close)
      const openY = getY(c.open);
      const closeY = getY(c.close);
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(openY - closeY));

      ctx.fillStyle = candleColor;
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, bodyHeight);

      // 3. Subchart Rendering
      if (subChart === 'volume') {
        const vHeight = (c.volume / maxVolume) * subChartHeight;
        const vTop = rect.height - 20 - vHeight;
        ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)';
        ctx.fillRect(x - barWidth / 2, vTop, barWidth, vHeight);
      }
    });

    // Draw RSI Subchart
    if (subChart === 'rsi' && indicators?.series?.rsi) {
      const rsiSeries = indicators.series.rsi;
      const rsiStartIdx = Math.max(0, rsiSeries.length - n);

      // Guide lines 30, 50, 70
      [30, 50, 70].forEach((level) => {
        const y = subChartTop + subChartHeight - (level / 100) * subChartHeight;
        ctx.strokeStyle = level === 50 ? '#334155' : 'rgba(148, 163, 184, 0.2)';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#64748b';
        ctx.fillText(level.toString(), chartWidth + 6, y + 3);
      });

      // RSI Curve
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const rsiVal = rsiSeries[rsiStartIdx + i] ?? 50;
        const x = i * barSpacing + barSpacing / 2;
        const y = subChartTop + subChartHeight - (rsiVal / 100) * subChartHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw MACD Subchart
    if (subChart === 'macd' && indicators?.series?.macd_hist) {
      const histSeries = indicators.series.macd_hist;
      const macdStart = Math.max(0, histSeries.length - n);
      const maxHist = Math.max(...histSeries.map((v: number) => Math.abs(v))) || 1;

      for (let i = 0; i < n; i++) {
        const histVal = histSeries[macdStart + i] ?? 0;
        const x = i * barSpacing + barSpacing / 2;
        const zeroY = subChartTop + subChartHeight / 2;
        const barH = (histVal / maxHist) * (subChartHeight / 2);

        ctx.fillStyle = histVal >= 0 ? '#10b981' : '#ef4444';
        if (histVal >= 0) {
          ctx.fillRect(x - barWidth / 2, zeroY - barH, barWidth, barH);
        } else {
          ctx.fillRect(x - barWidth / 2, zeroY, barWidth, Math.abs(barH));
        }
      }
    }

    // Helper to draw indicator lines on price chart
    const drawLine = (series: number[] | undefined, color: string, lineWidth = 1.2, isDashed = false) => {
      if (!series || series.length === 0) return;
      const startIdx = Math.max(0, series.length - n);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (isDashed) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const val = series[startIdx + i];
        if (val !== undefined && val > 0) {
          const x = i * barSpacing + barSpacing / 2;
          const y = getY(val);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      if (isDashed) ctx.setLineDash([]);
    };

    if (showEMA9 && indicators?.series?.ema9) drawLine(indicators.series.ema9, '#38bdf8');
    if (showEMA21 && indicators?.series?.ema21) drawLine(indicators.series.ema21, '#fbbf24');
    if (showEMA50 && indicators?.series?.ema50) drawLine(indicators.series.ema50, '#f97316');
    if (showVWAP && indicators?.series?.vwap) drawLine(indicators.series.vwap, '#ec4899', 1.5);
    if (showBB && indicators?.series?.bb_upper && indicators?.series?.bb_lower) {
      drawLine(indicators.series.bb_upper, 'rgba(59, 130, 246, 0.4)', 1, true);
      drawLine(indicators.series.bb_lower, 'rgba(59, 130, 246, 0.4)', 1, true);
    }

    // Crosshair line if hovered
    if (hoverCoords) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;

      // Vertical crosshair
      ctx.beginPath();
      ctx.moveTo(hoverCoords.x, 0);
      ctx.lineTo(hoverCoords.x, rect.height - 20);
      ctx.stroke();

      // Horizontal crosshair
      if (hoverCoords.y <= chartHeight) {
        ctx.beginPath();
        ctx.moveTo(0, hoverCoords.y);
        ctx.lineTo(chartWidth, hoverCoords.y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, [candles, indicators, showEMA9, showEMA21, showEMA50, showBB, showVWAP, subChart, hoverCoords]);

  // Handle Mouse Move for Tooltip and Crosshair
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const chartWidth = rect.width - 75;
    const barSpacing = chartWidth / candles.length;
    const idx = Math.floor(x / barSpacing);

    if (idx >= 0 && idx < candles.length) {
      setHoveredCandle(candles[idx]);
      setHoverCoords({ x, y });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setHoverCoords(null);
  };

  const latest = hoveredCandle || candles[candles.length - 1];

  return (
    <div className="bg-[#0c1017] rounded-xl border border-slate-800/80 p-4 shadow-xl select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs">
        {/* Symbol & Price Summary */}
        <div className="flex items-center gap-4">
          <span className="font-bold text-slate-100 text-sm tracking-wide">{symbol}</span>
          <span className="px-2 py-0.5 rounded bg-blue-900/40 text-blue-400 font-mono text-xs border border-blue-700/50">
            {timeframe}
          </span>
          {latest && (
            <div className="flex items-center gap-3 font-mono text-slate-300">
              <span>
                O: <span className="text-white">${latest.open.toFixed(2)}</span>
              </span>
              <span>
                H: <span className="text-emerald-400">${latest.high.toFixed(2)}</span>
              </span>
              <span>
                L: <span className="text-rose-400">${latest.low.toFixed(2)}</span>
              </span>
              <span>
                C: <span className={latest.close >= latest.open ? 'text-emerald-400' : 'text-rose-400'}>
                  ${latest.close.toFixed(2)}
                </span>
              </span>
              <span>
                Vol: <span className="text-slate-400">{latest.volume.toFixed(2)}</span>
              </span>
            </div>
          )}
        </div>

        {/* Indicator Toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEMA9(!showEMA9)}
            className={`px-2 py-1 rounded text-xs transition ${
              showEMA9 ? 'bg-sky-500/20 text-sky-400 border border-sky-500/50' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            EMA 9
          </button>
          <button
            onClick={() => setShowEMA21(!showEMA21)}
            className={`px-2 py-1 rounded text-xs transition ${
              showEMA21 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            EMA 21
          </button>
          <button
            onClick={() => setShowEMA50(!showEMA50)}
            className={`px-2 py-1 rounded text-xs transition ${
              showEMA50 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            EMA 50
          </button>
          <button
            onClick={() => setShowBB(!showBB)}
            className={`px-2 py-1 rounded text-xs transition ${
              showBB ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            Bollinger
          </button>
          <button
            onClick={() => setShowVWAP(!showVWAP)}
            className={`px-2 py-1 rounded text-xs transition ${
              showVWAP ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50' : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            VWAP
          </button>

          <span className="text-slate-700">|</span>

          {/* Subchart view selector */}
          <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800">
            <button
              onClick={() => setSubChart('volume')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                subChart === 'volume' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Volume
            </button>
            <button
              onClick={() => setSubChart('rsi')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                subChart === 'rsi' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              RSI
            </button>
            <button
              onClick={() => setSubChart('macd')}
              className={`px-2 py-0.5 rounded text-[11px] ${
                subChart === 'macd' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              MACD
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative mt-2" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-crosshair block rounded-lg"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
};
