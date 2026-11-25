'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  provider?: string;
}

export default function FreeLlmAssistant() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Connected to Free LLM API. Ask me about AI OMR grading, student assessments, bus route planning, safety policies, incident drafts, or fee notifications.',
    },
  ]);

  const fetchStatus = async () => {
    try {
      const res = await apiClient('/ai/status');
      setStatus(res.data);
    } catch {
      // ignore if offline
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setPrompt('');
    setLoading(true);

    try {
      const res = await apiClient('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: trimmed,
          messages: nextMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = res.data;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data?.reply || 'No reply received.',
          usage: data?.usage,
          provider: data?.provider,
        },
      ]);
      fetchStatus();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open ? (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[500px]">
          <div className="bg-sky-900 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <h4 className="font-bold text-xs">SSC Free LLM Assistant</h4>
              </div>
              <p className="text-[10px] text-sky-200 mt-0.5 font-mono">
                {status?.provider || 'freellmapi'} {status?.model ? `(${status.model})` : ''} • Tokens: {status?.usage?.totalTokens ?? 0}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-sky-200 hover:text-white text-sm font-bold px-1.5"
            >
              ✕
            </button>
          </div>

          <div className="p-3 overflow-y-auto flex-1 space-y-2.5 bg-slate-50 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl max-w-[90%] ${
                  m.role === 'user'
                    ? 'ml-auto bg-sky-600 text-white'
                    : 'mr-auto bg-white border border-slate-200 text-slate-800'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.usage && (
                  <div className="mt-1.5 pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                    {m.provider} • +{m.usage.totalTokens} tokens
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-auto bg-white border border-slate-200 text-slate-500 p-2.5 rounded-xl text-xs">
                Thinking via Free LLM API...
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="p-2.5 bg-white border-t border-slate-200 flex space-x-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask AI about routes, safety, notices..."
              className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-xs font-semibold"
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-sky-900 hover:bg-sky-800 text-white px-4 py-2.5 rounded-full shadow-lg border border-sky-700 flex items-center space-x-2 text-xs font-semibold transition"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Free LLM AI ({status?.usage?.totalTokens ?? 0} tok)</span>
        </button>
      )}
    </div>
  );
}
