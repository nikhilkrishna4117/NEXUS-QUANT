import React, { useEffect, useRef, memo } from 'react';

const TradingViewTickerTapeComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetWrapper = document.createElement('div');
    widgetWrapper.className = 'tradingview-widget-container__widget';
    container.appendChild(widgetWrapper);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
    script.async = true;

    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'BINANCE:BTCUSDT', title: 'BTC/USDT' },
        { proName: 'BINANCE:ETHUSDT', title: 'ETH/USDT' },
        { proName: 'BINANCE:SOLUSDT', title: 'SOL/USDT' },
        { proName: 'TVC:GOLD', title: 'Gold (XAU/USD)' },
        { proName: 'FX:EURUSD', title: 'EUR/USD' },
        { proName: 'BSE:RELIANCE', title: 'Reliance' },
        { proName: 'NSE:NIFTY', title: 'NIFTY 50' },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en'
    });

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="w-full bg-[#070b14]/90 border-b border-blue-500/20 backdrop-blur-md overflow-hidden py-1 z-20">
      <div ref={containerRef} className="tradingview-widget-container" />
    </div>
  );
};

export const TradingViewTickerTape = memo(TradingViewTickerTapeComponent);
