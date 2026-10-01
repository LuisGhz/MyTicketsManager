import { Button, Input, Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow, type Department, type TicketPriority, type TicketStatus } from "@myticketsmanager/ui";
import { RiSearchLine } from "@remixicon/react";
import type { TicketQueueItem } from "./types";
import { formatDate, PriorityBadge, StatusBadge } from "./ticket-presentation";

export type QueueStatusFilter = "ALL" | TicketStatus;
export type QueuePriorityFilter = "ALL" | TicketPriority;

interface TicketQueueProps {
  tickets: TicketQueueItem[];
  departments: Pick<Department, "id" | "name">[];
  selectedId: string | null;
  isLoading: boolean;
  isSearchingDescriptions: boolean;
  descriptionSearchError: boolean;
  search: string;
  status: QueueStatusFilter;
  priority: QueuePriorityFilter;
  departmentId: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: QueueStatusFilter) => void;
  onPriorityChange: (value: QueuePriorityFilter) => void;
  onDepartmentChange: (value: string) => void;
  onSelect: (ticketId: string) => void;
}

const selectClassName = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:bg-card";

export function TicketQueue({
  tickets,
  departments,
  selectedId,
  isLoading,
  isSearchingDescriptions,
  descriptionSearchError,
  search,
  status,
  priority,
  departmentId,
  onSearchChange,
  onStatusChange,
  onPriorityChange,
  onDepartmentChange,
  onSelect,
}: TicketQueueProps) {
  return (
    <section aria-labelledby="queue-heading" className="min-w-0">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Work queue</p>
          <h2 id="queue-heading" className="mt-1 text-xl font-semibold">All tickets <span className="text-base font-normal text-muted-foreground">({tickets.length})</span></h2>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor="ticket-search" className="mb-1.5 block text-sm font-medium">Search tickets</label>
          <div className="relative">
            <RiSearchLine aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="ticket-search"
              type="search"
              value={search}
              onChange={(event) => onSearchChange(event.currentTarget.value)}
              placeholder="Title, description, or ticket number"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <label htmlFor="ticket-status-filter" className="mb-1.5 block text-sm font-medium">Status</label>
          <select id="ticket-status-filter" className={selectClassName} value={status} onChange={(event) => onStatusChange(event.currentTarget.value as QueueStatusFilter)}>
            <option value="ALL">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="PENDING_USER_RESPONSE">Pending user response</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <div>
          <label htmlFor="ticket-priority-filter" className="mb-1.5 block text-sm font-medium">Priority</label>
          <select id="ticket-priority-filter" className={selectClassName} value={priority} onChange={(event) => onPriorityChange(event.currentTarget.value as QueuePriorityFilter)}>
            <option value="ALL">All priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="ticket-department-filter" className="mb-1.5 block text-sm font-medium">Department</label>
          <select id="ticket-department-filter" className={selectClassName} value={departmentId} onChange={(event) => onDepartmentChange(event.currentTarget.value)}>
            <option value="ALL">All departments</option>
            {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
          </select>
        </div>
      </div>

      {isSearchingDescriptions && <p className="mb-3 text-sm text-muted-foreground" role="status">Checking ticket descriptions…</p>}
      {descriptionSearchError && <p className="mb-3 text-sm text-amber-800 dark:text-amber-200" role="status">Description search is temporarily unavailable. Matches by ticket title and number are still shown.</p>}

      <div className="md:hidden">
        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading tickets…</p> : tickets.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No tickets match these filters.</p> : (
          <ul className="space-y-2" aria-label="Ticket queue">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Button
                  type="button"
                  variant="outline"
                  className={`h-auto w-full justify-start whitespace-normal rounded-md p-4 text-left ${selectedId === ticket.id ? "border-primary bg-primary/5" : "bg-card"}`}
                  aria-label={`Open ticket ${ticket.ticketNumber}: ${ticket.title}`}
                  aria-current={selectedId === ticket.id ? "true" : undefined}
                  onClick={() => onSelect(ticket.id)}
                >
                  <span className="block w-full min-w-0">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-xs font-semibold text-muted-foreground">#{ticket.ticketNumber}</span>
                      <StatusBadge status={ticket.status} />
                    </span>
                    <span className="mt-2 block break-words font-medium text-foreground">{ticket.title}</span>
                    <span className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <PriorityBadge priority={ticket.priority} />
                      <span className="text-xs text-muted-foreground">{ticket.department?.name ?? "No department"}</span>
                    </span>
                    <span className="mt-2 block text-xs text-muted-foreground">Created {formatDate(ticket.createdAt)}</span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-md border border-border bg-card md:block">
        <Table>
          <TableCaption className="sr-only">All tickets matching the selected search and filters.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Ticket</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col">Priority</TableHead>
              <TableHead scope="col">Department</TableHead>
              <TableHead scope="col">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">Loading tickets…</TableCell></TableRow> : tickets.length === 0 ? <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No tickets match these filters.</TableCell></TableRow> : tickets.map((ticket) => (
              <TableRow key={ticket.id} aria-selected={selectedId === ticket.id}>
                <TableHead scope="row" className="max-w-64">
                  <Button type="button" variant="link" className="h-auto justify-start whitespace-normal p-0 text-left font-medium" aria-label={`Open ticket ${ticket.ticketNumber}: ${ticket.title}`} onClick={() => onSelect(ticket.id)}>
                    <span className="mr-2 shrink-0 text-xs font-semibold text-muted-foreground">#{ticket.ticketNumber}</span>
                    <span className="line-clamp-2">{ticket.title}</span>
                  </Button>
                </TableHead>
                <TableCell><StatusBadge status={ticket.status} /></TableCell>
                <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                <TableCell className="max-w-40 truncate">{ticket.department?.name ?? "No department"}</TableCell>
                <TableCell>{formatDate(ticket.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
