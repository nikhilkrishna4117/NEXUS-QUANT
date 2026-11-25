from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from backend.database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String(10), nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    context_data = Column(JSON, nullable=True)  # Snapshot of market, backtest, or risk data referenced
    timestamp = Column(DateTime, default=datetime.utcnow)
