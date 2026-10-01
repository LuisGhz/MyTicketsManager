import { Badge, type TicketPriority, type TicketStatus, type User } from "@myticketsmanager/ui";

const statusStyles: Record<TicketStatus, string> = {
  OPEN: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  IN_PROGRESS: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  PENDING_USER_RESPONSE: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
  RESOLVED: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  CLOSED: "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
};

const priorityStyles: Record<TicketPriority, string> = {
  LOW: "border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  MEDIUM: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200",
  HIGH: "border-orange-300 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200",
  URGENT: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
};

export function statusLabel(status: TicketStatus): string {
  return status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function priorityLabel(priority: TicketPriority): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant="outline" className={statusStyles[status]}>{statusLabel(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <Badge variant="outline" className={priorityStyles[priority]}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {priorityLabel(priority)}
    </Badge>
  );
}

type Person = Pick<User, "email"> & Partial<Pick<User, "firstName" | "lastName">>;

export function displayName(user?: Person | null): string {
  if (!user) return "Unknown user";
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
