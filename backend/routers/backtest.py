from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional, List
from pydantic import BaseModel

from backend.database import get_db
from backend.models.strategy import Strategy
from backend.models.backtest import BacktestRun
from backend.services.market_data_service import market_data_service
from backend.services.backtesting_engine import backtesting_engine
from backend.services.backtesting_studio import backtesting_studio

router = APIRouter(prefix="/backtest", tags=["Backtesting Studio"])

class BacktestRunRequest(BaseModel):
    strategy_id: Optional[int] = None
    strategy_name: Optional[str] = "Baseline EMA Trend Follower"
    symbol: str = "BTCUSDT"
    timeframe: str = "1h"
    limit_bars: int = 400
    initial_capital: float = 100000.0
    risk_per_trade_pct: float = 2.0
    fee_rate_bps: float = 4.0
    slippage_bps: float = 5.0
    custom_config: Optional[Dict[str, Any]] = None

class CustomBacktestRequest(BaseModel):
    strategy_name: str = "Custom Quant Model"
    strategy_format: str = "python"  # "python" | "pine" | "english" | "config"
    strategy_code: str = ""
    symbol: str = "BTCUSDT"
    timeframe: str = "1h"
    limit_bars: int = 500
    initial_capital: float = 100000.0
    risk_per_trade_pct: float = 1.0
    spread_pips: float = 1.0
    commission_per_lot: float = 5.0
    slippage_bps: float = 3.0
    leverage: float = 50.0
    target_rr: float = 10.0
    stop_loss_atr_mult: float = 1.5

class DeployToAlgoRequest(BaseModel):
    strategy_name: str
    strategy_format: str
    strategy_code: str
    symbol: str = "BTCUSDT"
    target_rr: float = 10.0
    risk_per_trade_pct: float = 1.0

@router.get("/presets")
async def get_strategy_presets():
    """Returns pre-loaded institutional strategy presets in Python, Pine Script, and Plain-English."""
    return {
        "python": [
            {
                "id": "py_smc_orderblock",
                "name": "SMC Order Block & Liquidity Sweep (Python)",
                "description": "Scans for lower lows followed by strong displacement breaking structure. 1:15 R:R target.",
                "code": (
                    "def generate_signals(df):\n"
                    "    # Institutional EMA & Displacement Confluence\n"
                    "    close = df['close'].values\n"
                    "    high = df['high'].values\n"
                    "    low = df['low'].values\n"
                    "    n = len(df)\n"
                    "    signals = np.zeros(n)\n"
                    "    ema50 = pd.Series(close).ewm(span=50, adjust=False).mean().values\n"
                    "    ema200 = pd.Series(close).ewm(span=200, adjust=False).mean().values\n"
                    "    for i in range(20, n):\n"
                    "        # Long: Above 200 EMA with breakout of previous 10-bar high\n"
                    "        recent_high = np.max(high[i-10:i])\n"
                    "        if close[i] > recent_high and close[i] > ema200[i] and ema50[i] > ema200[i]:\n"
                    "            signals[i] = 1.0\n"
                    "        elif close[i] < ema50[i]:\n"
                    "            signals[i] = -1.0\n"
                    "    return signals\n"
                )
            },
            {
                "id": "py_mean_reversion_vol",
                "name": "Volatility Band Mean Reversion (Python)",
                "description": "Buys oversold RSI when trading below lower 2-sigma Bollinger Band in high ATR regime.",
                "code": (
                    "def generate_signals(df):\n"
                    "    close = df['close'].values\n"
                    "    n = len(df)\n"
                    "    signals = np.zeros(n)\n"
                    "    sma20 = pd.Series(close).rolling(20, min_periods=1).mean().values\n"
                    "    std20 = pd.Series(close).rolling(20, min_periods=1).std().values\n"
                    "    lower_bb = sma20 - (2.0 * std20)\n"
                    "    delta = pd.Series(close).diff()\n"
                    "    gain = delta.clip(lower=0).ewm(alpha=1/14, adjust=False).mean()\n"
                    "    loss = (-delta.clip(upper=0)).ewm(alpha=1/14, adjust=False).mean()\n"
                    "    rsi = (100 - (100 / (1 + (gain / (loss + 1e-10))))).values\n"
                    "    for i in range(1, n):\n"
                    "        if close[i] < lower_bb[i] and rsi[i] < 30:\n"
                    "            signals[i] = 1.0\n"
                    "        elif close[i] > sma20[i]:\n"
                    "            signals[i] = -1.0\n"
                    "    return signals\n"
                )
            }
        ],
        "pine": [
            {
                "id": "pine_silver_bullet",
                "name": "ICT Silver Bullet & EMA Ribbon (Pine Script v5)",
                "description": "Fast 9/21 EMA institutional momentum crossover with 200 EMA macro filter.",
                "code": (
                    "//@version=5\n"
                    "strategy(\"ICT Silver Bullet Ribbon\", overlay=true)\n"
                    "fast = ta.ema(close, 9)\n"
                    "slow = ta.ema(close, 21)\n"
                    "trend = ta.ema(close, 200)\n"
                    "longCondition = ta.crossover(fast, slow)\n"
                    "exitCondition = ta.crossunder(fast, slow)\n"
                    "if (longCondition)\n"
                    "    strategy.entry(\"Long\", strategy.long)\n"
                    "if (exitCondition)\n"
                    "    strategy.close(\"Long\")\n"
                )
            },
            {
                "id": "pine_rsi_breakout",
                "name": "RSI Trend Momentum Breakout (Pine Script v5)",
                "description": "Captures high velocity trends when RSI crosses above 50 and price is above 50 SMA.",
                "code": (
                    "//@version=5\n"
                    "strategy(\"RSI Trend Breakout\", overlay=true)\n"
                    "myRsi = ta.rsi(close, 14)\n"
                    "baseline = ta.sma(close, 50)\n"
                    "longCondition = ta.crossover(myRsi, 50)\n"
                    "exitCondition = myRsi > 75\n"
                    "if (longCondition)\n"
                    "    strategy.entry(\"Long\", strategy.long)\n"
                    "if (exitCondition)\n"
                    "    strategy.close(\"Long\")\n"
                )
            }
        ],
        "english": [
            {
                "id": "eng_institutional_pullback",
                "name": "Institutional Discount Pullback (Plain English)",
                "description": "Natural language rule parsing oversold RSI in macro uptrend with 1:10 RR.",
                "code": "Buy when RSI is below 35 and price is above EMA 200. Exit when RSI > 70. SL at 1.5 ATR, TP at 1:10 RR"
            },
            {
                "id": "eng_momentum_crossover",
                "name": "Trend Continuation Crossover (Plain English)",
                "description": "Natural language rule executing on fast EMA 9/21 cross with 1:20 RR.",
                "code": "Buy when EMA 9 crosses above EMA 21 and price is above EMA 50. Stop loss at 2.0 ATR, TP at 1:20 RR"
            }
        ]
    }

