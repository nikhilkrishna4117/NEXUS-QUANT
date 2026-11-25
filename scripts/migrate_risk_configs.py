import sys
import os
sys.path.insert(0, os.path.abspath("."))
from backend.database import engine
import sqlalchemy

conn = engine.connect()
inspector = sqlalchemy.inspect(engine)
cols = [c['name'] for c in inspector.get_columns('risk_configs')]
print("Initial risk_configs columns:", cols)

new_cols = [
    ("max_daily_loss_usd", "FLOAT DEFAULT 1500.0"),
    ("max_daily_profit_cap_usd", "FLOAT DEFAULT 5000.0"),
    ("max_trades_per_day", "INTEGER DEFAULT 5"),
    ("allowed_session_windows", "JSON"),
    ("news_lockout_buffer_minutes", "INTEGER DEFAULT 15"),
    ("is_locked", "BOOLEAN DEFAULT 0"),
    ("lock_reason", "VARCHAR(255)"),
    ("emergency_kill_active", "BOOLEAN DEFAULT 0"),
    ("current_daily_loss_usd", "FLOAT DEFAULT 0.0"),
    ("current_daily_profit_usd", "FLOAT DEFAULT 0.0"),
    ("trades_executed_today", "INTEGER DEFAULT 0"),
]

for col_name, col_def in new_cols:
    if col_name not in cols:
        conn.execute(sqlalchemy.text(f"ALTER TABLE risk_configs ADD COLUMN {col_name} {col_def}"))
        print(f"Added column: {col_name}")

conn.commit()
updated = [c['name'] for c in sqlalchemy.inspect(engine).get_columns('risk_configs')]
print("Updated risk_configs columns:", updated)
conn.close()
