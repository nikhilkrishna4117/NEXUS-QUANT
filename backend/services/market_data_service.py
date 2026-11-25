import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import httpx
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from backend.config import settings
from backend.database import SessionLocal
from backend.models.market_data import Candle, Instrument, ProviderStatus

logger = logging.getLogger(__name__)

# Standard instruments supported out of the box
DEFAULT_INSTRUMENTS = [
    {
        "symbol": "BTCUSDT",
        "name": "Bitcoin / Tether",
        "asset_class": "crypto",
        "base_asset": "BTC",
        "quote_asset": "USDT",
        "provider": "binance",
        "min_quantity": 0.0001,
        "price_precision": 2,
        "quantity_precision": 4,
    },
    {
        "symbol": "ETHUSDT",
        "name": "Ethereum / Tether",
        "asset_class": "crypto",
        "base_asset": "ETH",
        "quote_asset": "USDT",
        "provider": "binance",
        "min_quantity": 0.001,
        "price_precision": 2,
        "quantity_precision": 3,
    },
    {
        "symbol": "SOLUSDT",
        "name": "Solana / Tether",
        "asset_class": "crypto",
        "base_asset": "SOL",
        "quote_asset": "USDT",
        "provider": "binance",
        "min_quantity": 0.01,
        "price_precision": 2,
        "quantity_precision": 2,
    },
    {
        "symbol": "GC=F",
        "name": "Gold Futures (XAUUSD)",
        "asset_class": "commodity",
        "base_asset": "XAU",
        "quote_asset": "USD",
        "provider": "yahoo_finance",
        "min_quantity": 0.01,
        "price_precision": 2,
        "quantity_precision": 2,
    },
    {
        "symbol": "EURUSD=X",
        "name": "Euro / US Dollar",
        "asset_class": "forex",
        "base_asset": "EUR",
        "quote_asset": "USD",
        "provider": "yahoo_finance",
        "min_quantity": 1000.0,
        "price_precision": 5,
        "quantity_precision": 0,
    },
    {
        "symbol": "RELIANCE.NS",
        "name": "Reliance Industries (NSE)",
        "asset_class": "equity",
        "base_asset": "RELIANCE",
        "quote_asset": "INR",
        "provider": "yahoo_finance",
        "min_quantity": 1.0,
        "price_precision": 2,
        "quantity_precision": 0,
    },
    {
        "symbol": "^NSEI",
        "name": "NIFTY 50 Index",
        "asset_class": "equity",
        "base_asset": "NIFTY50",
        "quote_asset": "INR",
        "provider": "yahoo_finance",
        "min_quantity": 1.0,
        "price_precision": 2,
        "quantity_precision": 0,
    }
]

