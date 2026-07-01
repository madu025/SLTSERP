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
    Loader2,
    ArrowRight,
    CheckCircle,
    Bell,
    Trash,
    ExternalLink,
    Check,
    MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface NexusAction {
    type: 'STOCK_HEAL' | 'STOCK_TRANSFER' | 'ASSIGN_CUSTODY' | 'CREATE_USER';
    itemId?: string;
    itemCode?: string;
    itemName?: string;
    fromStoreId?: string;
    fromStoreName?: string;
    toStoreId?: string;
    toStoreName?: string;
    serialId?: string;
    serialNumber?: string;
    staffId?: string;
    staffName?: string;
    quantity?: number;
    username?: string;
    password?: string;
    role?: string;
    rtomCode?: string;
    opmcId?: string;
}

interface Message {
    sender: 'user' | 'agent';
    text: string;
    timestamp: Date;
    actions?: NexusAction[];
}

interface NexusAlert {
    id: string;
    title: string;
    message: string;
    type: string;
    priority: string;
    isRead: boolean;
    link: string | null;
    createdAt: string;
}

export default function NexusAgent() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'alerts'>('chat');
    const [messages, setMessages] = useState<Message[]>([]);
    const [alerts, setAlerts] = useState<NexusAlert[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [executingActionIdx, setExecutingActionIdx] = useState<string | null>(null);
    const [completedActions, setCompletedActions] = useState<Record<string, string>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch alerts count & alert registry
    const fetchAlerts = async () => {
        try {
            const res = await fetch('/api/ai/alerts');
            if (res.ok) {
                const data = await res.json();
                setAlerts(data);
            }
        } catch (e) {
            console.error("Failed to query alerts:", e);
        }
    };

    // Load Chat History from Database
    const fetchHistory = async () => {
        try {
            const res = await fetch('/api/ai/copilot');
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    const formatted = data.map((msg: { role: string; parts?: { text: string }[] }) => ({
                        sender: msg.role === 'user' ? 'user' : 'agent',
                        text: msg.parts?.[0]?.text || '',
                        timestamp: new Date()
                    }));
                    setMessages(formatted);
                } else {
                    setMessages([
                        {
                            sender: 'agent',
                            text: 'ආයුබෝවන්! මම Nexus AI Agent. SLTS Nexus ERP පද්ධතියට අදාළ ඕනෑම තොරතුරක් (Low Stock, Expiry Dates, Asset Custody, Invoices) මා හරහා විමසිය හැක.',
                            timestamp: new Date()
                        }
                    ]);
                }
            }
        } catch (e) {
            console.error("Failed to load chat history:", e);
        }
    };

    useEffect(() => {
        fetchAlerts();
        fetchHistory();
        
        // Poll alerts every 60 seconds
        const timer = setInterval(fetchAlerts, 60000);
        return () => clearInterval(timer);
    }, []);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, activeTab]);

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
                actions: json.actions || undefined,
                timestamp: new Date() 
            }]);
        } catch {
            setMessages(prev => [...prev, { 
                sender: 'agent', 
                text: 'සමාවන්න, සේවා සම්බන්ධතාවයේ බිඳ වැටීමක් සිදු විය. නැවත උත්සාහ කරන්න.', 
                timestamp: new Date() 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExecuteAction = async (action: NexusAction, messageIdx: number, actionIdx: number) => {
        const key = `${messageIdx}-${actionIdx}`;
        setExecutingActionIdx(key);

        try {
            const response = await fetch('/api/ai/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    execute: true,
                    action
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.message || "Failed to execute request.";
                setCompletedActions(prev => ({
                    ...prev,
                    [key]: `❌ Access Denied: ${errMsg}`
                }));
                toast.error(errMsg);
                return;
            }

            const json = await response.json();
            setCompletedActions(prev => ({
                ...prev,
                [key]: action.type === 'CREATE_USER'
                    ? `User registration complete! User "${action.username}" created successfully.`
                    : json.result?.requestNr 
                        ? `Replenishment complete! Stock request ${json.result.requestNr} generated.` 
                        : 'Custody assignment successfully updated in database.'
            }));
            fetchAlerts(); // Refresh alerts
        } catch {
            toast.error("Failed to execute request due to network error.");
        } finally {
            setExecutingActionIdx(null);
        }
    };

    const handleClearHistory = async () => {
        try {
            const res = await fetch('/api/ai/copilot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clear: true })
            });
            if (res.ok) {
                toast.success("Chat history cleared");
                setMessages([
                    {
                        sender: 'agent',
                        text: 'Chat history cleared. How can I assist you today?',
                        timestamp: new Date()
                    }
                ]);
            }
        } catch {
            toast.error("Failed to clear history");
        }
    };

    const handleDismissAlert = async (id: string) => {
        try {
            const res = await fetch('/api/ai/alerts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                setAlerts(prev => prev.filter(a => a.id !== id));
                toast.success("Alert dismissed");
            }
        } catch {
            toast.error("Failed to dismiss alert");
        }
    };

    const handleClearAllAlerts = async () => {
        try {
            const res = await fetch('/api/ai/alerts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true })
            });
            if (res.ok) {
                setAlerts([]);
                toast.success("All alerts cleared");
            }
        } catch {
            toast.error("Failed to clear alerts");
        }
    };

    const getPriorityStyle = (priority: string) => {
        switch (priority) {
            case 'CRITICAL': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'HIGH': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 font-sans">
            {/* FLOATING ACTION BUTTON */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="relative w-12 h-12 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-xl flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group border border-sky-400/20"
                    title="Ask Nexus AI Agent"
                >
                    <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    {alerts.length > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 items-center justify-center bg-red-500 text-[9px] font-bold text-white rounded-full border-2 border-slate-900 shadow-md">
                            {alerts.length}
                        </span>
                    )}
                </button>
            )}

            {/* CHAT DRAWER */}
            {isOpen && (
                <div 
                    className="w-[360px] md:w-[420px] h-[580px] bg-[#1E293B] border border-slate-700/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 transform scale-100"
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
                                    <Badge className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[8px] h-3.5 font-bold px-1.5 py-0">Autonomous AI</Badge>
                                </h3>
                                <p className="text-[10px] text-slate-500">Global ERP Control Center</p>
                            </div>
                        </div>
                        
                        {/* Tab Switch & Actions */}
                        <div className="flex items-center gap-2.5">
                            <button
                                onClick={() => setActiveTab(activeTab === 'chat' ? 'alerts' : 'chat')}
                                className={`p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors relative cursor-pointer ${activeTab === 'alerts' ? 'bg-slate-800 text-white' : ''}`}
                                title={activeTab === 'chat' ? 'Show Alerts' : 'Show Chat'}
                            >
                                {activeTab === 'chat' ? <Bell className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                                {activeTab === 'chat' && alerts.length > 0 && (
                                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
                                )}
                            </button>
                            <button
                                onClick={handleClearHistory}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                                title="Clear conversation history"
                            >
                                <Trash className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Body (Chat Tab) */}
                    {activeTab === 'chat' && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar bg-[#0F172A]/40">
                                {messages.map((msg, msgIdx) => (
                                    <div 
                                        key={msgIdx} 
                                        className={`flex flex-col gap-2 max-w-[88%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'items-start'}`}
                                    >
                                        <div className={`flex gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
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

                                        {/* Render Proactive Action Cards */}
                                        {msg.actions && msg.actions.map((action, actionIdx) => {
                                            const actionKey = `${msgIdx}-${actionIdx}`;
                                            const isCompleted = completedActions[actionKey];
                                            const isExecuting = executingActionIdx === actionKey;

                                            return (
                                                <div 
                                                    key={actionIdx} 
                                                    className="ml-9 mt-1 p-3 bg-[#0F172A] border border-slate-700/80 rounded-xl space-y-2 text-xs w-[280px] md:w-[320px] shadow-md"
                                                >
                                                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                                                        <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wide">
                                                            {action.type === 'STOCK_HEAL' ? '⚡ Autonomous Replenish' : action.type === 'STOCK_TRANSFER' ? '🔄 Stock Move' : action.type === 'CREATE_USER' ? '👤 Register User' : '💻 Custody Transfer'}
                                                        </span>
                                                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[8px] h-3.5 px-1 py-0">Recommended</Badge>
                                                    </div>

                                                    {action.type === 'ASSIGN_CUSTODY' && (
                                                        <div className="space-y-1 font-mono text-[10px] text-slate-300">
                                                            <p><span className="text-slate-500">Asset:</span> {action.itemName}</p>
                                                            <p><span className="text-slate-500">Serial:</span> {action.serialNumber}</p>
                                                            <p><span className="text-slate-500">Assign To:</span> {action.staffName}</p>
                                                        </div>
                                                    )}

                                                    {action.type === 'CREATE_USER' && (
                                                        <div className="space-y-1 font-mono text-[10px] text-slate-300 font-sans">
                                                            <p><span className="text-slate-500">Username:</span> {action.username}</p>
                                                            <p><span className="text-slate-500">Full Name:</span> {action.itemName}</p>
                                                            <p><span className="text-slate-500">Password:</span> {action.password}</p>
                                                            <p><span className="text-slate-500">Role:</span> {action.role}</p>
                                                            <p><span className="text-slate-500">OPMC Code:</span> {action.rtomCode || 'Default'}</p>
                                                        </div>
                                                    )}

                                                    {(action.type === 'STOCK_HEAL' || action.type === 'STOCK_TRANSFER') && (
                                                        <div className="space-y-2">
                                                            <p className="text-[10px] text-slate-300"><span className="text-slate-500">Item:</span> {action.itemName} ({action.itemCode})</p>
                                                            <div className="flex items-center justify-between bg-slate-900/50 p-2 rounded border border-slate-800/80 text-[9px] font-mono">
                                                                <div className="text-center">
                                                                    <p className="text-slate-500">Source Store</p>
                                                                    <p className="text-slate-300 font-semibold">{action.fromStoreName}</p>
                                                                </div>
                                                                <div className="text-sky-400 flex flex-col items-center">
                                                                    <span>{action.quantity} Qty</span>
                                                                    <ArrowRight className="w-3.5 h-3.5" />
                                                                </div>
                                                                <div className="text-center">
                                                                    <p className="text-slate-500">Dest Store</p>
                                                                    <p className="text-slate-300 font-semibold">{action.toStoreName}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {isCompleted ? (
                                                        <div className={`flex items-start gap-1.5 font-sans text-[10px] pt-1 ${completedActions[actionKey].startsWith('❌') ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {!completedActions[actionKey].startsWith('❌') && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                                                            <span>{completedActions[actionKey]}</span>
                                                        </div>
                                                    ) : (
                                                        <Button 
                                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-[10px] h-7 gap-1 font-sans mt-1"
                                                            onClick={() => handleExecuteAction(action, msgIdx, actionIdx)}
                                                            disabled={!!executingActionIdx}
                                                        >
                                                            {isExecuting ? (
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                'Approve & Execute Action'
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
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
                                    onClick={() => handleSendMessage("Low stock materials monawada?")}
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
                                    onClick={() => handleSendMessage("Pending Payment Vouchers monawada?")}
                                    className="bg-[#1E293B] hover:bg-slate-800 border border-slate-700/50 text-[10px] text-slate-300 font-sans px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 cursor-pointer"
                                >
                                    <Laptop className="w-3 h-3 text-sky-400" />
                                    Pending Vouchers
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
                        </>
                    )}

                    {/* Alerts Body (Alerts Tab) */}
                    {activeTab === 'alerts' && (
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0F172A]/40 flex flex-col">
                            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                    <Bell className="w-4 h-4 text-sky-400" />
                                    Active ERP Alerts
                                </h4>
                                {alerts.length > 0 && (
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={handleClearAllAlerts}
                                        className="text-[10px] text-red-400 hover:text-red-300 hover:bg-slate-800 h-7"
                                    >
                                        Clear All
                                    </Button>
                                )}
                            </div>

                            {alerts.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2 py-8">
                                    <Check className="w-10 h-10 text-emerald-500" />
                                    <p className="text-xs font-semibold">All clear! No pending warnings.</p>
                                </div>
                            ) : (
                                <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
                                    {alerts.map((alert) => (
                                        <div 
                                            key={alert.id}
                                            className="bg-[#1E293B] border border-slate-700/60 rounded-xl p-3 flex justify-between items-start gap-2 shadow-sm"
                                        >
                                            <div className="space-y-1 text-[11px] flex-1">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide border ${getPriorityStyle(alert.priority)}`}>
                                                        {alert.priority}
                                                    </span>
                                                    <h5 className="font-bold text-slate-200">{alert.title}</h5>
                                                </div>
                                                <p className="text-slate-400 leading-relaxed font-sans">{alert.message}</p>
                                                {alert.link && (
                                                    <a 
                                                        href={alert.link}
                                                        className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline font-semibold mt-1"
                                                    >
                                                        Go to module <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => handleDismissAlert(alert.id)}
                                                className="text-slate-500 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                                                title="Dismiss alert"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
