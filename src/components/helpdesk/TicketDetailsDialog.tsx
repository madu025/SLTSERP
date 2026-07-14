import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { Send, User, Monitor, CheckCircle, Clock, RotateCcw, AlertTriangle, Image as ImageIcon, Star, Clipboard } from "lucide-react";
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
        return <Badge className="bg-red-500 text-white font-bold animate-pulse text-[10px]">CRITICAL</Badge>;
      case "HIGH":
        return <Badge className="bg-amber-500 text-white text-[10px]">HIGH</Badge>;
      case "MEDIUM":
        return <Badge className="bg-blue-500 text-white text-[10px]">MEDIUM</Badge>;
      case "LOW":
      default:
        return <Badge className="bg-slate-400 text-white text-[10px]">LOW</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-[10px]">OPEN</Badge>;
      case "ASSIGNED":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px]">ASSIGNED</Badge>;
      case "IN_PROGRESS":
        return <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[10px]">IN PROGRESS</Badge>;
      case "WAITING_FOR_USER":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px]">WAITING FOR USER</Badge>;
      case "WAITING_FOR_PARTS":
        return <Badge className="bg-pink-100 text-pink-800 border-pink-200 text-[10px]">WAITING FOR PARTS</Badge>;
      case "RESOLVED":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">RESOLVED</Badge>;
      case "CLOSED":
      default:
        return <Badge className="bg-slate-100 text-slate-800 border-slate-200 text-[10px]">CLOSED</Badge>;
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Block */}
        <div className="p-4 border-b border-border/40 flex-shrink-0 bg-muted/20">
          <div className="flex justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-primary font-mono">{ticket.ticketNumber}</span>
                {getPriorityBadge(ticket.priority)}
                {getStatusBadge(ticket.status)}
                {sla.responseBreached && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 animate-pulse text-[9px] font-bold">RESPONSE SLA BREACHED</Badge>
                )}
                {sla.resolutionBreached && (
                  <Badge className="bg-red-100 text-red-800 border-red-200 animate-pulse text-[9px] font-bold">RESOLUTION SLA BREACHED</Badge>
                )}
              </div>
              <h2 className="text-sm font-extrabold text-foreground mt-1.5 leading-snug">
                {ticket.category.replace(/_/g, " ")} Incident
              </h2>
              
              {ticket.satisfactionRating && (
                <div className="bg-emerald-500/10 border border-emerald-500/25 p-2 rounded-lg text-emerald-800 dark:text-emerald-400 mt-2 flex items-start gap-2 max-w-md">
                  <div className="flex text-amber-500 gap-0.5 mt-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3.5 w-3.5 ${i < ticket.satisfactionRating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                      />
                    ))}
                  </div>
                  <div className="text-[11px]">
                    <p className="font-bold">CSAT Score: {ticket.satisfactionRating}/5</p>
                    {ticket.satisfactionNote && (
                      <p className="italic text-foreground/80 mt-0.5">&quot;{ticket.satisfactionNote}&quot;</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="text-right text-[10px] text-muted-foreground">
              <p>Created {new Date(ticket.createdAt).toLocaleDateString()}</p>
              <p>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 text-xs select-text">
          {/* Main Problem Details */}
          <div className="bg-muted/10 border border-border/40 p-3 rounded-lg space-y-2">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Incident Description</h3>
            <p className="text-foreground/90 whitespace-pre-wrap">{ticket.description}</p>
            
            {ticket.photoUrls && ticket.photoUrls.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block mb-1">Attachments</span>
                <div className="flex flex-wrap gap-2">
                  {ticket.photoUrls.map((url: string, idx: number) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 p-1 bg-muted/40 hover:bg-muted/70 rounded border border-border/40 text-[10px] text-primary transition-all font-medium">
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>Attachment {idx + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Linked Asset */}
          {ticket.asset && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 bg-muted/10 border border-border/40 p-2.5 rounded-lg text-[10px]">
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Device Asset No</span>
                <p className="font-semibold text-foreground/80">{ticket.asset.assetNumber}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Brand / Model</span>
                <p className="font-semibold text-foreground/80">{ticket.asset.brand} {ticket.asset.model}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Device Serial</span>
                <p className="font-semibold text-foreground/80 font-mono">{ticket.asset.serialNumber}</p>
              </div>
              <div>
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Location</span>
                <p className="font-semibold text-foreground/80">{ticket.asset.location || "Colombo HQ"}</p>
              </div>
            </div>
          )}

          {/* AnyDesk Support Section */}
          <div className="border border-red-500/20 bg-red-500/5 p-3 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-semibold">
              <Monitor className="h-4 w-4" />
              <span>AnyDesk Remote Support Session</span>
            </div>
            
            {ticket.anydeskId ? (
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-card p-2 rounded border border-border/40">
                  <div>
                    <span className="text-[9px] text-muted-foreground block uppercase">AnyDesk Address / ID</span>
                    <span className="font-mono text-sm font-extrabold text-foreground tracking-wider">{ticket.anydeskId}</span>
                  </div>
                  {isStaff && (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
                      onClick={() => {
                        navigator.clipboard.writeText(ticket.anydeskId);
                        toast.success("AnyDesk address copied!");
                      }}
                    >
                      Copy Address
                    </Button>
                  )}
                </div>

                {/* Session Notes Section */}
                {isStaff ? (
                  <div className="space-y-1.5 pt-1.5 border-t border-red-500/10">
                    <label className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                      <Clipboard className="h-3 w-3 text-red-500" />
                      IT Engineer Remote Session Notes
                    </label>
                    <Textarea
                      placeholder="Describe what troubleshooting steps were done during the AnyDesk remote session..."
                      value={anydeskSessionInput}
                      onChange={(e) => setAnydeskSessionInput(e.target.value)}
                      rows={2}
                      className="text-xs bg-card border-border/60"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={savingSessionNotes || anydeskSessionInput === ticket.anydeskSession}
                        className="h-7 text-[10px] bg-red-600 hover:bg-red-700 text-white font-bold"
                        onClick={handleSaveSessionNotes}
                      >
                        {savingSessionNotes ? "Saving Notes..." : "Save Session Notes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  ticket.anydeskSession && (
                    <div className="pt-2 border-t border-red-500/10 text-[10px] text-muted-foreground">
                      <span className="font-bold text-[9px] uppercase block mb-0.5 text-foreground/80">Support Session Summary</span>
                      <p className="italic bg-card p-2 rounded border border-border/40 text-foreground/90 whitespace-pre-wrap">{ticket.anydeskSession}</p>
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground">If you require remote assistance, please open AnyDesk, enter your 9-digit address below, and save.</p>
                <div className="flex gap-2 max-w-sm">
                  <Input
                    placeholder="Enter 9-digit AnyDesk ID..."
                    value={anydeskInput}
                    onChange={(e) => setAnydeskInput(e.target.value)}
                    className="h-8 text-xs bg-card border-border/60"
                  />
                  <Button
                    size="sm"
                    disabled={savingAnydesk || !anydeskInput}
                    className="h-8 text-xs bg-primary text-white"
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
            <div className="border border-primary/20 bg-primary/5 p-3 rounded-lg flex flex-wrap gap-3 items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide block">IT Engineering Controls</span>
                <span className="text-muted-foreground text-[10px]">Change ticket progress or reassign support agents.</span>
              </div>
              <div className="flex gap-2 items-center">
                {!ticket.assignedToId && onAssignToMe && (
                  <Button size="sm" onClick={onAssignToMe} className="h-8 text-xs text-white bg-primary">
                    Assign to Me
                  </Button>
                )}
                
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Status:</span>
                  <Select value={ticket.status} onValueChange={handleStatusChange} disabled={changingStatus}>
                    <SelectTrigger className="h-8 text-xs bg-card border-border/60 min-w-[140px]">
                      <SelectValue placeholder={ticket.status} />
                    </SelectTrigger>
                    <SelectContent className="bg-card">
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
              </div>
            </div>
          )}

          {/* Ticket Timeline History */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide border-b border-border/30 pb-1">Activity Timeline & Discussion</h3>
            <div className="space-y-3.5 relative pl-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
              {ticket.updates?.map((up: any) => (
                <div key={up.id} className="relative space-y-1">
                  {/* Timeline bullet */}
                  <div className="absolute -left-[14px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
                  
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80 flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      {up.user?.name || "System"}
                    </span>
                    <span>{formatDistanceToNow(new Date(up.createdAt), { addSuffix: true })}</span>
                  </div>
                  
                  <div className="bg-card/50 p-2.5 rounded border border-border/30 text-xs">
                    <p className="text-foreground/90 leading-relaxed">{up.message}</p>
                    
                    {up.statusFrom !== up.statusTo && (
                      <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-primary">
                        <span>Transition:</span>
                        <Badge className="bg-muted text-muted-foreground border-none text-[8px] scale-90">{up.statusFrom}</Badge>
                        <span>→</span>
                        <Badge className="bg-primary/10 text-primary border-none text-[8px] scale-90">{up.statusTo}</Badge>
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
          <div className="p-3 border-t border-border/40 bg-muted/10 flex-shrink-0">
            <form onSubmit={handleSendComment} className="flex gap-2">
              <Textarea
                placeholder="Write a message or reply..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={1}
                className="h-8.5 text-xs bg-card border-border/60 resize-none flex-grow min-h-0"
              />
              <Button type="submit" size="sm" disabled={submittingComment || !commentText.trim()} className="h-8.5 w-8.5 p-0 bg-primary hover:bg-primary/95 text-white shadow-sm flex items-center justify-center flex-shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </form>
            
            {!isStaff && ticket.status === "RESOLVED" && (
              <div className="mt-2.5 space-y-3 bg-emerald-500/10 p-3 rounded border border-emerald-500/25">
                {!showFeedback ? (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Engineer resolved this incident. Please confirm.
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-6.5 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        onClick={() => setShowFeedback(true)}
                      >
                        Confirm & Close
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6.5 text-[10px] border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                        onClick={() => handleStatusChange("OPEN")}
                      >
                        Reopen Ticket
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wide">
                        Rate Resolution Quality
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[9px] text-muted-foreground hover:bg-transparent"
                        onClick={() => setShowFeedback(false)}
                      >
                        Back
                      </Button>
                    </div>

                    {/* Star Rating Select */}
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="focus:outline-none transition-all hover:scale-110 cursor-pointer"
                          onClick={() => setRating(star)}
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= rating
                                ? "fill-amber-400 text-amber-400"
                                : "text-slate-300"
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-semibold ml-2 text-foreground/80">
                        {rating === 5 ? "Excellent" : rating === 4 ? "Good" : rating === 3 ? "Satisfactory" : rating === 2 ? "Poor" : "Very Dissatisfied"}
                      </span>
                    </div>

                    {/* Satisfaction Note */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold text-muted-foreground uppercase">
                        Additional Feedback (Optional)
                      </label>
                      <Textarea
                        placeholder="Tell us what you liked or how we can improve..."
                        value={ratingNote}
                        onChange={(e) => setRatingNote(e.target.value)}
                        rows={2}
                        className="text-xs bg-card border-border/60"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        disabled={submittingFeedback}
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
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
