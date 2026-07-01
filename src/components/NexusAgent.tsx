"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
    Sparkles, 
    X, 
    Send, 
    Bot, 
    User, 
    AlertTriangle, 
    Calendar, 
    Laptop, 
    Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Message {
    sender: 'user' | 'agent';
    text: string;
    timestamp: Date;
}

export default function NexusAgent() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            sender: 'agent',
            text: 'ආයුබෝවන්! මම Nexus Agent. SLTS Nexus ERP පද්ධතියට අදාළ ඕනෑම තොරතුරක් (Low Stock, Expiry Dates, Asset Custody, Wastage) මා හරහා විමසිය හැක.',
            timestamp: new Date()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async (textToSend: string) => {
        if (!textToSend.trim() || isLoading) return;

        const userMsg = textToSend.trim();
        setInput('');
        setMessages(prev => [...prev, { sender: 'user', text: userMsg, timestamp: new Date() }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/ai/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg })
            });

            if (!response.ok) throw new Error('API Error');

            const json = await response.json();
            setMessages(prev => [...prev, { 
                sender: 'agent', 
                text: json.response || 'සමාවන්න, ප්‍රතිචාරයක් ලබා ගැනීමට නොහැකි විය.', 
                timestamp: new Date() 
            }]);
        } catch (err) {
            setMessages(prev => [...prev, { 
                sender: 'agent', 
                text: 'සමාවන්න, සේවා සම්බන්ධතාවයේ බිඳ වැටීමක් සිදු විය. නැවත උත්සාහ කරන්න.', 
                timestamp: new Date() 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 font-sans">
            {/* FLOATING ACTION BUTTON */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group"
                    title="Ask Nexus Agent"
                >
                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-sky-500"></span>
                    </span>
                </button>
            )}

            {/* CHAT DRAWER */}
            {isOpen && (
                <div 
                    className="w-[350px] md:w-[400px] h-[550px] bg-[#1E293B] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform scale-100"
                    style={{
                        boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)'
                    }}
                >
                    {/* Header */}
                    <div className="bg-[#0F172A] border-b border-slate-700/50 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-sky-600/10 flex items-center justify-center text-sky-400 border border-sky-500/20">
                                <Bot className="w-4.5 h-4.5" />
                            </div>
                            <div>
                                <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                                    Nexus Agent
                                    <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[8px] h-3.5 font-bold px-1.5 py-0">AI Copilot</Badge>
                                </h3>
                                <p className="text-[10px] text-slate-500">Active & Context Aware</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-[#0F172A]/40">
                        {messages.map((msg, index) => (
                            <div 
                                key={index} 
                                className={`flex gap-2 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                            >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs border ${
                                    msg.sender === 'user' 
                                        ? 'bg-slate-700 border-slate-600 text-slate-200' 
                                        : 'bg-sky-950 border-sky-800/40 text-sky-400'
                                }`}>
                                    {msg.sender === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                                </div>
                                <div className={`p-3 rounded-2xl text-[11px] leading-relaxed shadow-sm whitespace-pre-line ${
                                    msg.sender === 'user'
                                        ? 'bg-sky-600 text-white rounded-tr-none'
                                        : 'bg-[#1E293B] border border-slate-700/50 text-slate-200 rounded-tl-none'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-2 max-w-[80%]">
                                <div className="w-7 h-7 rounded-full bg-sky-950 border border-sky-800/40 flex items-center justify-center text-sky-400">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                </div>
                                <div className="p-3 bg-[#1E293B] border border-slate-700/50 text-slate-400 rounded-2xl rounded-tl-none text-[11px]">
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestions Box */}
                    <div className="px-4 py-2 border-t border-slate-700/30 flex gap-2 overflow-x-auto no-scrollbar bg-[#0F172A]/10">
                        <button 
                            onClick={() => handleSendMessage("Low stock items monawada?")}
                            className="bg-[#1E293B] hover:bg-slate-800 border border-slate-700/50 text-[10px] text-slate-300 font-sans px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 cursor-pointer"
                        >
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            Low Stock
                        </button>
                        <button 
                            onClick={() => handleSendMessage("Expiring batches thiyeda?")}
                            className="bg-[#1E293B] hover:bg-slate-800 border border-slate-700/50 text-[10px] text-slate-300 font-sans px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 cursor-pointer"
                        >
                            <Calendar className="w-3 h-3 text-rose-500" />
                            Expiry Warnings
                        </button>
                        <button 
                            onClick={() => handleSendMessage("Laptops assign wela thiyenne kataද?")}
                            className="bg-[#1E293B] hover:bg-slate-800 border border-slate-700/50 text-[10px] text-slate-300 font-sans px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 cursor-pointer"
                        >
                            <Laptop className="w-3 h-3 text-sky-400" />
                            Asset Custody
                        </button>
                    </div>

                    {/* Footer Input */}
                    <div className="p-3 bg-[#0F172A] border-t border-slate-700/50 flex gap-2">
                        <input
                            type="text"
                            placeholder="Type query in Sinhala/English..."
                            className="flex-1 bg-[#1E293B] border border-slate-700/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none placeholder-slate-500 focus:ring-1 focus:ring-sky-500"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') handleSendMessage(input);
                            }}
                        />
                        <button
                            onClick={() => handleSendMessage(input)}
                            disabled={isLoading}
                            className="h-8 w-8 bg-sky-600 hover:bg-sky-700 rounded-lg flex items-center justify-center text-white disabled:opacity-50 cursor-pointer"
                        >
                            <Send className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
