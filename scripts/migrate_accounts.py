import sys
import os
sys.path.insert(0, os.path.abspath("."))
from backend.database import engine
import sqlalchemy

conn = engine.connect()
inspector = sqlalchemy.inspect(engine)
cols = [c['name'] for c in inspector.get_columns('paper_accounts')]
print("Initial columns:", cols)

if 'name' not in cols:
    conn.execute(sqlalchemy.text("ALTER TABLE paper_accounts ADD COLUMN name VARCHAR(64) DEFAULT 'Master Trading Account'"))
    print("Added 'name' column")

if 'account_type' not in cols:
    conn.execute(sqlalchemy.text("ALTER TABLE paper_accounts ADD COLUMN account_type VARCHAR(32) DEFAULT 'STANDARD'"))
    print("Added 'account_type' column")

conn.commit()
updated_cols = [c['name'] for c in sqlalchemy.inspect(engine).get_columns('paper_accounts')]
print("Updated columns:", updated_cols)
conn.close()
