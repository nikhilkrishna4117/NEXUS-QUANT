from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional

class BaseBrokerAdapter(ABC):
    """
    Abstract Broker Execution Adapter interface.
    Provides uniform lifecycle management, account telemetry, order routing,
    and SL/TP bracket tracking across Paper, CCXT (Binance/Crypto), cTrader, and TradeLocker.
    """

    def __init__(self, name: str, is_live: bool = False):
        self.name = name
        self.is_live = is_live
        self.is_connected = False

    @abstractmethod
    def connect(self, credentials: Optional[Dict[str, Any]] = None) -> bool:
        """Establishes authenticated session with broker API / gateway."""
        pass

    @abstractmethod
    def get_account_balance(self) -> Dict[str, Any]:
        """Returns cash_balance, equity, margin_used, realized_pnl, unrealized_pnl."""
        pass

    @abstractmethod
    def get_open_positions(self) -> List[Dict[str, Any]]:
        """Returns active open positions with live mark-to-market prices."""
        pass

    @abstractmethod
    def submit_order(
        self,
        symbol: str,
        side: str,  # BUY / SELL
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        order_type: str = "MARKET"
    ) -> Dict[str, Any]:
        """Submits order with stop loss and take profit parameters."""
        pass

    @abstractmethod
    def close_position(self, position_id: Any, symbol: str, quantity: float, price: float) -> Dict[str, Any]:
        """Closes position at current market price."""
        pass

    @abstractmethod
    def flatten_all_positions(self) -> Dict[str, Any]:
        """Emergency circuit breaker: liquidates all open positions immediately."""
        pass