@router.post("/run-custom")
async def run_custom_backtest(payload: CustomBacktestRequest, db: Session = Depends(get_db)):
    """
    Executes a high-fidelity institutional backtest on custom Python, Pine Script,
    or Plain-English rules against real historical OHLCV candles.
    """
    # 1. Fetch genuine historical OHLCV data
    candles = await market_data_service.fetch_historical_candles(
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        limit=payload.limit_bars,
        db=db
    )
    if not candles or len(candles) < 30:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient historical data available for {payload.symbol} ({len(candles) if candles else 0} bars). Minimum 30 required."
        )

    # 2. Run simulation via BacktestingStudio
    try:
        report = backtesting_studio.run_simulation(
            candles=candles,
            symbol=payload.symbol,
            timeframe=payload.timeframe,
            strategy_format=payload.strategy_format,
            strategy_code=payload.strategy_code,
            custom_config={
                "target_rr": payload.target_rr,
                "stop_loss_atr_mult": payload.stop_loss_atr_mult
            },
            initial_capital=payload.initial_capital,
            risk_per_trade_pct=payload.risk_per_trade_pct,
            spread_pips=payload.spread_pips,
            commission_per_lot=payload.commission_per_lot,
            slippage_bps=payload.slippage_bps,
            leverage=payload.leverage,
            db=db
        )
        report["strategy_name"] = payload.strategy_name
        return report
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/deploy-to-algo")
async def deploy_to_algo(payload: DeployToAlgoRequest):
    """
    1-Click Promotion: Promotes a verified backtested strategy directly into the
    Autonomous Algo Engine coordinator as an active trading bot.
    """
    res = backtesting_studio.deploy_to_algo_coordinator(
        strategy_name=payload.strategy_name,
        strategy_format=payload.strategy_format,
        strategy_code=payload.strategy_code,
        symbol=payload.symbol,
        target_rr=payload.target_rr,
        risk_per_trade_pct=payload.risk_per_trade_pct
    )
    return res

@router.post("/run")
async def run_backtest(payload: BacktestRunRequest, db: Session = Depends(get_db)):
    """
    Execute standard backtest on historical OHLCV data (legacy endpoint compatibility).
    """
    candles = await market_data_service.fetch_historical_candles(
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        limit=payload.limit_bars,
        db=db
    )
    if not candles or len(candles) < 30:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient historical data available for {payload.symbol} ({len(candles) if candles else 0} bars). Minimum 30 required."
        )

    strategy_config = {}
    strategy_name = payload.strategy_name

    if payload.strategy_id:
        strat_record = db.query(Strategy).filter(Strategy.id == payload.strategy_id).first()
        if strat_record:
            strategy_config = strat_record.config
            strategy_name = strat_record.name

    if payload.custom_config:
        strategy_config = payload.custom_config

    if not strategy_config:
        strategy_config = {
            "type": "ema_crossover",
            "fast_period": 9,
            "slow_period": 21,
            "stop_loss_atr_mult": 2.0,
            "take_profit_atr_mult": 4.5
        }

    backtesting_engine.initial_capital = payload.initial_capital
    backtesting_engine.fee_rate = payload.fee_rate_bps / 10000.0
    backtesting_engine.slippage_rate = payload.slippage_bps / 10000.0
    backtesting_engine.risk_per_trade_pct = payload.risk_per_trade_pct

    report = backtesting_engine.run_backtest(
        strategy_config=strategy_config,
        candles=candles,
        symbol=payload.symbol,
        timeframe=payload.timeframe,
        strategy_name=strategy_name,
        strategy_id=payload.strategy_id,
        db=db
    )
    return report

@router.get("/history")
async def get_backtest_history(db: Session = Depends(get_db)):
    """Retrieve all previous backtest runs and performance records."""
    runs = db.query(BacktestRun).order_by(BacktestRun.created_at.desc()).limit(30).all()
    return runs

@router.get("/{run_id}")
async def get_backtest_by_id(run_id: int, db: Session = Depends(get_db)):
    """Retrieve a specific backtest tear-sheet."""
    run = db.query(BacktestRun).filter(BacktestRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Backtest run not found.")
    return run
