"use client";

import React, { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import TicketTable from "@/components/helpdesk/TicketTable";
import TicketDetailsDialog from "@/components/helpdesk/TicketDetailsDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LayoutDashboard, FileText, Monitor, CheckCircle, ShieldAlert, Users, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function HelpdeskAdminDashboard() {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; name: string; role: string } | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  
  // Queue stats
  const [stats, setStats] = useState({
    open: 0,
    inProgress: 0,
    waiting: 0,
    resolved: 0,
    critical: 0,
    total: 0
  });

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [assignmentFilter, setAssignmentFilter] = useState("ALL"); // ALL, ME, UNASSIGNED

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const fetchQueueData = async () => {
    setLoading(true);
    try {
      // Build parameters
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (priorityFilter !== "ALL") params.append("priority", priorityFilter);
      if (categoryFilter !== "ALL") params.append("category", categoryFilter);
      
      if (assignmentFilter === "ME" && user?.id) {
        params.append("assignedToId", user.id);
      } else if (assignmentFilter === "UNASSIGNED") {
        params.append("assignedToId", "null"); // we will handle this in backend or filter client-side
      }

      const res = await fetch(`/api/helpdesk/tickets?${params.toString()}&_t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to fetch queue");
      const json = await res.json();
      if (json.success) {
        let ticketList = json.data.tickets || [];
        
        // Handle unassigned filter client side if backend didn't pluck it
        if (assignmentFilter === "UNASSIGNED") {
          ticketList = ticketList.filter((t: any) => !t.assignedToId);
        }

        setTickets(ticketList);
      }

      // Fetch summary stats
      const statsRes = await fetch(`/api/helpdesk/reports?_t=${Date.now()}`);
      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson.success && statsJson.data.counts) {
          setStats(statsJson.data.counts);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load helpdesk queue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) {
      fetchQueueData();
    }
  }, [mounted, user, statusFilter, priorityFilter, categoryFilter, assignmentFilter]);

  const handleSearchKeyPress = (e: React.FormEvent) => {
    e.preventDefault();
    fetchQueueData();
  };

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
        fetchQueueData();
      }
    } catch (err) {
      toast.error("Failed to transition ticket status");
    }
  };

  const handleAssignToMe = async () => {
    if (!selectedTicket || !user?.id) return;
    try {
      const res = await fetch(`/api/helpdesk/tickets/${selectedTicket.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: user.id })
      });
      if (!res.ok) throw new Error("Failed to assign ticket");
      const json = await res.json();
      if (json.success) {
        setSelectedTicket(json.data);
        fetchQueueData();
        toast.success("Ticket assigned to you!");
      }
    } catch (err) {
      toast.error("Failed to assign ticket");
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
        fetchQueueData();
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
        fetchQueueData();
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
        <main className="flex-grow p-4 md:p-6 overflow-y-auto max-w-[1600px] mx-auto w-full space-y-6">
          {/* Header Title */}
          <div className="bg-card/60 backdrop-blur-md p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2.5 rounded-lg">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-foreground">IT Help Desk Admin Queue</h1>
                <p className="text-[10px] text-muted-foreground">Manage and resolve company device incidents.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs bg-card" onClick={fetchQueueData}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Queue
            </Button>
          </div>

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <Card className="bg-card/75 border-border/40 hover:-translate-y-0.5 transition-transform duration-300">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Open Incidents</CardDescription>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="text-xl font-black text-indigo-600 dark:text-indigo-400">{stats.open}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/75 border-border/40 hover:-translate-y-0.5 transition-transform duration-300">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] uppercase font-bold tracking-wider">In Progress</CardDescription>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="text-xl font-black text-sky-500">{stats.inProgress}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/75 border-border/40 hover:-translate-y-0.5 transition-transform duration-300">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Waiting User/Parts</CardDescription>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="text-xl font-black text-amber-500">{stats.waiting}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/75 border-border/40 hover:-translate-y-0.5 transition-transform duration-300 animate-pulse border-red-500/25">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] uppercase font-bold tracking-wider text-red-500">Unresolved Critical</CardDescription>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="text-xl font-black text-red-500">{stats.critical}</div>
              </CardContent>
            </Card>

            <Card className="bg-card/75 border-border/40 hover:-translate-y-0.5 transition-transform duration-300">
              <CardHeader className="p-3.5 pb-1">
                <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Resolved Today</CardDescription>
              </CardHeader>
              <CardContent className="p-3.5 pt-0">
                <div className="text-xl font-black text-emerald-500">{stats.resolved}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filtering Control Panel */}
          <form onSubmit={handleSearchKeyPress} className="bg-card/75 border border-border/50 rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-3 items-end text-xs">
            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Search tickets</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Ticket No, description, brand, reporter..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8.5 text-xs h-8.5 bg-card border border-border/60"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Progress Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8.5 text-xs bg-card border-border/60">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="ASSIGNED">Assigned</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="WAITING_FOR_USER">Waiting for User</SelectItem>
                  <SelectItem value="WAITING_FOR_PARTS">Waiting for Parts</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Urgency</label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-8.5 text-xs bg-card border-border/60">
                  <SelectValue placeholder="All Urgencies" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="ALL">All Urgencies</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Support Agent</label>
              <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                <SelectTrigger className="h-8.5 text-xs bg-card border-border/60">
                  <SelectValue placeholder="All Tickets" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="ALL">All Tickets</SelectItem>
                  <SelectItem value="ME">Assigned to Me</SelectItem>
                  <SelectItem value="UNASSIGNED">Unassigned Queue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </form>

          {/* Master Queue List */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">IT Incidents Queue ({tickets.length})</h2>
            {loading ? (
              <div className="space-y-2.5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-11 bg-card/60 rounded-lg animate-pulse border border-border/30" />
                ))}
              </div>
            ) : (
              <TicketTable tickets={tickets} onViewDetails={handleViewTicketDetails} isStaff={true} />
            )}
          </div>
        </main>
      </div>

      {/* Slide-over Ticket Details */}
      {selectedTicket && (
        <TicketDetailsDialog
          ticket={selectedTicket}
          onClose={() => {
            setSelectedTicket(null);
            fetchQueueData();
          }}
          onUpdateStatus={handleUpdateStatus}
          onAssignToMe={handleAssignToMe}
          onAddComment={handleAddComment}
          onSaveAnydesk={handleSaveAnydesk}
          onUpdateFields={handleUpdateFields}
          isStaff={true}
          currentUserId={user?.id || ""}
        />
      )}
    </div>
  );
}
