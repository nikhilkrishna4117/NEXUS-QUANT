from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, JSON
from backend.database import Base

class ResearchReport(Base):
    __tablename__ = "research_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(32), index=True, nullable=False)
    name = Column(String(100), nullable=False)
    asset_class = Column(String(32), nullable=False)
    headline = Column(String(255), nullable=False)
    investment_thesis = Column(Text, nullable=False)
    fundamental_metrics = Column(JSON, nullable=True)  # Market cap, P/E, volume, TVL, supply, etc.
    technical_bias = Column(String(20), default="Neutral")  # Bullish, Bearish, Neutral
    bull_case = Column(Text, nullable=False)
    bear_case = Column(Text, nullable=False)
    key_catalysts = Column(JSON, nullable=True)
    major_risks = Column(JSON, nullable=True)
    sources = Column(JSON, nullable=True)  # List of URLs, publication dates, and organizations
    confidence_score = Column(Float, default=0.75)
    time_horizon = Column(String(50), default="Medium-term (3-6 months)")
    created_at = Column(DateTime, default=datetime.utcnow)

class WatchlistItem(Base):
    __tablename__ = "watchlists"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(32), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    asset_class = Column(String(32), nullable=False)
    target_entry_price = Column(Float, nullable=True)
    target_exit_price = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    is_favorite = Column(Boolean, default=True)
    added_at = Column(DateTime, default=datetime.utcnow)
