import { useState, type FormEvent } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, type Ticket, type TicketComment, type TicketStatus } from "@myticketsmanager/ui";
import { displayName, formatDate, PriorityBadge, StatusBadge } from "./ticket-presentation";

interface TicketDetailProps {
  ticket: Ticket | null;
  isLoading: boolean;
  isStatusUpdating: boolean;
  onBack: () => void;
  onStatusChange: (status: TicketStatus) => Promise<void>;
  onAddComment: (content: string) => Promise<boolean>;
  onRequestReassignment: (reason: string, targetAgentId?: string) => Promise<void>;
}

function ReassignmentDialog({ onRequest }: { onRequest: TicketDetailProps["onRequestReassignment"] }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [targetAgentId, setTargetAgentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onRequest(reason.trim(), targetAgentId.trim() || undefined).catch(() => undefined);
    } finally {
      setIsSubmitting(false);
      setOpen(false);
      setReason("");
      setTargetAgentId("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>Request reassignment</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request ticket reassignment</DialogTitle>
          <DialogDescription>Send the reason and, optionally, an agent ID to an administrator for review.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submitRequest} className="space-y-4">
          <div>
            <label htmlFor="reassignment-reason" className="mb-1.5 block text-sm font-medium">Reason <span aria-hidden="true">*</span></label>
            <textarea
              id="reassignment-reason"
              required
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-card"
            />
          </div>
          <div>
            <label htmlFor="reassignment-target-agent" className="mb-1.5 block text-sm font-medium">Target agent ID <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              id="reassignment-target-agent"
              value={targetAgentId}
              onChange={(event) => setTargetAgentId(event.currentTarget.value)}
              placeholder="Agent ID"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || !reason.trim()}>{isSubmitting ? "Sending…" : "Send request"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TicketDetail({
  ticket,
  isLoading,
  isStatusUpdating,
  onBack,
  onStatusChange,
  onAddComment,
  onRequestReassignment,
}: TicketDetailProps) {
  const [comment, setComment] = useState("");
  const [isCommenting, setIsCommenting] = useState(false);

  const submitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = comment.trim();
    if (!content) return;
    setIsCommenting(true);
    try {
      if (await onAddComment(content)) setComment("");
    } catch {
      return;
    } finally {
      setIsCommenting(false);
    }
  };

  if (isLoading) {
    return <p className="py-12 text-center text-sm text-muted-foreground" role="status">Loading ticket details…</p>;
  }
  if (!ticket) {
    return (
      <section aria-labelledby="detail-empty-heading" className="flex min-h-72 flex-col items-center justify-center rounded-md border border-dashed border-border px-6 text-center">
        <h2 id="detail-empty-heading" className="text-lg font-semibold">Select a ticket</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">Choose a ticket from the queue to review its details and activity.</p>
      </section>
    );
  }

  const actions: { label: string; status: TicketStatus; variant: "default" | "outline" }[] = [];
  if (ticket.status === "OPEN") actions.push({ label: "Start work", status: "IN_PROGRESS", variant: "default" });
  if (ticket.status === "IN_PROGRESS") {
    actions.push({ label: "Request clarification", status: "PENDING_USER_RESPONSE", variant: "outline" });
    actions.push({ label: "Resolve ticket", status: "RESOLVED", variant: "default" });
  }
  if (ticket.status === "PENDING_USER_RESPONSE") actions.push({ label: "Resolve ticket", status: "RESOLVED", variant: "default" });

  const comments: TicketComment[] = ticket.comments ?? [];

  return (
    <article aria-labelledby="ticket-detail-heading" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="ghost" className="-ml-2" onClick={onBack}>All tickets</Button>
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <Button key={action.status} type="button" variant={action.variant} disabled={isStatusUpdating} onClick={() => void onStatusChange(action.status)}>
              {isStatusUpdating ? "Updating…" : action.label}
            </Button>
          ))}
          {ticket.status !== "CLOSED" && <ReassignmentDialog onRequest={onRequestReassignment} />}
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Ticket #{ticket.ticketNumber}</span>
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
          <CardTitle id="ticket-detail-heading" className="break-words text-xl">{ticket.title}</CardTitle>
          <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Department: {ticket.department?.name ?? "Unknown"}</span>
            <span>Reported by: {displayName(ticket.reporter)}</span>
            <span>Created: <time dateTime={ticket.createdAt}>{formatDate(ticket.createdAt)}</time></span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent><p className="whitespace-pre-wrap break-words text-sm leading-6">{ticket.description}</p></CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
          <CardDescription>{comments.length} {comments.length === 1 ? "comment" : "comments"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : (
            <ol aria-label="Ticket comments in chronological order" className="space-y-4">
              {comments.map((entry) => (
                <li key={entry.id} className="border-l-2 border-border pl-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold">{displayName(entry.author)} <span className="ml-1 text-xs font-normal uppercase text-muted-foreground">{entry.author?.role?.toLowerCase() ?? "member"}</span></p>
                    <time className="text-xs text-muted-foreground" dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{entry.content}</p>
                </li>
              ))}
            </ol>
          )}

          <form onSubmit={submitComment} className="border-t border-border pt-4">
            <label htmlFor="ticket-comment" className="mb-1.5 block text-sm font-medium">Add a comment</label>
            <textarea
              id="ticket-comment"
              required
              maxLength={5000}
              disabled={ticket.status === "CLOSED" || isCommenting}
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              placeholder={ticket.status === "CLOSED" ? "Closed tickets cannot receive comments." : "Write a reply…"}
              className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-card"
            />
            <div className="mt-3 flex justify-end">
              <Button type="submit" disabled={ticket.status === "CLOSED" || isCommenting || !comment.trim()}>{isCommenting ? "Sending…" : "Post comment"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </article>
  );
}
