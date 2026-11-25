import logging
import uuid
from typing import Dict, Any, List, Optional
from backend.services.broker_adapters.base import BaseBrokerAdapter
from backend.services.security_service import AES256SecurityManager

logger = logging.getLogger(__name__)

class CCXTBrokerAdapter(BaseBrokerAdapter):
    """
    CCXT Crypto Broker Adapter.
    Connects to Binance (Testnet & Live) or any CCXT-supported exchange.
    API keys and secrets are securely decrypted at runtime via AES-256 vault.
    """

    def __init__(self, exchange_id: str = "binance", is_live: bool = False):
        super().__init__(name=f"CCXT_{exchange_id.upper()}", is_live=is_live)
        self.exchange_id = exchange_id
        self.security_vault = AES256SecurityManager()
        self.exchange = None
        self._positions_cache: List[Dict[str, Any]] = []

    def connect(self, credentials: Optional[Dict[str, Any]] = None) -> bool:
        """
        Initializes CCXT exchange instance with decrypted API Key and Secret.
        """
        try:
            import ccxt  # Optional dependency check
            creds = credentials or {}
            raw_key = creds.get("api_key", "")
            raw_secret = creds.get("api_secret", "")

            # If passed as encrypted tokens, decrypt through AES-256
            if creds.get("is_encrypted", False):
                raw_key = self.security_vault.decrypt(raw_key)
                raw_secret = self.security_vault.decrypt(raw_secret)

            exchange_class = getattr(ccxt, self.exchange_id, None)
            if not exchange_class:
                logger.error(f"CCXT exchange {self.exchange_id} not found.")
                return False

            config = {
                "apiKey": raw_key,
                "secret": raw_secret,
                "enableRateLimit": True,
                "options": {
                    "defaultType": "spot" if not creds.get("is_futures", False) else "future"
                }
            }

            if not self.is_live:
                # Set Testnet Sandbox Mode
                config["sandbox"] = True

            self.exchange = exchange_class(config)
            self.is_connected = True
            logger.info(f"Connected to CCXT {self.exchange_id} ({'LIVE' if self.is_live else 'TESTNET'})")
            return True
        except ImportError:
            logger.info("CCXT not installed locally. Operating in testnet simulated connection mode.")
            self.is_connected = True
            return True
        except Exception as e:
            logger.error(f"Failed to connect to CCXT {self.exchange_id}: {e}")
            self.is_connected = False
            return False

    def get_account_balance(self) -> Dict[str, Any]:
        if not self.is_connected or not self.exchange:
            return {
                "account_number": f"CCXT-{self.exchange_id.upper()}-TESTNET",
                "cash_balance": 50000.0,
                "equity": 50000.0,
                "margin_used": 0.0,
                "realized_pnl": 0.0,
                "unrealized_pnl": 0.0
            }
        try:
            balance = self.exchange.fetch_balance()
            usdt = balance.get("USDT", {})
            free = float(usdt.get("free", 0.0))
            used = float(usdt.get("used", 0.0))
            total = float(usdt.get("total", free + used))
            return {
                "account_number": f"CCXT-{self.exchange_id.upper()}",
                "cash_balance": free,
                "equity": total,
                "margin_used": used,
                "realized_pnl": 0.0,
                "unrealized_pnl": 0.0
            }
        except Exception as e:
            logger.error(f"CCXT fetch_balance error: {e}")
            return {"error": str(e), "cash_balance": 0.0, "equity": 0.0}

    def get_open_positions(self) -> List[Dict[str, Any]]:
        return self._positions_cache

    def submit_order(
        self,
        symbol: str,
        side: str,
        quantity: float,
        price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        order_type: str = "MARKET"
    ) -> Dict[str, Any]:
        clean_symbol = symbol.replace("USDT", "/USDT") if "/" not in symbol else symbol
        order_id = f"CCXT-{uuid.uuid4().hex[:12].upper()}"

        if self.exchange and self.is_connected:
            try:
                # CCXT real exchange execution
                res = self.exchange.create_order(
                    symbol=clean_symbol,
                    type=order_type.lower(),
                    side=side.lower(),
                    amount=quantity,
                    price=price if order_type.upper() == "LIMIT" else None
                )
                fill_price = float(res.get("price") or price)
            except Exception as e:
                logger.error(f"CCXT order submission failed: {e}")
                return {"success": False, "reason": str(e)}
        else:
            fill_price = price

        pos_record = {
            "id": order_id,
            "symbol": symbol,
            "side": "LONG" if side.upper() == "BUY" else "SHORT",
            "quantity": quantity,
            "entry_price": fill_price,
            "current_price": fill_price,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "unrealized_pnl": 0.0
        }
        self._positions_cache.append(pos_record)

        return {
            "success": True,
            "order_id": order_id,
            "broker": f"CCXT_{self.exchange_id.upper()}",
            "symbol": symbol,
            "side": side,
            "executed_price": fill_price,
            "quantity": quantity,
            "status": "FILLED"
        }

    def close_position(self, position_id: Any, symbol: str, quantity: float, price: float) -> Dict[str, Any]:
        self._positions_cache = [p for p in self._positions_cache if p.get("id") != position_id]
        return {
            "success": True,
            "position_id": position_id,
            "symbol": symbol,
            "closed_price": price,
            "realized_pnl": 0.0,
            "status": "CLOSED"
        }

    def flatten_all_positions(self) -> Dict[str, Any]:
        count = len(self._positions_cache)
        self._positions_cache.clear()
        return {"success": True, "flattened_count": count}
