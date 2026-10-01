export type Role = "ADMIN" | "AGENT" | "USER";

export type UserStatus =
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "DISABLED";

export type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "PENDING_USER_RESPONSE"
  | "RESOLVED"
  | "CLOSED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type Priority = TicketPriority;
export type Status = TicketStatus;

export type CloseReason =
  | "RESOLVED"
  | "NO_RESPONSE"
  | "CANCELED"
  | "DUPLICATED";

export type ReassignmentStatus = "PENDING" | "APPROVED" | "REJECTED";
export type Timestamp = string;

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  status: UserStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AuthUser = Pick<User, "id" | "email" | "role"> &
  Partial<Pick<User, "firstName" | "lastName" | "status" | "createdAt" | "updatedAt">>;

export interface Department {
  id: string;
  name: string;
  description: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Attachment {
  id: string;
  filename: string;
  fileUrl: string;
  mimeType: string;
  ticketId: string;
  createdAt: Timestamp;
}

export interface TicketComment {
  id: string;
  content: string;
  ticketId: string;
  authorId: string;
  author?: AuthUser;
  createdAt: Timestamp;
}

export interface ReassignmentRequest {
  id: string;
  ticketId: string;
  requesterId: string;
  targetAgentId: string | null;
  reason: string;
  status: ReassignmentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  requester?: AuthUser;
}

export interface Ticket {
  id: string;
  ticketNumber: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  closeReason: CloseReason | null;
  reporterId: string;
  assigneeId: string | null;
  departmentId: string;
  lastActivityAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reporter?: AuthUser;
  assignee?: AuthUser | null;
  department?: Department;
  attachments?: Attachment[];
  comments?: TicketComment[];
  reassignmentRequests?: ReassignmentRequest[];
}

export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  updatedAt: Timestamp;
}
