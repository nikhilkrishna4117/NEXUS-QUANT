from fastapi import APIRouter, Depends, HTTPException, Body
# pyrefly: ignore[missing-import]
from sqlalchemy.orm import Session  # type: ignore
from typing import Dict, Any, List
from pydantic import BaseModel

from backend.database import get_db
from backend.models.assistant import ChatMessage
from backend.services.ai_assistant_service import ai_assistant_service
from backend.config import save_gemini_api_key

router = APIRouter(prefix="/assistant", tags=["AI Quantitative Assistant"])

class ChatRequest(BaseModel):
    message: str

class GeminiConfigRequest(BaseModel):
    gemini_api_key: str

@router.get("/config")
async def get_assistant_config():
    """Returns the current connection status of FloAI and Gemini LLM integration."""
    return ai_assistant_service.get_assistant_config()

@router.post("/config")
async def update_assistant_config(payload: GeminiConfigRequest):
    """
    Validates and updates the Gemini API key.
    Tests live connection with Google Generative Language API and persists to .env.
    """
    key = payload.gemini_api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="Gemini API Key cannot be empty.")
    
    is_valid, msg = await ai_assistant_service.validate_gemini_key(key)
    if not is_valid:
        raise HTTPException(status_code=400, detail=msg)
    
    save_gemini_api_key(key)
    return {
        "status": "connected",
        "message": msg,
        "masked_key": f"{key[:6]}••••••••{key[-4:]}",
        "connected": True
    }

@router.post("/chat")
async def chat_with_assistant(payload: ChatRequest, db: Session = Depends(get_db)):
    """
    Interact with the AI Quantitative Financial Analyst Assistant.
    Synthesizes real-time market data, backtest metrics, and risk engine states.
    """
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    response = await ai_assistant_service.process_chat(payload.message, db)
    return response

@router.get("/history")
async def get_chat_history(db: Session = Depends(get_db)):
    """Retrieve chat history."""
    messages = db.query(ChatMessage).order_by(ChatMessage.timestamp.asc()).limit(50).all()
    return [
        {
            "id": m.id,
            "sender": m.sender,
            "content": m.content,
            "timestamp": m.timestamp.isoformat()
        }
        for m in messages
    ]
