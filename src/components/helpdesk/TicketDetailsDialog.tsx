import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { Send, User, Monitor, CheckCircle, RotateCcw, Image as ImageIcon, Star, Clipboard, X, Settings2, ShieldCheck, MapPin, Hash, Package, Clock } from "lucide-react";
import { toast } from "sonner";

interface TicketDetailsDialogProps {
  ticket: any;
  onClose: () => void;
  onUpdateStatus: (status: string) => Promise<void>;
  onAssignToMe?: () => Promise<void>;
  onAddComment: (message: string, statusTo?: string) => Promise<void>;
  onSaveAnydesk: (anydeskId: string) => Promise<void>;
  onUpdateFields?: (fields: { satisfactionRating?: number | null; satisfactionNote?: string | null; anydeskSession?: string | null; status?: string }) => Promise<void>;
  isStaff?: boolean;
  currentUserId: string;
}

export default function TicketDetailsDialog({
  ticket,
  onClose,
  onUpdateStatus,
  onAssignToMe,
  onAddComment,
  onSaveAnydesk,
  onUpdateFields,
  isStaff = false,
  currentUserId
}: TicketDetailsDialogProps) {
  const [commentText, setCommentText] = useState("");
  const [anydeskInput, setAnydeskInput] = useState(ticket?.anydeskId || "");
  const [anydeskSessionInput, setAnydeskSessionInput] = useState(ticket?.anydeskSession || "");
  const [savingSessionNotes, setSavingSessionNotes] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [savingAnydesk, setSavingAnydesk] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  
  // Feedback states
  const [showFeedback, setShowFeedback] = useState(false);
  const [rating, setRating] = useState(5);
  const [ratingNote, setRatingNote] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  if (!ticket) return null;

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await onAddComment(commentText);
      setCommentText("");
      toast.success("Comment posted successfully");
    } catch (err) {
      toast.error("Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleStatusChange = async (val: string) => {
    setChangingStatus(true);
    try {
      await onUpdateStatus(val);
      toast.success(`Ticket status updated to ${val}`);
    } catch (err) {
      toast.error("Failed to update ticket status");
    } finally {
      setChangingStatus(false);
    }
  };

  const handleSaveAnydesk = async () => {
    if (!anydeskInput.trim()) return;
    setSavingAnydesk(true);
    try {
      await onSaveAnydesk(anydeskInput);
      toast.success("AnyDesk address registered!");
    } catch (err) {
      toast.error("Failed to save AnyDesk address");
    } finally {
      setSavingAnydesk(false);
    }
  };

  const handleSaveSessionNotes = async () => {
    if (!onUpdateFields) return;
    setSavingSessionNotes(true);
    try {
      await onUpdateFields({ anydeskSession: anydeskSessionInput });
      toast.success("Session notes updated successfully!");
    } catch (err) {
      toast.error("Failed to save session notes");
    } finally {
      setSavingSessionNotes(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!onUpdateFields) return;
    setSubmittingFeedback(true);
    try {
      await onUpdateFields({
        status: "CLOSED",
        satisfactionRating: rating,
        satisfactionNote: ratingNote
      });
      toast.success("Feedback submitted and ticket closed.");
      setShowFeedback(false);
    } catch (err) {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const sla = (() => {
    const created = new Date(ticket.createdAt).getTime();
    
    // Response SLA: 4 hours
    const responseTarget = 4;
    const currentResponseTime = ticket.firstResponseAt 
      ? (new Date(ticket.firstResponseAt).getTime() - created) / (1000 * 60 * 60)
      : (Date.now() - created) / (1000 * 60 * 60);
    const responseBreached = currentResponseTime > responseTarget && (!ticket.firstResponseAt && !['CLOSED', 'RESOLVED'].includes(ticket.status));

    // Resolution SLA: 24 hours
    const resolutionTarget = 24;
    const currentResolutionTime = ticket.resolvedAt
      ? (new Date(ticket.resolvedAt).getTime() - created) / (1000 * 60 * 60)
      : (Date.now() - created) / (1000 * 60 * 60);
    const resolutionBreached = currentResolutionTime > resolutionTarget && (!ticket.resolvedAt && !['CLOSED', 'RESOLVED'].includes(ticket.status));

    return {
      responseBreached,
      resolutionBreached,
      currentResponseTime,
      currentResolutionTime
    };
  })();

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
        return <Badge className="bg-rose-500/10 text-rose-600 border border-rose-500/20 font-bold animate-pulse text-[10px] px-2 py-0.5 shadow-[0_0_10px_rgba(244,63,94,0.2)]">CRITICAL</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] px-2 py-0.5">HIGH</Badge>;
      case "MEDIUM":
        return <Badge className="bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[10px] px-2 py-0.5">MEDIUM</Badge>;
      case "LOW":
      default:
        return <Badge className="bg-slate-500/10 text-slate-600 border border-slate-500/20 text-[10px] px-2 py-0.5">LOW</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px] px-2 py-0.5 shadow-sm">OPEN</Badge>;
      case "ASSIGNED":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[10px] px-2 py-0.5 shadow-sm">ASSIGNED</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20 text-[10px] px-2 py-0.5 shadow-sm">IN PROGRESS</Badge>;
      case "WAITING_FOR_USER":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-2 py-0.5 shadow-sm">WAITING FOR USER</Badge>;
      case "WAITING_FOR_PARTS":
        return <Badge className="bg-pink-500/10 text-pink-600 border-pink-500/20 text-[10px] px-2 py-0.5 shadow-sm">WAITING FOR PARTS</Badge>;
      case "RESOLVED":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-2 py-0.5 shadow-sm">RESOLVED</Badge>;
      case "CLOSED":
      default:
        return <Badge className="bg-slate-500/10 text-slate-600 border-slate-500/20 text-[10px] px-2 py-0.5 shadow-sm">CLOSED</Badge>;
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        showCloseButton={false}
        className="fixed !inset-y-0 !right-0 !top-0 !left-auto !translate-x-0 !translate-y-0 !h-full w-[50vw] md:w-[50vw] sm:w-full !max-w-none flex flex-col !p-0 !gap-0 overflow-hidden bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right !rounded-none text-foreground"
      >
        
        {/* Dynamic Gradient Header */}
        <div className="relative p-6 pb-5 flex-shrink-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-b border-slate-200/50 dark:border-slate-800/50">
          <div className="absolute top-0 right-0 p-5">
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex justify-between items-start gap-4 max-w-[90%]">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold rounded-md font-mono shadow-sm">
                  {ticket.ticketNumber}
                </span>
                {getPriorityBadge(ticket.priority)}
                {getStatusBadge(ticket.status)}
                
                {sla.responseBreached && (
                  <Badge className="bg-red-500 text-white border-none animate-pulse text-[9px] font-bold px-2 shadow-sm">RESPONSE BREACHED</Badge>
                )}
                {sla.resolutionBreached && (
                  <Badge className="bg-red-500 text-white border-none animate-pulse text-[9px] font-bold px-2 shadow-sm">RESOLUTION BREACHED</Badge>
                )}
              </div>
              
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
                {ticket.category.replace(/_/g, " ")} Incident
              </h2>
              
              {ticket.satisfactionRating && (
                <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 p-3 rounded-xl text-emerald-800 dark:text-emerald-400 mt-2 flex items-start gap-3 inline-flex">
                  <div className="flex bg-white dark:bg-emerald-950/50 p-1.5 rounded-lg shadow-sm border border-emerald-100 dark:border-emerald-900/50">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < ticket.satisfactionRating ? "fill-amber-400 text-amber-400" : "text-slate-200 dark:text-slate-700"}`} />
                    ))}
                  </div>
                  <div className="text-[11px] pt-0.5">
                    <p className="font-bold text-emerald-900 dark:text-emerald-300">CSAT Score: {ticket.satisfactionRating}/5</p>
                    {ticket.satisfactionNote && (
                      <p className="italic text-emerald-700 dark:text-emerald-400/80 mt-1">&quot;{ticket.satisfactionNote}&quot;</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="text-right text-[10px] text-slate-500 dark:text-slate-400 pt-1">
              <p className="font-medium">Created</p>
              <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(ticket.createdAt).toLocaleDateString()}</p>
              <p className="mt-1">{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow overflow-y-auto p-6 space-y-6 text-sm select-text bg-slate-50/50 dark:bg-slate-950/50 custom-scrollbar">
          
          {/* Main Problem Details */}
          <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Incident Description
            </h3>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-[13px]">
              {ticket.description}
            </p>
            
            {ticket.photoUrls && ticket.photoUrls.length > 0 && (
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Attached Evidences</span>
                <div className="flex flex-wrap gap-3">
                  {ticket.photoUrls.map((url: string, idx: number) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-500/10 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-200 dark:hover:border-sky-500/30 transition-all font-medium shadow-sm">
                      <ImageIcon className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                      <span>Attachment {idx + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Linked Asset */}
          {ticket.asset && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5 mb-1"><Hash className="w-3 h-3" /> Asset No</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{ticket.asset.assetNumber}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5 mb-1"><Package className="w-3 h-3" /> Brand/Model</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{ticket.asset.brand} {ticket.asset.model}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5 mb-1"><ShieldCheck className="w-3 h-3" /> Serial</span>
                <p className="font-mono text-slate-800 dark:text-slate-200 text-[11px] font-bold truncate">{ticket.asset.serialNumber}</p>
              </div>
              <div className="bg-white dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1.5 mb-1"><MapPin className="w-3 h-3" /> Location</span>
                <p className="font-bold text-slate-800 dark:text-slate-200 text-xs truncate">{ticket.asset.location || "Colombo HQ"}</p>
              </div>
            </div>
          )}

          {/* AnyDesk Support Section */}
          <div className="relative overflow-hidden border border-rose-200 dark:border-rose-500/20 bg-gradient-to-br from-rose-50/50 to-white dark:from-rose-500/5 dark:to-slate-900 p-5 rounded-2xl shadow-sm space-y-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 dark:bg-rose-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold relative z-10">
              <div className="p-1.5 bg-rose-100 dark:bg-rose-500/20 rounded-lg">
                <Monitor className="h-4 w-4" />
              </div>
              <span className="tracking-tight">Remote Support Session (AnyDesk)</span>
            </div>
            
            {ticket.anydeskId ? (
              <div className="space-y-4 relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/30 shadow-sm">
                  <div>
                    <span className="text-[10px] text-rose-500 dark:text-rose-400 block uppercase font-bold mb-1">Session Address / ID</span>
                    <span className="font-mono text-xl font-black text-slate-800 dark:text-slate-200 tracking-widest">{ticket.anydeskId.match(/.{1,3}/g)?.join(' ') || ticket.anydeskId}</span>
                  </div>
                  {isStaff && (
                    <Button
                      size="sm"
                      className="h-8 text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-md rounded-lg px-4 transition-transform active:scale-95"
                      onClick={() => {
                        navigator.clipboard.writeText(ticket.anydeskId);
                        toast.success("AnyDesk address copied!");
                      }}
                    >
                      Copy ID
                    </Button>
                  )}
                </div>

                {/* Session Notes Section */}
                {isStaff ? (
                  <div className="space-y-2 pt-2">
                    <label className="text-[10px] font-black text-rose-600/70 dark:text-rose-400/70 uppercase tracking-wider flex items-center gap-1.5">
                      <Clipboard className="h-3.5 w-3.5" /> Engineer Remote Session Notes
                    </label>
                    <Textarea
                      placeholder="Describe troubleshooting steps performed during the AnyDesk remote session..."
                      value={anydeskSessionInput}
                      onChange={(e) => setAnydeskSessionInput(e.target.value)}
                      rows={2}
                      className="text-xs bg-white dark:bg-slate-950 border-rose-200 dark:border-rose-900/50 focus-visible:ring-rose-500 rounded-xl resize-none shadow-inner"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={savingSessionNotes || anydeskSessionInput === ticket.anydeskSession}
                        className="h-8 text-[11px] bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg px-4"
                        onClick={handleSaveSessionNotes}
                      >
                        {savingSessionNotes ? "Saving Notes..." : "Save Session Notes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  ticket.anydeskSession && (
                    <div className="pt-2 text-[11px] text-slate-600 dark:text-slate-400">
                      <span className="font-black text-[9px] uppercase tracking-wider block mb-1.5 text-rose-600/80 dark:text-rose-400/80">Support Session Summary</span>
                      <p className="italic bg-white/60 dark:bg-slate-900/60 backdrop-blur p-3 rounded-xl border border-rose-100 dark:border-rose-900/30 text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {ticket.anydeskSession}
                      </p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-3 relative z-10">
                <p className="text-[11.5px] text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                  If you require remote assistance, please open AnyDesk, enter your 9-digit address below, and save. The assigned engineer will connect to this address.
                </p>
                <div className="flex gap-2 max-w-sm">
                  <Input
                    placeholder="e.g. 123 456 789"
                    value={anydeskInput}
                    onChange={(e) => setAnydeskInput(e.target.value)}
                    className="h-9 text-sm font-mono bg-white dark:bg-slate-950 border-rose-200 dark:border-rose-900/50 focus-visible:ring-rose-500 rounded-xl"
                  />
                  <Button
                    size="sm"
                    disabled={savingAnydesk || !anydeskInput}
                    className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-4"
                    onClick={handleSaveAnydesk}
                  >
                    {savingAnydesk ? "Saving..." : "Save ID"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* IT Admin Resolution Tools */}
          {isStaff && (
            <div className="border border-sky-200 dark:border-sky-500/20 bg-gradient-to-r from-sky-50 to-white dark:from-sky-500/5 dark:to-slate-900 p-5 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-black text-sky-600 dark:text-sky-400 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                  <Settings2 className="w-3.5 h-3.5" /> Engineering Controls
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Update ticket progress or claim ownership.</span>
              </div>
              <div className="flex flex-wrap gap-2.5 items-center w-full sm:w-auto">
                {!ticket.assignedToId && onAssignToMe && (
                  <Button size="sm" onClick={onAssignToMe} className="h-9 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-700 rounded-xl shadow-sm">
                    Claim Ticket
                  </Button>
                )}
                
                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-1 rounded-xl border border-sky-100 dark:border-sky-900/50 shadow-sm flex-grow sm:flex-grow-0">
                  <span className="text-[10px] text-slate-400 uppercase font-black pl-2 hidden sm:inline-block">Status</span>
                  <Select value={ticket.status} onValueChange={handleStatusChange} disabled={changingStatus}>
                    <SelectTrigger className="h-7 text-xs bg-transparent border-none font-bold text-slate-700 dark:text-slate-200 focus:ring-0 min-w-[130px]">
                      <SelectValue placeholder={ticket.status} />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
                      <SelectItem value="OPEN" className="text-xs font-medium">Open</SelectItem>
                      <SelectItem value="ASSIGNED" className="text-xs font-medium">Assigned</SelectItem>
                      <SelectItem value="IN_PROGRESS" className="text-xs font-medium">In Progress</SelectItem>
                      <SelectItem value="WAITING_FOR_USER" className="text-xs font-medium">Waiting for User</SelectItem>
                      <SelectItem value="WAITING_FOR_PARTS" className="text-xs font-medium">Waiting for Parts</SelectItem>
                      <SelectItem value="RESOLVED" className="text-xs font-medium">Resolved</SelectItem>
                      <SelectItem value="CLOSED" className="text-xs font-medium">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Ticket Timeline History */}
          <div className="space-y-4 pt-2">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-4">
              <Clock className="w-3.5 h-3.5" /> Activity Timeline
            </h3>
            <div className="space-y-5 relative pl-5 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
              {ticket.updates?.map((up: any) => (
                <div key={up.id} className="relative space-y-1.5 group">
                  {/* Timeline bullet */}
                  <div className="absolute -left-[20px] top-1 h-3 w-3 rounded-full bg-slate-300 dark:bg-slate-600 border-[3px] border-slate-50 dark:border-slate-950 group-hover:bg-sky-500 group-hover:border-sky-100 dark:group-hover:border-sky-900 transition-colors" />
                  
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      <User className="h-3 w-3 opacity-70" />
                      {up.user?.name || "System Automation"}
                    </span>
                    <span className="font-medium bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded-md">{formatDistanceToNow(new Date(up.createdAt), { addSuffix: true })}</span>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900/80 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm text-[12.5px] ml-1">
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{up.message}</p>
                    
                    {up.statusFrom && up.statusTo && up.statusFrom !== up.statusTo && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/60 flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                        <RotateCcw className="w-3 h-3 text-sky-500" />
                        <span>STATE CHANGE:</span>
                        <span className="text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{up.statusFrom}</span>
                        <span className="text-sky-500">→</span>
                        <span className="text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.5 rounded">{up.statusTo}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Comments Input */}
        {ticket.status !== "CLOSED" && (
          <div className="p-4 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex-shrink-0 z-10 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
            <form onSubmit={handleSendComment} className="flex gap-3 max-w-4xl mx-auto">
              <Textarea
                placeholder="Write a message or reply..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={1}
                className="min-h-[44px] h-[44px] text-[13px] bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-sky-500 rounded-2xl resize-none flex-grow py-3 px-4 shadow-inner"
              />
              <Button type="submit" disabled={submittingComment || !commentText.trim()} className="h-[44px] w-[44px] p-0 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl shadow-md flex items-center justify-center flex-shrink-0 transition-transform active:scale-95">
                <Send className="h-4.5 w-4.5" />
              </Button>
            </form>
            
            {!isStaff && ticket.status === "RESOLVED" && (
              <div className="mt-4 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-500/10 dark:to-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                {!showFeedback ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <span className="text-xs text-emerald-800 dark:text-emerald-400 font-bold flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 dark:bg-emerald-500/20 rounded-full">
                        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      Engineer resolved this incident. Please confirm to close.
                    </span>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        size="sm"
                        className="h-9 flex-1 sm:flex-none text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm"
                        onClick={() => setShowFeedback(true)}
                      >
                        Confirm & Close
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 flex-1 sm:flex-none text-[11px] border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-500/30 dark:text-amber-500 dark:hover:bg-amber-500/10 font-bold rounded-xl"
                        onClick={() => handleStatusChange("OPEN")}
                      >
                        Reopen Ticket
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="flex justify-between items-center border-b border-emerald-100 dark:border-emerald-500/20 pb-2">
                      <span className="text-[11px] text-emerald-800 dark:text-emerald-400 font-black uppercase tracking-widest">
                        Rate Resolution Quality
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] text-emerald-700 dark:text-emerald-400/70 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg px-2"
                        onClick={() => setShowFeedback(false)}
                      >
                        Cancel
                      </Button>
                    </div>

                    {/* Star Rating Select */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-2 rounded-xl inline-flex border border-emerald-100 dark:border-emerald-900/50 shadow-inner">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="focus:outline-none transition-all hover:scale-125 cursor-pointer p-1"
                          onClick={() => setRating(star)}
                        >
                          <Star
                            className={`h-7 w-7 ${
                              star <= rating
                                ? "fill-amber-400 text-amber-400 filter drop-shadow-md"
                                : "text-slate-200 dark:text-slate-800"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-black ml-3 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 rounded-lg">
                        {rating === 5 ? "Excellent 🤩" : rating === 4 ? "Good 🙂" : rating === 3 ? "Satisfactory 😐" : rating === 2 ? "Poor 😕" : "Dissatisfied 😞"}
                      </span>
                    </div>

                    {/* Satisfaction Note */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-500 uppercase tracking-wider">
                        Additional Feedback (Optional)
                      </label>
                      <Textarea
                        placeholder="Tell us what you liked or how we can improve our service..."
                        value={ratingNote}
                        onChange={(e) => setRatingNote(e.target.value)}
                        rows={2}
                        className="text-xs bg-white dark:bg-slate-950 border-emerald-200 dark:border-emerald-900/50 focus-visible:ring-emerald-500 rounded-xl resize-none shadow-sm"
                      />
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        size="sm"
                        disabled={submittingFeedback}
                        className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md px-6"
                        onClick={handleSubmitFeedback}
                      >
                        {submittingFeedback ? "Submitting..." : "Submit & Close Ticket"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