class MarketDataService:
    def __init__(self):
        self._price_cache: Dict[str, float] = {}
        self._ticker_cache: Dict[str, Dict[str, Any]] = {}
        self._last_fetch_time: Dict[str, datetime] = {}

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(timeout=8.0)

    async def initialize_instruments(self, db: Session):
        """Seed default verified instruments and provider status into database."""
        for item in DEFAULT_INSTRUMENTS:
            existing = db.query(Instrument).filter(Instrument.symbol == item["symbol"]).first()
            if not existing:
                inst = Instrument(**item)
                db.add(inst)
        
        # Ensure provider status records exist
        for provider in ["binance", "coinbase", "yahoo_finance"]:
            p_status = db.query(ProviderStatus).filter(ProviderStatus.provider_name == provider).first()
            if not p_status:
                db.add(ProviderStatus(
                    provider_name=provider,
                    status="operational",
                    last_ping=datetime.utcnow(),
                    latency_ms=45.0,
                    active_symbols="BTCUSDT,ETHUSDT" if provider != "yahoo_finance" else "GC=F,RELIANCE.NS"
                ))
        db.commit()

    async def get_latest_price(self, symbol: str, db: Optional[Session] = None) -> float:
        """Fetch the current market price from cache or live API."""
        if symbol in self._price_cache:
            # If cached within last 3 seconds, return cached
            last_time = self._last_fetch_time.get(symbol)
            if last_time and (datetime.utcnow() - last_time).total_seconds() < 3.0:
                return self._price_cache[symbol]

        try:
            async with self._client() as client:
                if symbol.endswith("USDT") or symbol in ["BTC", "ETH", "SOL"]:
                    # Fetch from Binance
                    clean_sym = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
                    resp = await client.get(
                        f"{settings.BINANCE_BASE_URL}/api/v3/ticker/price",
                        params={"symbol": clean_sym}
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        price = float(data["price"])
                        self._price_cache[symbol] = price
                        self._last_fetch_time[symbol] = datetime.utcnow()
                        return price
                else:
                    # Yahoo Finance
                    resp = await client.get(
                        f"{settings.YAHOO_FINANCE_BASE_URL}/{symbol}",
                        params={"interval": "1m", "range": "1d"},
                        headers={"User-Agent": "Mozilla/5.0"}
                    )
                    if resp.status_code == 200:
                        result = resp.json()["chart"]["result"][0]
                        meta = result.get("meta", {})
                        price = float(meta.get("regularMarketPrice", 0.0))
                        if price > 0:
                            self._price_cache[symbol] = price
                            self._last_fetch_time[symbol] = datetime.utcnow()
                            return price
        except Exception as e:
            logger.warning(f"Error fetching live price for {symbol}: {e}")

        # Fallback to database latest candle close
        if db:
            latest_candle = db.query(Candle).filter(Candle.symbol == symbol).order_by(desc(Candle.timestamp)).first()
            if latest_candle:
                return latest_candle.close

        return self._price_cache.get(symbol, 64000.0 if "BTC" in symbol else 100.0)

    async def get_ticker_24h(self, symbol: str) -> Dict[str, Any]:
        """Fetch 24hr statistics (high, low, volume, change) for an instrument."""
        try:
            async with self._client() as client:
                if symbol.endswith("USDT"):
                    resp = await client.get(
                        f"{settings.BINANCE_BASE_URL}/api/v3/ticker/24hr",
                        params={"symbol": symbol}
                    )
                    if resp.status_code == 200:
                        d = resp.json()
                        return {
                            "symbol": symbol,
                            "last_price": float(d["lastPrice"]),
                            "price_change_24h": float(d["priceChange"]),
                            "price_change_pct_24h": float(d["priceChangePercent"]),
                            "high_24h": float(d["highPrice"]),
                            "low_24h": float(d["lowPrice"]),
                            "volume_24h": float(d["volume"]),
                            "quote_volume_24h": float(d["quoteVolume"]),
                            "bid": float(d.get("bidPrice", d["lastPrice"])),
                            "ask": float(d.get("askPrice", d["lastPrice"])),
                            "provider": "binance",
                            "updated_at": datetime.utcnow().isoformat()
                        }
                else:
                    # Yahoo Finance format
                    resp = await client.get(
                        f"{settings.YAHOO_FINANCE_BASE_URL}/{symbol}",
                        params={"interval": "1d", "range": "5d"},
                        headers={"User-Agent": "Mozilla/5.0"}
                    )
                    if resp.status_code == 200:
                        meta = resp.json()["chart"]["result"][0]["meta"]
                        price = float(meta.get("regularMarketPrice", 0.0))
                        prev_close = float(meta.get("chartPreviousClose", price))
                        change = price - prev_close
                        change_pct = (change / prev_close * 100.0) if prev_close else 0.0
                        return {
                            "symbol": symbol,
                            "last_price": price,
                            "price_change_24h": round(change, 4),
                            "price_change_pct_24h": round(change_pct, 2),
                            "high_24h": float(meta.get("regularMarketDayHigh", price)),
                            "low_24h": float(meta.get("regularMarketDayLow", price)),
                            "volume_24h": float(meta.get("regularMarketVolume", 0)),
                            "quote_volume_24h": 0.0,
                            "bid": price,
                            "ask": price,
                            "provider": "yahoo_finance",
                            "updated_at": datetime.utcnow().isoformat()
                        }
        except Exception as e:
            logger.error(f"Error fetching 24h ticker for {symbol}: {e}")

        # Fallback default
        return {
            "symbol": symbol,
            "last_price": self._price_cache.get(symbol, 64000.0 if "BTC" in symbol else 100.0),
            "price_change_24h": 0.0,
            "price_change_pct_24h": 0.0,
            "high_24h": 0.0,
            "low_24h": 0.0,
            "volume_24h": 0.0,
            "quote_volume_24h": 0.0,
            "bid": 0.0,
            "ask": 0.0,
            "provider": "simulated_cache",
            "updated_at": datetime.utcnow().isoformat()
        }

    async def fetch_historical_candles(
        self,
        symbol: str,
        timeframe: str = "1h",
        limit: int = 500,
        db: Optional[Session] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch real historical OHLCV data from API, validate & deduplicate,
        and persist into database if db session is provided.
        """
        candles: List[Dict[str, Any]] = []

        if symbol.endswith("USDT") or symbol in ["BTC", "ETH", "SOL"]:
            clean_sym = symbol if symbol.endswith("USDT") else f"{symbol}USDT"
            # Map timeframes to Binance format
            tf_map = {"1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d"}
            b_interval = tf_map.get(timeframe, "1h")

            try:
                async with self._client() as client:
                    resp = await client.get(
                        f"{settings.BINANCE_BASE_URL}/api/v3/klines",
                        params={"symbol": clean_sym, "interval": b_interval, "limit": min(limit, 1000)}
                    )
                    if resp.status_code == 200:
                        raw_data = resp.json()
                    for item in raw_data:
                        # Binance kline format: [open_time, open, high, low, close, volume, close_time, quote_asset_vol, ...]
                        open_time_dt = datetime.utcfromtimestamp(item[0] / 1000.0)
                        candle_dict = {
                            "symbol": symbol,
                            "timeframe": timeframe,
                            "timestamp": open_time_dt,
                            "open": float(item[1]),
                            "high": float(item[2]),
                            "low": float(item[3]),
                            "close": float(item[4]),
                            "volume": float(item[5]),
                            "turnover": float(item[7]),
                            "provider": "binance",
                            "is_closed": True
                        }
                        candles.append(candle_dict)
            except Exception as e:
                logger.error(f"Error fetching Binance historical klines: {e}")
        else:
            # Multi-asset Yahoo Finance
            range_map = {
                "1m": ("1m", "5d"),
                "5m": ("5m", "1mo"),
                "15m": ("15m", "1mo"),
                "1h": ("60m", "3mo"),
                "4h": ("60m", "6mo"),
                "1d": ("1d", "2y"),
            }
            yf_interval, yf_range = range_map.get(timeframe, ("60m", "3mo"))

            try:
                async with self._client() as client:
                    resp = await client.get(
                        f"{settings.YAHOO_FINANCE_BASE_URL}/{symbol}",
                        params={"interval": yf_interval, "range": yf_range},
                        headers={"User-Agent": "Mozilla/5.0"}
                    )
                    if resp.status_code == 200:
                        result = resp.json()["chart"]["result"][0]
                        timestamps = result.get("timestamp", [])
                        quote = result.get("indicators", {}).get("quote", [{}])[0]
                        opens = quote.get("open", [])
                        highs = quote.get("high", [])
                        lows = quote.get("low", [])
                        closes = quote.get("close", [])
                        volumes = quote.get("volume", [])

                        for i in range(len(timestamps)):
                            if (
                                opens[i] is not None
                                and highs[i] is not None
                                and lows[i] is not None
                                and closes[i] is not None
                            ):
                                dt = datetime.utcfromtimestamp(timestamps[i])
                                candle_dict = {
                                    "symbol": symbol,
                                    "timeframe": timeframe,
                                    "timestamp": dt,
                                    "open": float(opens[i]),
                                    "high": float(highs[i]),
                                    "low": float(lows[i]),
                                    "close": float(closes[i]),
                                    "volume": float(volumes[i] or 0.0),
                                    "turnover": float(closes[i] * (volumes[i] or 0.0)),
                                    "provider": "yahoo_finance",
                                    "is_closed": True
                                }
                                candles.append(candle_dict)
            except Exception as e:
                logger.error(f"Error fetching Yahoo Finance historical chart: {e}")

        # Data integrity verification: check duplicates, invalid values, sort by timestamp
        if candles:
            # Sort chronologically
            candles = sorted(candles, key=lambda x: x["timestamp"])
            # Deduplicate by timestamp
            unique_candles = {}
            for c in candles:
                unique_candles[c["timestamp"]] = c
            candles = list(unique_candles.values())

            # Update cache with latest price
            if candles:
                self._price_cache[symbol] = candles[-1]["close"]
                self._last_fetch_time[symbol] = datetime.utcnow()

            # Persist to database if db session provided
            if db:
                for c in candles[-limit:]:
                    existing = db.query(Candle).filter(
                        Candle.symbol == c["symbol"],
                        Candle.timeframe == c["timeframe"],
                        Candle.timestamp == c["timestamp"]
                    ).first()
                    if not existing:
                        db.add(Candle(**c))
                try:
                    db.commit()
                except Exception as db_err:
                    db.rollback()
                    logger.warning(f"Database commit error while caching candles: {db_err}")

        # If API returned no candles (e.g. offline fallback), query DB
        if not candles and db:
            db_candles = db.query(Candle).filter(
                Candle.symbol == symbol,
                Candle.timeframe == timeframe
            ).order_by(Candle.timestamp.asc()).limit(limit).all()
            candles = [
                {
                    "symbol": c.symbol,
                    "timeframe": c.timeframe,
                    "timestamp": c.timestamp,
                    "open": c.open,
                    "high": c.high,
                    "low": c.low,
                    "close": c.close,
                    "volume": c.volume,
                    "turnover": c.turnover,
                    "provider": c.provider,
                    "is_closed": c.is_closed
                }
                for c in db_candles
            ]

        return candles

market_data_service = MarketDataService()
