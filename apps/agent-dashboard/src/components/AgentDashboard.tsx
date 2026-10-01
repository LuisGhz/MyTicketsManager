import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import { RiCloseLine, RiRefreshLine } from "@remixicon/react";
import { ApiError, apiClient, Button, Navbar, PageWrapper, useAuthStore, useToastStore, type ReassignmentRequest, type Ticket, type TicketComment, type TicketStatus } from "@myticketsmanager/ui";
import { TicketDetail } from "./TicketDetail";
import { TicketQueue, type QueuePriorityFilter, type QueueStatusFilter } from "./TicketQueue";
import type { TicketListResponse, TicketQueueItem } from "./types";

async function fetchAllTickets(): Promise<TicketQueueItem[]> {
  const tickets: TicketQueueItem[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (tickets.length < total) {
    const response = await apiClient.get<TicketListResponse>(`/tickets?page=${page}&pageSize=100`);
    tickets.push(...response.items);
    total = response.total;
    if (response.items.length === 0) break;
    page += 1;
  }

  return tickets;
}

async function fetchTicketDetails(tickets: TicketQueueItem[]): Promise<Ticket[]> {
  const fullTickets: Ticket[] = [];
  const batchSize = 8;

  for (let index = 0; index < tickets.length; index += batchSize) {
    const batch = tickets.slice(index, index + batchSize);
    const details = await Promise.all(batch.map((ticket) => apiClient.get<Ticket>(`/tickets/${ticket.id}`)));
    fullTickets.push(...details);
  }

  return fullTickets;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "The request could not be completed.";
}

function NotificationRegion() {
  const notifications = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (notifications.length === 0) return null;

  return (
    <aside aria-label="Notifications" className="fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm space-y-2 sm:right-4 sm:left-auto sm:mx-0 sm:w-full">
      {notifications.map((notification) => (
        <div key={notification.id} role={notification.variant === "error" ? "alert" : "status"} className="flex items-start gap-3 rounded-md border border-border bg-card p-4 text-card-foreground shadow-lg">
          <div className="min-w-0 flex-1">
            {notification.title && <p className="text-sm font-semibold">{notification.title}</p>}
            {notification.description && <p className="mt-1 text-sm text-muted-foreground">{notification.description}</p>}
          </div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss notification" onClick={() => dismissToast(notification.id)}>
            <RiCloseLine aria-hidden="true" />
          </Button>
        </div>
      ))}
    </aside>
  );
}

export function AgentDashboard() {
  const agent = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  const [tickets, setTickets] = useState<TicketQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Ticket | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<QueuePriorityFilter>("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [descriptionIndex, setDescriptionIndex] = useState<Map<string, Ticket> | null>(null);
  const [isSearchingDescriptions, setIsSearchingDescriptions] = useState(false);
  const [descriptionSearchError, setDescriptionSearchError] = useState(false);
  const descriptionRequestStarted = useRef(false);

  const handleSelectTicket = useCallback((id: string | null) => {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setIsDetailLoading(Boolean(id));
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void fetchAllTickets()
      .then((items) => {
        if (isCurrent) setTickets(items);
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => { isCurrent = false; };
  }, [refreshVersion]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    let isCurrent = true;

    void apiClient.get<Ticket>(`/tickets/${selectedId}`)
      .then((ticket) => {
        if (isCurrent) setDetail(ticket);
      })
      .catch((error: unknown) => {
        if (isCurrent) setDetailError(errorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setIsDetailLoading(false);
      });

    return () => { isCurrent = false; };
  }, [selectedId]);

  useEffect(() => {
    if (!deferredSearch.trim() || descriptionIndex || descriptionRequestStarted.current || tickets.length === 0) return;
    descriptionRequestStarted.current = true;
    let isCurrent = true;
    setIsSearchingDescriptions(true);
    setDescriptionSearchError(false);

    void fetchTicketDetails(tickets)
      .then((items) => {
        if (isCurrent) setDescriptionIndex(new Map(items.map((ticket) => [ticket.id, ticket])));
      })
      .catch(() => {
        if (isCurrent) setDescriptionSearchError(true);
      })
      .finally(() => {
        if (isCurrent) setIsSearchingDescriptions(false);
      });

    return () => { isCurrent = false; };
  }, [deferredSearch, descriptionIndex, tickets]);

  const departments = Array.from(new Map(
    tickets.flatMap((ticket) => ticket.department ? [[ticket.department.id, ticket.department] as const] : []),
  ).values());

  const filteredTickets = tickets.filter((ticket) => {
    if (statusFilter !== "ALL" && ticket.status !== statusFilter) return false;
    if (priorityFilter !== "ALL" && ticket.priority !== priorityFilter) return false;
    if (departmentFilter !== "ALL" && ticket.departmentId !== departmentFilter) return false;
    const query = deferredSearch.trim().toLocaleLowerCase();
    if (!query) return true;
    const fullTicket = descriptionIndex?.get(ticket.id);
    const searchableText = `${ticket.ticketNumber} ${ticket.title} ${fullTicket?.description ?? ""}`.toLocaleLowerCase();
    return searchableText.includes(query) || `#${ticket.ticketNumber}`.includes(query);
  });

  const statusCount = (status: TicketStatus) => tickets.filter((ticket) => ticket.status === status).length;

  const updateStatus = async (status: TicketStatus) => {
    if (!selectedId) return;
    setIsStatusUpdating(true);
    try {
      await apiClient.patch<{ id: string; status: TicketStatus }, { status: TicketStatus }>(`/tickets/${selectedId}/status`, { status });
      setTickets((current) => current.map((ticket) => ticket.id === selectedId ? { ...ticket, status } : ticket));
      setDetail((current) => current?.id === selectedId ? { ...current, status } : current);
      addToast({ title: "Ticket updated", description: `Status changed to ${status.replaceAll("_", " ").toLowerCase()}.`, variant: "success" });
    } catch (error) {
      addToast({ title: "Status update failed", description: errorMessage(error), variant: "error" });
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const addComment = async (content: string): Promise<boolean> => {
    if (!selectedId) return false;
    try {
      const newComment = await apiClient.post<TicketComment, { content: string }>(`/tickets/${selectedId}/comments`, { content });
      setDetail((current) => current?.id === selectedId ? { ...current, comments: [...(current.comments ?? []), newComment] } : current);
      addToast({ title: "Comment posted", description: "Your reply was added to the conversation.", variant: "success" });
      return true;
    } catch (error) {
      addToast({ title: "Comment could not be posted", description: errorMessage(error), variant: "error" });
      return false;
    }
  };

  const requestReassignment = async (reason: string, targetAgentId?: string) => {
    if (!selectedId) return;
    const body = { reason, ...(targetAgentId ? { targetAgentId } : {}) };
    try {
      await apiClient.post<ReassignmentRequest, typeof body>(`/tickets/${selectedId}/reassignment-request`, body);
      addToast({ title: "Reassignment requested", description: "An administrator has been notified.", variant: "success" });
    } catch (error) {
      addToast({ title: "Reassignment request failed", description: errorMessage(error), variant: "error" });
    }
  };

  const refreshQueue = () => {
    descriptionRequestStarted.current = false;
    setDescriptionIndex(null);
    setRefreshVersion((version) => version + 1);
  };

  return (
    <>
      <Navbar brandName="Ticket Desk" links={[]} />
      <PageWrapper className="py-5 sm:py-7">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agent workspace</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">Ticket queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">{agent?.firstName ? `Welcome, ${agent.firstName}` : "Review and resolve incoming requests."}</p>
          </div>
          <Button type="button" variant="outline" onClick={refreshQueue} disabled={isLoading}>
            <RiRefreshLine aria-hidden="true" />
            Refresh queue
          </Button>
        </header>

        <section aria-label="Queue overview" className="mb-6 grid grid-cols-1 gap-y-3 border-b border-border pb-5 sm:grid-cols-3 sm:gap-x-6">
          <div><p className="text-sm text-muted-foreground">Open</p><p className="mt-1 text-xl font-semibold tabular-nums">{statusCount("OPEN")}</p></div>
          <div className="sm:border-l sm:border-border sm:pl-6"><p className="text-sm text-muted-foreground">In progress</p><p className="mt-1 text-xl font-semibold tabular-nums">{statusCount("IN_PROGRESS")}</p></div>
          <div className="sm:border-l sm:border-border sm:pl-6"><p className="text-sm text-muted-foreground">Awaiting user</p><p className="mt-1 text-xl font-semibold tabular-nums">{statusCount("PENDING_USER_RESPONSE")}</p></div>
        </section>

        {loadError && <div role="alert" className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"><p className="font-semibold">Could not load tickets</p><p className="mt-1">{loadError}</p></div>}

        <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] lg:gap-6">
          <div className={selectedId ? "hidden lg:block" : "block"}>
            <TicketQueue
              tickets={filteredTickets}
              departments={departments}
              selectedId={selectedId}
              isLoading={isLoading}
              isSearchingDescriptions={isSearchingDescriptions}
              descriptionSearchError={descriptionSearchError}
              search={search}
              status={statusFilter}
              priority={priorityFilter}
              departmentId={departmentFilter}
              onSearchChange={setSearch}
              onStatusChange={setStatusFilter}
              onPriorityChange={setPriorityFilter}
              onDepartmentChange={setDepartmentFilter}
              onSelect={handleSelectTicket}
            />
          </div>
          <div className={selectedId ? "block min-w-0" : "hidden min-w-0 lg:block"}>
            {detailError ? (
              <section role="alert" className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
                <p className="font-semibold">Could not load ticket details</p>
                <p className="mt-1">{detailError}</p>
                <Button type="button" variant="outline" className="mt-3" onClick={() => handleSelectTicket(null)}>Back to all tickets</Button>
              </section>
            ) : (
              <TicketDetail
                key={selectedId ?? "no-ticket"}
                ticket={detail}
                isLoading={isDetailLoading}
                isStatusUpdating={isStatusUpdating}
                onBack={() => handleSelectTicket(null)}
                onStatusChange={updateStatus}
                onAddComment={addComment}
                onRequestReassignment={requestReassignment}
              />
            )}
          </div>
        </div>
      </PageWrapper>
      <NotificationRegion />
    </>
  );
}
