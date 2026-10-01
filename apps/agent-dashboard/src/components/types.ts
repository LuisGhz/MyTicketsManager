import type { Department, Ticket } from "@myticketsmanager/ui";

export type TicketQueueItem = Pick<Ticket, "id" | "ticketNumber" | "title" | "status" | "priority" | "createdAt" | "departmentId"> & {
  department?: Pick<Department, "id" | "name">;
};

export interface TicketListResponse {
  items: TicketQueueItem[];
  total: number;
  page: number;
  pageSize: number;
}
