"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import TicketTable from "@/components/helpdesk/TicketTable";
import TicketDetailsDialog from "@/components/helpdesk/TicketDetailsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, LifeBuoy, FileText, BookOpen, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function HelpdeskUserDashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setMounted(true);
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const fetchTickets = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/helpdesk/tickets?userId=${user.id}&_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Pragma": "no-cache",
          "Cache-Control": "no-cache"
        }
      });
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const json = await res.json();
      if (json.success) {
        setTickets(json.data.tickets || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load your support tickets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted && user?.id) {
      fetchTickets();
    }
  }, [mounted, user]);

  const handleViewTicketDetails = async (ticket: any) => {
    try {
      const res = await fetch(`/api/helpdesk/tickets/${ticket.id}?_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to load details");
      const json = await res.json();
      if (json.success) {
        setSelectedTicket(json.data);
      }
    } catch (err) {
      toast.error("Failed to fetch ticket history");
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error("Failed to update status");
      const json = await res.json();
      if (json.success) {
        setSelectedTicket(json.data);
        fetchTickets();
      }
    } catch (err) {
      toast.error("Failed to transition ticket status");
    }
  };

  const handleAddComment = async (message: string) => {
    if (!selectedTicket || !user?.id) return;
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
      });
      if (!res.ok) throw new Error("Failed to post comment");
      const json = await res.json();
      if (json.success) {
        // Refresh details
        handleViewTicketDetails(selectedTicket);
      }
    } catch (err) {
      toast.error("Failed to post message");
    }
  };

  const handleSaveAnydesk = async (anydeskId: string) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anydeskId })
      });
      if (!res.ok) throw new Error("Failed to save AnyDesk ID");
      const json = await res.json();
      if (json.success) {
        setSelectedTicket(json.data);
        fetchTickets();
      }
    } catch (err) {
      toast.error("Failed to save remote credentials");
    }
  };

  const handleUpdateFields = async (fields: Record<string, unknown>) => {
    if (!selectedTicket) return;
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
      });
      if (!res.ok) throw new Error("Failed to update ticket details");
      const json = await res.json();
      if (json.success) {
        setSelectedTicket(json.data);
        fetchTickets();
      }
    } catch {
      toast.error("Failed to save details");
      throw new Error("Update failed");
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[1400px] mx-auto w-full space-y-6">
          
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 rounded-xl p-5 md:p-8 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2 z-10">
              <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full w-max text-xs backdrop-blur-sm">
                <LifeBuoy className="h-3.5 w-3.5" />
                <span>ITSM Support Center</span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Hello, {user?.name || "Employee"}! How can we assist you?
              </h1>
              <p className="text-xs text-white/80 max-w-lg">
                Report IT issues with your hardware, request new computer components, or manage support tickets.
              </p>
            </div>
            
            {/* Glass decoration bubbles */}
            <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-white/5 skew-x-12 translate-x-1/2 pointer-events-none" />
          </div>

          {/* Quick actions cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/helpdesk/tickets/new" className="group">
              <div className="bg-card hover:bg-card/95 border border-border/50 rounded-xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex items-start gap-4">
                <div className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 p-2.5 rounded-lg group-hover:scale-105 transition-all duration-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-foreground">Open Support Ticket</h3>
                  <p className="text-[10px] text-muted-foreground mt-1">Submit laptop, network, or printer failure logs.</p>
                </div>
              </div>
            </Link>

            <div className="bg-card border border-border/50 rounded-xl p-4 shadow-sm flex items-start gap-4">
              <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-foreground">Service Level Agreement</h3>
                <p className="text-[10px] text-muted-foreground mt-1">Avg. first response in &lt; 2h. Critical resolution in &lt; 4h.</p>
              </div>
            </div>
          </div>

          {/* Tickets section */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold text-foreground">My Support Tickets</h2>
                <p className="text-[10px] text-muted-foreground">Track status and discuss issues with IT Engineers.</p>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-11 bg-card/60 rounded-lg animate-pulse border border-border/30" />
                ))}
              </div>
            ) : (
              <TicketTable tickets={tickets} onViewDetails={handleViewTicketDetails} />
            )}
          </div>
          
        </main>
      </div>

      {/* Ticket Details Dialog */}
      {selectedTicket && (
        <TicketDetailsDialog
          ticket={selectedTicket}
          onClose={() => {
            setSelectedTicket(null);
            fetchTickets();
          }}
          onUpdateStatus={handleUpdateStatus}
          onAddComment={handleAddComment}
          onSaveAnydesk={handleSaveAnydesk}
          onUpdateFields={handleUpdateFields}
          currentUserId={user?.id || ""}
        />
      )}
    </div>
  );
}
