import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  ShieldAlert,
  TrendingUp,
  BrainCircuit,
  HelpCircle,
} from 'lucide-react';
import { api } from '../services/api';
import { ChatMessage } from '../types';

export const AIAssistantPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const SUGGESTED_PROMPTS = [
    'What is happening in the BTC market right now?',
    'What are the major risks in my portfolio?',
    'Explain the EMA Dual Crossover backtest results',
    'Why was my trade rejected by the risk engine?',
  ];

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const loadChatHistory = async () => {
    try {
      const history = await api.getChatHistory();
      if (history.length > 0) {
        setMessages(history);
      } else {
        // Default welcoming message
        setMessages([
          {
            sender: 'assistant',
            content:
              "### ⚡ Welcome to Nexus Quant AI Assistant\n\nI am your automated quantitative trading and investment research assistant. I have live access to your **real market feeds**, **portfolio risk state**, **backtesting results**, and **paper execution logs**.\n\nSelect a prompt below or ask me any question regarding market structure, backtests, or risk audits!",
          },
        ]);
      }
    } catch (err) {
      console.error('Error loading chat history:', err);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { sender: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.sendChatMessage(text);
      setMessages((prev) => [
        ...prev,
        { sender: 'assistant', content: res.content, timestamp: new Date().toISOString() },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          content: `⚠️ Failed to query assistant: ${err.message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format markdown-like text with clear badges
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1 text-xs leading-relaxed font-sans">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-extrabold text-sm text-white pt-1">
                {line.replace('### ', '')}
              </h4>
            );
          }
          if (line.includes('[Verified Data]')) {
            return (
              <span key={idx} className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950 text-blue-400 border border-blue-800 my-1">
                {line}
              </span>
            );
          }
          if (line.includes('[Computed Statistics]')) {
            return (
              <span key={idx} className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-950 text-purple-400 border border-purple-800 my-1">
                {line}
              </span>
            );
          }
          if (line.includes('[Quantitative Synthesis]') || line.includes('[Risk Recommendation]')) {
            return (
              <span key={idx} className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800 my-1">
                {line}
              </span>
            );
          }
          if (line.startsWith('- ')) {
            return (
              <p key={idx} className="pl-3 text-slate-300">
                <span className="text-blue-400 font-bold">• </span>
                {line.substring(2)}
              </p>
            );
          }
          return (
            <p key={idx} className="text-slate-300">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="p-6 flex flex-col h-[calc(100vh-3.5rem)] max-w-5xl mx-auto space-y-4">
      {/* Top Header */}
      <div className="bg-[#0c1017] border border-slate-800/80 rounded-xl p-4 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center shadow-lg text-white">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>Quantitative AI Research Analyst</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">
                Online
              </span>
            </h2>
            <p className="text-[11px] text-slate-500">Connected to live exchange feeds, backtest engine, &amp; risk logs</p>
          </div>
        </div>

        <div className="text-right text-[11px] font-mono text-slate-400 hidden sm:block">
          <span className="text-emerald-400 font-bold">Zero Fabrication Guard</span> • Verified Sources
        </div>
      </div>

      {/* Suggested Prompts Ribbon */}
      <div className="flex flex-wrap items-center gap-2">
        {SUGGESTED_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 text-[11px] font-medium transition shadow-sm"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Body */}
      <div className="flex-1 bg-[#0c1017] border border-slate-800/80 rounded-xl p-5 shadow-xl overflow-y-auto space-y-4">
        {messages.map((m, idx) => {
          const isUser = m.sender === 'user';
          return (
            <div key={idx} className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isUser ? 'bg-blue-600 text-white' : 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-2xl p-4 rounded-2xl shadow-md ${
                  isUser
                    ? 'bg-blue-600 text-white font-medium text-xs rounded-tr-none'
                    : 'bg-slate-900/80 border border-slate-800 rounded-tl-none'
                }`}
              >
                {isUser ? <p className="text-xs">{m.content}</p> : renderMessageContent(m.content)}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="w-7 h-7 rounded-lg bg-purple-900/60 flex items-center justify-center text-purple-300">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-2xl rounded-tl-none flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span>Analyzing live quant data and backtests...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex items-center gap-2 bg-[#0c1017] border border-slate-800/80 p-2 rounded-xl shadow-xl"
      >
        <input
          type="text"
          placeholder="Ask anything about current market conditions, strategies, backtests, or risk..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-transparent px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
