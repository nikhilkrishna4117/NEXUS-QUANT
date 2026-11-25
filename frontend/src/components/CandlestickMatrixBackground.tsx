import React, { useEffect, useRef } from 'react';

interface CandleData {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  isUp: boolean;
  speed: number;
  layer: number; // 0: background faint, 1: mid, 2: foreground
}

export const CandlestickMatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Generate streams of realistic candlesticks drifting gently across the 3D space
    const NUM_STREAMS = 4;
    const streams: {
      candles: CandleData[];
      baseY: number;
      price: number;
      trend: number;
      speed: number;
      candleWidth: number;
      spacing: number;
      opacity: number;
    }[] = [];

    // Create 4 distinct horizontal waves of trading candles across different depths
    for (let s = 0; s < NUM_STREAMS; s++) {
      const baseY = height * (0.2 + s * 0.22);
      const candleWidth = s === 1 || s === 2 ? 8 : 5;
      const spacing = candleWidth * 2.2;
      const count = Math.ceil(width / spacing) + 15;
      let price = baseY;

      const candles: CandleData[] = [];
      for (let i = 0; i < count; i++) {
        const delta = (Math.random() - 0.49) * 28;
        const open = price;
        const close = open + delta;
        const high = Math.max(open, close) + Math.random() * 14;
        const low = Math.min(open, close) - Math.random() * 14;
        const isUp = close >= open;

        candles.push({
          x: i * spacing,
          open,
          close,
          high,
          low,
          volume: Math.random() * 25 + 5,
          isUp,
          speed: 0.35 + s * 0.15,
          layer: s,
        });

        price = close;
        // Keep within reasonable bounds
        if (price < baseY - 70) price += 20;
        if (price > baseY + 70) price -= 20;
      }

      streams.push({
        candles,
        baseY,
        price,
        trend: 1,
        speed: 0.25 + s * 0.12,
        candleWidth,
        spacing,
        opacity: s === 0 ? 0.08 : s === 1 ? 0.14 : s === 2 ? 0.12 : 0.09,
      });
    }

    // Floating technical indicator lines (EMAs) that weave through the candles
    let time = 0;

    const render = () => {
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // 1. Atmospheric Ambient Radial Glows (Deep Obsidian Base)
      const grad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.35,
        50,
        width * 0.5,
        height * 0.5,
        Math.max(width, height)
      );
      grad.addColorStop(0, '#0c121e');
      grad.addColorStop(0.5, '#070a12');
      grad.addColorStop(1, '#04060a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. Faint Grid Lines (Price levels & timestamps)
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.025)';
      ctx.lineWidth = 1;

      // Horizontal price lines
      const gridStepY = 70;
      for (let y = gridStepY; y < height; y += gridStepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical time lines
      const gridStepX = 110;
      for (let x = gridStepX; x < width; x += gridStepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // 3. Render Candle Streams with Moving Candles, Wicks, and Glowing Bodies
      streams.forEach((stream, sIdx) => {
        ctx.save();
        ctx.globalAlpha = stream.opacity;

        const { candles, candleWidth, spacing } = stream;

        // Render EMA wave line through this stream
        ctx.beginPath();
        ctx.strokeStyle = sIdx % 2 === 0 ? 'rgba(56, 189, 248, 0.4)' : 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 1.5;

        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];
          const midY = (c.open + c.close) / 2;
          if (i === 0) ctx.moveTo(c.x + candleWidth / 2, midY);
          else ctx.lineTo(c.x + candleWidth / 2, midY);
        }
        ctx.stroke();

        // Render Individual Candlesticks
        for (let i = 0; i < candles.length; i++) {
          const c = candles[i];

          // Slowly scroll leftwards like a live tick tape
          c.x -= stream.speed;

          // If scrolled off screen to the left, wrap around to the right with fresh price step
          if (c.x < -spacing) {
            const lastCandle = candles[(i + candles.length - 1) % candles.length];
            c.x = lastCandle.x + spacing;

            const delta = (Math.random() - 0.48) * 30;
            c.open = stream.price;
            c.close = c.open + delta;
            c.high = Math.max(c.open, c.close) + Math.random() * 16;
            c.low = Math.min(c.open, c.close) - Math.random() * 16;
            c.isUp = c.close >= c.open;
            c.volume = Math.random() * 30 + 5;

            stream.price = c.close;
            if (stream.price < stream.baseY - 70) stream.price += 25;
            if (stream.price > stream.baseY + 70) stream.price -= 25;
          }

          const top = Math.min(c.open, c.close);
          const bodyH = Math.max(3, Math.abs(c.close - c.open));

          const colorBull = '#10b981'; // Crisp emerald
          const colorBear = '#ef4444'; // Sharp rose

          // Wick (High to Low thin line)
          ctx.strokeStyle = c.isUp ? colorBull : colorBear;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(c.x + candleWidth / 2, c.low);
          ctx.lineTo(c.x + candleWidth / 2, c.high);
          ctx.stroke();

          // Candle Body
          ctx.fillStyle = c.isUp ? colorBull : colorBear;
          ctx.shadowColor = c.isUp ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';
          ctx.shadowBlur = 6;
          ctx.fillRect(c.x, top, candleWidth, bodyH);

          // Volume Bar at Bottom
          const volY = height - 20;
          ctx.fillStyle = c.isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';
          ctx.fillRect(c.x, volY - c.volume * 0.7, candleWidth, c.volume * 0.7);
        }

        ctx.restore();
      });

      // 4. Subtle Floating Price Badges (Simulating real orderbook flow in background)
      ctx.save();
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.globalAlpha = 0.15;

      const badgeX1 = (width * 0.25 + time * 15) % (width + 200) - 100;
      ctx.fillStyle = '#10b981';
      ctx.fillText('▲ BUY 1.84 BTC @ $64,820', badgeX1, height * 0.28);

      const badgeX2 = (width * 0.7 - time * 20) % (width + 200);
      ctx.fillStyle = '#ef4444';
      ctx.fillText('▼ SELL 3.20 ETH @ $3,450', badgeX2, height * 0.65);

      const badgeX3 = (width * 0.5 + time * 12) % (width + 200) - 50;
      ctx.fillStyle = '#38bdf8';
      ctx.fillText('◈ GOLD XAU/USD $2,734.50', badgeX3, height * 0.82);

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    />
  );
};
