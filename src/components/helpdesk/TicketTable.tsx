import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { Eye, ShieldAlert, Monitor, User } from "lucide-react";

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  category: string;
  description: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "WAITING_FOR_USER" | "WAITING_FOR_PARTS" | "RESOLVED" | "CLOSED";
  anydeskId?: string | null;
  createdAt: string | Date;
  firstResponseAt?: string | Date | null;
  resolvedAt?: string | Date | null;
  user: {
    id: string;
    name: string | null;
    username: string;
  };
  assignedTo?: {
    id: string;
    name: string | null;
    username: string;
  } | null;
  asset?: {
    id: string;
    assetNumber: string;
    brand: string;
    model: string;
  } | null;
}

interface TicketTableProps {
  tickets: TicketSummary[];
  onViewDetails: (ticket: TicketSummary) => void;
  isStaff?: boolean;
}

export default function TicketTable({ tickets, onViewDetails, isStaff = false }: TicketTableProps) {
  const checkSLA = (ticket: any) => {
    const created = new Date(ticket.createdAt).getTime();
    
    let responseDeadlineTime = ticket.slaResponseDeadline ? new Date(ticket.slaResponseDeadline).getTime() : null;
    let resolutionDeadlineTime = ticket.slaResolutionDeadline ? new Date(ticket.slaResolutionDeadline).getTime() : null;

    if (!responseDeadlineTime) {
      let hours = 4;
      if (ticket.priority === 'CRITICAL') hours = 1;
      else if (ticket.priority === 'HIGH') hours = 2;
      else if (ticket.priority === 'LOW') hours = 8;
      responseDeadlineTime = created + hours * 60 * 60 * 1000;
    }

    if (!resolutionDeadlineTime) {
      let hours = 24;
      if (ticket.priority === 'CRITICAL') hours = 4;
      else if (ticket.priority === 'HIGH') hours = 8;
      else if (ticket.priority === 'LOW') hours = 72;
      resolutionDeadlineTime = created + hours * 60 * 60 * 1000;
    }

    const firstResponseTime = ticket.firstResponseAt ? new Date(ticket.firstResponseAt).getTime() : null;
    const resolvedTime = ticket.resolvedAt ? new Date(ticket.resolvedAt).getTime() : null;

    const responseBreached = ticket.slaResponseBreached !== undefined && ticket.slaResponseBreached !== null
      ? ticket.slaResponseBreached
      : (firstResponseTime ? firstResponseTime > responseDeadlineTime : Date.now() > responseDeadlineTime) && (!ticket.firstResponseAt && !['CLOSED', 'RESOLVED'].includes(ticket.status));

    const resolutionBreached = ticket.slaResolutionBreached !== undefined && ticket.slaResolutionBreached !== null
      ? ticket.slaResolutionBreached
      : (resolvedTime ? resolvedTime > resolutionDeadlineTime : Date.now() > resolutionDeadlineTime) && (!ticket.resolvedAt && !['CLOSED'].includes(ticket.status));

    return { responseBreached, resolutionBreached };
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold animate-pulse text-[10px]">CRITICAL</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white text-[10px]">HIGH</Badge>;
      case "MEDIUM":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-[10px]">MEDIUM</Badge>;
      case "LOW":
      default:
        return <Badge className="bg-slate-400 hover:bg-slate-500 text-white text-[10px]">LOW</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-200 text-[10px]">OPEN</Badge>;
      case "ASSIGNED":
        return <Badge className="bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-200 text-[10px]">ASSIGNED</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-sky-100 hover:bg-sky-200 text-sky-800 border-sky-200 text-[10px]">IN PROGRESS</Badge>;
      case "WAITING_FOR_USER":
        return <Badge className="bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-200 text-[10px]">WAITING FOR USER</Badge>;
      case "WAITING_FOR_PARTS":
        return <Badge className="bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-200 text-[10px]">WAITING FOR PARTS</Badge>;
      case "RESOLVED":
        return <Badge className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-200 text-[10px]">RESOLVED</Badge>;
      case "CLOSED":
      default:
        return <Badge className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 text-[10px]">CLOSED</Badge>;
    }
  };

  const formatCategory = (category: string) => {
    return category.toLowerCase().replace(/_/g, " ");
  };

  if (tickets.length === 0) {
    return (
      <div className="text-center py-10 bg-card rounded-lg border border-border/50 backdrop-blur-md">
        <ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-semibold text-muted-foreground">No tickets found</p>
        <p className="text-xs text-muted-foreground/70">Tickets submitted will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 bg-card/85 backdrop-blur-lg shadow-xl shadow-slate-200/20 overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="font-semibold text-xs py-2">Ticket No</TableHead>
            <TableHead className="font-semibold text-xs py-2">Category</TableHead>
            <TableHead className="font-semibold text-xs py-2">Problem Description</TableHead>
            {isStaff && <TableHead className="font-semibold text-xs py-2">Reporter</TableHead>}
            <TableHead className="font-semibold text-xs py-2">Priority</TableHead>
            <TableHead className="font-semibold text-xs py-2">Status</TableHead>
            <TableHead className="font-semibold text-xs py-2">Age</TableHead>
            {isStaff && <TableHead className="font-semibold text-xs py-2">Assignee</TableHead>}
            <TableHead className="font-semibold text-xs py-2 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => (
            <TableRow key={ticket.id} className="hover:bg-muted/30 transition-colors border-b border-border/40 text-xs">
              <TableCell className="font-semibold py-2.5 text-foreground/90">
                <div className="flex items-center gap-1.5">
                  <span>{ticket.ticketNumber}</span>
                  {(() => {
                    const { responseBreached, resolutionBreached } = checkSLA(ticket);
                    if (responseBreached || resolutionBreached) {
                      return (
                        <span 
                          className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-[8px] font-bold tracking-wider uppercase animate-pulse border border-red-200"
                          title={responseBreached ? "Response SLA Breached (>4h)" : "Resolution SLA Breached (>24h)"}
                        >
                          SLA
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
              </TableCell>
              <TableCell className="capitalize py-2.5 text-muted-foreground">{formatCategory(ticket.category)}</TableCell>
              <TableCell className="max-w-[180px] truncate py-2.5 text-muted-foreground" title={ticket.description}>
                {ticket.description}
              </TableCell>
              {isStaff && (
                <TableCell className="py-2.5 font-medium text-foreground/80">
                  {ticket.user?.name || "ERP Staff"}
                </TableCell>
              )}
              <TableCell className="py-2.5">{getPriorityBadge(ticket.priority)}</TableCell>
              <TableCell className="py-2.5">{getStatusBadge(ticket.status)}</TableCell>
              <TableCell className="py-2.5 text-muted-foreground/80">
                {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
              </TableCell>
              {isStaff && (
                <TableCell className="py-2.5 text-muted-foreground">
                  {ticket.assignedTo ? (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-primary" />
                      <span>{ticket.assignedTo.name}</span>
                    </div>
                  ) : (
                    <span className="italic text-muted-foreground/60">Unassigned</span>
                  )}
                </TableCell>
              )}
              <TableCell className="text-right py-2.5">
                <div className="flex justify-end gap-1.5">
                  {ticket.anydeskId && (
                    <div className="flex items-center text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded font-mono" title="AnyDesk Active">
                      <Monitor className="h-3 w-3 mr-1" />
                      <span>{ticket.anydeskId}</span>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary transition-all duration-300"
                    onClick={() => onViewDetails(ticket)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
