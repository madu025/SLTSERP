"use client";

import React from "react";
import { ServiceOrder } from "@/types/service-order";
import { ArrowUpDown, Activity, Pencil, Trash, FileText, Calendar, MessageSquare, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SODTableProps {
    orders: ServiceOrder[];
    filterType: string;
    isColumnVisible: (col: string) => boolean;
    onSort: (key: keyof ServiceOrder) => void;
    sortConfig: { key: keyof ServiceOrder; direction: "asc" | "desc" } | null;
    onStatusChange: (id: string, status: string) => void;
    onAction: (order: ServiceOrder, type: 'detail' | 'schedule' | 'comment') => void;
}

export function SODTable({ orders, filterType, isColumnVisible, onSort, sortConfig, onStatusChange, onAction }: SODTableProps) {
    return (
        <table className="w-full text-xs text-left relative border-collapse">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b sticky top-0 z-40 shadow-sm shadow-slate-200/50">
                <tr>
                    {isColumnVisible('soNum') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('soNum')}>SO Number <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'soNum' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('lea') && filterType !== 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('lea')}>LEA <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'lea' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('customerName') && filterType !== 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('customerName')}>Customer <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'customerName' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('voiceNumber') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('voiceNumber')}>Voice <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'voiceNumber' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('package') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('package')}>Package <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'package' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('orderType') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('orderType')}>Order Type <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'orderType' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('receivedDate') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('receivedDate')}>Received Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'receivedDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('statusDate') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('statusDate')}>Status Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'statusDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                    {isColumnVisible('createdAt') && filterType === 'pending' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('createdAt')}>Imported Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'createdAt' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}

                    {filterType === 'return' ? (
                        <>
                            <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('status')}>Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'status' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>
                            <th className="px-3 py-2 whitespace-nowrap">Contractor</th>
                            <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('completedDate')}>Return Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'completedDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>
                            <th className="px-3 py-2 whitespace-nowrap">Return Reason/Comment</th>
                        </>
                    ) : (
                        <>
                            {isColumnVisible('status') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('status')}>Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'status' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                            {isColumnVisible('sltsStatus') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('sltsStatus')}>SLTS Status <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'sltsStatus' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                            {isColumnVisible('scheduledDate') && filterType !== 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('scheduledDate')}>Appointment <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'scheduledDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                            {filterType === 'completed' && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('completedDate')}>Completed Date <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'completedDate' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                            {filterType === 'completed' && <th className="px-3 py-2 whitespace-nowrap text-center">Invoiced Status</th>}
                            {isColumnVisible('dp') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('dp')}>DP <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'dp' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                            {isColumnVisible('iptv') && <th className="px-3 py-2 cursor-pointer hover:bg-slate-100 whitespace-nowrap group" onClick={() => onSort('iptv')}>IPTV <ArrowUpDown className={`w-3 h-3 inline ml-1 transition-opacity ${sortConfig?.key === 'iptv' ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-100'}`} /></th>}
                        </>
                    )}

                    <th className="px-3 py-2 text-right whitespace-nowrap">Actions</th>
                </tr>
            </thead>
            <tbody className="divide-y text-[11px]">
                {orders.map(order => {
                    const isMissingFromSync = order.comments?.includes('[MISSING FROM SYNC');
                    return (
                        <tr key={order.id} className={`transition-colors ${isMissingFromSync ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-slate-50/50'}`}>
                            {isColumnVisible('soNum') && (
                                <td className="px-3 py-1.5 font-mono font-medium text-primary whitespace-nowrap">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => onAction(order, 'detail')}>{order.soNum}</button>
                                        {order.isManualEntry && <span className="text-[7px] bg-slate-100 text-slate-500 px-1 border border-slate-200 rounded font-bold uppercase">Manual</span>}
                                        {order.hasBridgeLog && <span className="text-[7px] bg-indigo-500 text-white px-1 rounded font-bold uppercase flex items-center gap-0.5 border border-indigo-400"><Activity className="w-2 h-2" /> BRIDGE</span>}
                                    </div>
                                </td>
                            )}
                            {/* ... more columns ... */}
                            <td className="px-3 py-1.5 text-right flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAction(order, 'detail')}><Info className="w-3 h-3" /></Button>
                                {filterType === 'pending' && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAction(order, 'schedule')}><Calendar className="w-3 h-3" /></Button>}
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onAction(order, 'comment')}><MessageSquare className="w-3 h-3" /></Button>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

// NOTE: I'll stop here for a moment and only extract the Summary and Hooks first, 
// because extracting the Table fully requires a lot of props and potential regressions if not careful.
// I'll keep the Table logic in the main page for now but using the hooks.
