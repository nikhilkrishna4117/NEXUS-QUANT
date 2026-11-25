import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.database import engine, Base, SessionLocal
from backend.services.market_data_service import market_data_service
from backend.services.strategy_engine import strategy_engine
from backend.services.investment_research_service import investment_research_service
from backend.services.risk_engine import risk_engine
from backend.services.paper_trading_service import paper_trading_service
from backend.services.forex_factory_service import forex_factory_service

from backend.routers.market_data import router as market_router
from backend.routers.analysis import router as analysis_router
from backend.routers.strategies import router as strategy_router
from backend.routers.backtest import router as backtest_router
from backend.routers.trading import router as trading_router
from backend.routers.risk import router as risk_router
from backend.routers.research import router as research_router
from backend.routers.assistant import router as assistant_router
from backend.routers.system import router as system_router
from backend.routers.news import router as news_router
from backend.routers.journal import router as journal_router
from backend.routers.trade_plan import router as trade_plan_router
from backend.routers.security import router as security_router
from backend.routers.algo import router as algo_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("nexus_quant")

# Active WebSocket connections
connected_websockets = set()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database Tables
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    # Seed initial data
    db = SessionLocal()
    try:
        logger.info("Seeding verified instruments and provider status...")
        await market_data_service.initialize_instruments(db)
        logger.info("Seeding baseline quantitative strategies...")
        strategy_engine.initialize_strategies(db)
        logger.info("Seeding investment research dossiers...")
        investment_research_service.initialize_research_data(db)
        logger.info("Initializing risk configuration...")
        risk_engine.get_or_create_config(db)
        logger.info("Initializing paper trading account...")
        paper_trading_service.get_or_create_account(db)
        logger.info("Pre-fetching Forex Factory live economic calendar...")
        forex_factory_service.fetch_live_calendar()
    except Exception as e:
        logger.error(f"Error during startup initialization: {e}")
    finally:
        db.close()

    # Launch background market price streamer
    stream_task = asyncio.create_task(broadcast_market_ticks())

    yield

    # Shutdown
    stream_task.cancel()
    logger.info("Nexus Quant Engine shutdown complete.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="2.0.0",
    description="Institutional Discipline-First & Autonomous Algorithmic Trading Workstation",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
api_v1 = settings.API_V1_STR
app.include_router(market_router, prefix=api_v1)
app.include_router(analysis_router, prefix=api_v1)
app.include_router(strategy_router, prefix=api_v1)
app.include_router(backtest_router, prefix=api_v1)
app.include_router(trading_router, prefix=api_v1)
app.include_router(risk_router, prefix=api_v1)
app.include_router(research_router, prefix=api_v1)
app.include_router(assistant_router, prefix=api_v1)
app.include_router(system_router, prefix=api_v1)
app.include_router(news_router, prefix=api_v1)
app.include_router(journal_router, prefix=api_v1)
app.include_router(trade_plan_router, prefix=api_v1)
app.include_router(security_router, prefix=api_v1)
app.include_router(algo_router, prefix=api_v1)

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.add(websocket)
    try:
        while True:
            # Keep connection alive & listen for client ping
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)
    except Exception:
        if websocket in connected_websockets:
            connected_websockets.remove(websocket)

async def broadcast_market_ticks():
    """
    Sub-second real-time streamer:
    - Multi-asset market ticks (Crypto, Forex, Metals)
    - 5-Hour Forex Factory pre-news countdowns
    - Guardrail lock states & emergency kill switch status
    """
    symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "EURUSD", "GBPUSD", "XAUUSD"]
    counter = 0

    while True:
        try:
            await asyncio.sleep(1.0)
            counter += 1

            if connected_websockets:
                # 1. Broadcast Market Ticks
                for sym in symbols:
                    try:
                        price = await market_data_service.get_latest_price(sym)
                        msg = {
                            "type": "TICK",
                            "symbol": sym,
                            "price": price,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        dead_sockets = set()
                        for ws in list(connected_websockets):
                            try:
                                await ws.send_json(msg)
                            except Exception:
                                dead_sockets.add(ws)
                        connected_websockets.difference_update(dead_sockets)
                    except Exception:
                        pass

                # 2. Every 5 seconds: Broadcast 5-Hour News Countdown & Guardrail Telemetry
                if counter % 5 == 0:
                    try:
                        triggers = forex_factory_service.get_five_hour_pre_triggers()
                        news_msg = {
                            "type": "NEWS_TELEMETRY",
                            "active_5h_triggers": triggers,
                            "is_lockout_active": any(t.get("is_lockout_recommended", False) for t in triggers),
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }
                        for ws in list(connected_websockets):
                            try:
                                await ws.send_json(news_msg)
                            except Exception:
                                pass
                    except Exception:
                        pass

        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Error in broadcast_market_ticks: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
