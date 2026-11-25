import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Load environment variables from .env file
load_dotenv(BASE_DIR / ".env", override=True)

class Settings:
    PROJECT_NAME: str = "Nexus Quant Engine"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        f"sqlite:///{DATA_DIR / 'quant_platform.db'}"
    )
    
    # Market Data Providers
    BINANCE_BASE_URL: str = os.getenv("BINANCE_BASE_URL", "https://api.binance.com")
    BINANCE_BACKUP_URL: str = os.getenv("BINANCE_BACKUP_URL", "https://data-api.binance.vision")
    COINBASE_BASE_URL: str = os.getenv("COINBASE_BASE_URL", "https://api.exchange.coinbase.com")
    YAHOO_FINANCE_BASE_URL: str = os.getenv("YAHOO_FINANCE_BASE_URL", "https://query1.finance.yahoo.com/v8/finance/chart")
    
    # AI Engine
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # Default Risk Controls
    DEFAULT_INITIAL_CAPITAL: float = 100000.0  # $100,000 default paper trading capital
    DEFAULT_MAX_RISK_PER_TRADE_PCT: float = 2.0  # 2% max portfolio risk per trade
    DEFAULT_MAX_PORTFOLIO_DRAWDOWN_PCT: float = 15.0  # 15% max drawdown circuit breaker
    DEFAULT_MAX_DAILY_LOSS_PCT: float = 5.0  # 5% max daily loss kill switch
    DEFAULT_MAX_OPEN_POSITIONS: int = 5
    DEFAULT_MAX_LEVERAGE: float = 1.0  # 1x default (spot/unleveraged)
    
    # Execution Assumptions
    DEFAULT_MAKER_FEE_BPS: float = 2.0   # 0.02%
    DEFAULT_TAKER_FEE_BPS: float = 4.0   # 0.04%
    DEFAULT_SLIPPAGE_BPS: float = 5.0    # 0.05%
    
    # Live Trading Safeguard (MUST be false by default)
    LIVE_TRADING_ENABLED: bool = False

settings = Settings()

def save_gemini_api_key(key: str) -> None:
    """Save Gemini API key to in-memory settings and persist to .env file."""
    clean_key = key.strip()
    settings.GEMINI_API_KEY = clean_key
    os.environ["GEMINI_API_KEY"] = clean_key
    env_file = BASE_DIR / ".env"
    
    lines = []
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
    written = False
    new_lines = []
    for line in lines:
        if line.strip().startswith("GEMINI_API_KEY="):
            new_lines.append(f"GEMINI_API_KEY={clean_key}\n")
            written = True
        else:
            new_lines.append(line)
    if not written:
        new_lines.append(f"GEMINI_API_KEY={clean_key}\n")
        
    with open(env_file, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

