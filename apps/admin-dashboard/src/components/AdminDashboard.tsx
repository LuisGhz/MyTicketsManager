import {
  RiBuilding2Line,
  RiCloseLine,
  RiGitPullRequestLine,
  RiSettings3Line,
  RiUserAddLine,
} from "@remixicon/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  Badge,
  Button,
  Input,
  ThemeToggle,
  apiClient,
  useToastStore,
  type Department,
  type ReassignmentRequest,
  type Role,
  type SystemConfig,
  type Ticket,
  type User,
  type UserStatus,
} from "@myticketsmanager/ui";

type TabId = "users" | "requests" | "departments" | "configuration";
type ProvisioningRole = Extract<Role, "USER" | "AGENT">;

interface ReassignmentRow extends ReassignmentRequest {
  ticket?: Pick<Ticket, "ticketNumber" | "title">;
  targetAgent?: { id: string; firstName: string; lastName: string; email: string } | null;
}

interface AdminUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: ProvisioningRole;
}

interface DepartmentPayload {
  name: string;
  description?: string;
}

interface ReviewRequestPayload {
  action: "APPROVE" | "REJECT";
  assigneeId?: string;
}

const tabs: { id: TabId; label: string; icon: typeof RiUserAddLine }[] = [
  { id: "users", label: "Users & agents", icon: RiUserAddLine },
  { id: "requests", label: "Assignment requests", icon: RiGitPullRequestLine },
  { id: "departments", label: "Departments", icon: RiBuilding2Line },
  { id: "configuration", label: "System configuration", icon: RiSettings3Line },
];

const inactivityConfigKey = "INACTIVITY_DAYS_BEFORE_CLOSE";

function formatDate(value?: string): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function ErrorNotice({ children }: { children: string }) {
  return <p className="admin-error" role="alert">{children}</p>;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p className="field-error" id={id}>{message}</p> : null;
}

function ToastRegion() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  return (
    <ol className="admin-toast-region" aria-label="Notifications">
      {toasts.map((toast) => (
        <li
          className={`admin-toast admin-toast-${toast.variant}`}
          key={toast.id}
          role={toast.variant === "error" ? "alert" : "status"}
          aria-live={toast.variant === "error" ? "assertive" : "polite"}
        >
          <div>
            {toast.title && <strong>{toast.title}</strong>}
            {toast.description && <p>{toast.description}</p>}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss notification"
            onClick={() => dismissToast(toast.id)}
          >
            <RiCloseLine aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ol>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="section-heading">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </header>
  );
}

function StatusBadge({ status }: { status: UserStatus | ReassignmentRequest["status"] }) {
  const className = `status-badge status-${status.toLowerCase().replaceAll("_", "-")}`;
  return <Badge variant="outline" className={className}>{status.replaceAll("_", " ")}</Badge>;
}

function UserProvisioning() {
  const addToast = useToastStore((state) => state.addToast);
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<ProvisioningRole>("AGENT");
  const [errors, setErrors] = useState<Partial<Record<keyof AdminUserPayload, string>>>({});
  const [requestError, setRequestError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof AdminUserPayload, string>> = {};
    const normalizedEmail = email.trim();
    if (!normalizedEmail) nextErrors.email = "Enter an email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!firstName.trim()) nextErrors.firstName = "Enter a first name.";
    if (!lastName.trim()) nextErrors.lastName = "Enter a last name.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: AdminUserPayload = {
      email: normalizedEmail,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
    };
    setRequestError("");
    setIsSubmitting(true);
    try {
      const createdUser = await apiClient.post<User, AdminUserPayload>("admin/users", payload);
      setUsers((currentUsers) => [createdUser, ...currentUsers]);
      setEmail("");
      setFirstName("");
      setLastName("");
      setErrors({});
      addToast({
        title: "Invitation sent",
        description: `${createdUser.email} was provisioned and sent an activation email.`,
        variant: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setRequestError(message);
      addToast({ title: "Could not provision account", description: message, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="admin-view">
      <SectionHeading
        eyebrow="Identity & access"
        title="Users and agents"
        description="Provision customer and support accounts, then track their activation status."
      />

      <div className="provisioning-layout">
        <section className="admin-card invite-card" aria-labelledby="invite-heading">
          <div className="card-heading">
            <div>
              <p className="section-eyebrow">New account</p>
              <h3 id="invite-heading">Send an invitation</h3>
            </div>
            <span className="card-icon"><RiUserAddLine aria-hidden="true" /></span>
          </div>
          <p className="card-copy">
            Provisioned accounts start with <code>PENDING_VERIFICATION</code>. A secure
            activation email is dispatched via Resend.
          </p>
          <form className="admin-form" onSubmit={handleSubmit} noValidate>
            <div className="form-grid">
              <div className="field-group">
                <label htmlFor="provision-email">Email <span className="required-mark">Required</span></label>
                <Input
                  autoComplete="email"
                  id="provision-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={`provision-email-help${errors.email ? " provision-email-error" : ""}`}
                  required
                />
                <p className="field-help" id="provision-email-help">Use the address where the activation link should arrive.</p>
                <FieldError id="provision-email-error" message={errors.email} />
              </div>
              <div className="field-group">
                <label htmlFor="provision-role">Role <span className="required-mark">Required</span></label>
                <select
                  id="provision-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value as ProvisioningRole)}
                  required
                  aria-describedby="provision-role-help"
                >
                  <option value="AGENT">Agent</option>
                  <option value="USER">User</option>
                </select>
                <p className="field-help" id="provision-role-help">Administrator access cannot be assigned here.</p>
              </div>
              <div className="field-group">
                <label htmlFor="provision-first-name">First name <span className="required-mark">Required</span></label>
                <Input
                  autoComplete="given-name"
                  id="provision-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  aria-invalid={Boolean(errors.firstName)}
                  aria-describedby={`provision-first-name-help${errors.firstName ? " provision-first-name-error" : ""}`}
                  required
                />
                <p className="field-help" id="provision-first-name-help">Enter the account holder's given name.</p>
                <FieldError id="provision-first-name-error" message={errors.firstName} />
              </div>
              <div className="field-group">
                <label htmlFor="provision-last-name">Last name <span className="required-mark">Required</span></label>
                <Input
                  autoComplete="family-name"
                  id="provision-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  aria-invalid={Boolean(errors.lastName)}
                  aria-describedby={`provision-last-name-help${errors.lastName ? " provision-last-name-error" : ""}`}
                  required
                />
                <p className="field-help" id="provision-last-name-help">Enter the account holder's family name.</p>
                <FieldError id="provision-last-name-error" message={errors.lastName} />
              </div>
            </div>
            {requestError && <ErrorNotice>{requestError}</ErrorNotice>}
            <div className="form-actions">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Sending invitation..." : "Send invitation"}
              </Button>
            </div>
          </form>
        </section>

        <section className="admin-card user-list-card" aria-labelledby="provisioned-heading">
          <div className="card-heading">
            <div>
              <p className="section-eyebrow">Provisioning activity</p>
              <h3 id="provisioned-heading">Recently provisioned</h3>
            </div>
            <span className="count-chip" aria-label={`${users.length} accounts provisioned this visit`}>{users.length}</span>
          </div>
          <p className="card-copy">
            This list shows accounts created during this visit. The current admin API does not
            provide a user-list endpoint.
          </p>
          {users.length === 0 ? (
            <div className="empty-state">
              <span className="empty-mark"><RiUserAddLine aria-hidden="true" /></span>
              <p>No accounts provisioned in this visit.</p>
              <span>New invitations will appear here with their current status.</span>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <caption className="sr-only">Accounts provisioned during this visit</caption>
                <thead>
                  <tr><th scope="col">Account</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Created</th></tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td data-label="Account"><strong>{user.firstName} {user.lastName}</strong><span>{user.email}</span></td>
                      <td data-label="Role">{user.role}</td>
                      <td data-label="Status"><StatusBadge status={user.status} /></td>
                      <td data-label="Created">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AssignmentRequests() {
  const addToast = useToastStore((state) => state.addToast);
  const [requests, setRequests] = useState<ReassignmentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [resolvingIds, setResolvingIds] = useState<string[]>([]);
  const [assignedAgentIds, setAssignedAgentIds] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    apiClient.get<ReassignmentRow[]>("admin/reassignment-requests?status=PENDING")
      .then((result) => {
        if (isCurrent) setRequests(result);
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoadingError(getErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [refreshKey]);

  async function reviewRequest(request: ReassignmentRow, action: "APPROVE" | "REJECT") {
    setReviewError("");
    setResolvingIds((currentIds) => [...currentIds, request.id]);
    try {
      const assigneeId = request.targetAgentId ?? assignedAgentIds[request.id]?.trim();
      const payload: ReviewRequestPayload = {
        action,
        ...(action === "APPROVE" && assigneeId ? { assigneeId } : {}),
      };
      await apiClient.patch<ReassignmentRequest, ReviewRequestPayload>(
        `admin/reassignment-requests/${encodeURIComponent(request.id)}`,
        payload,
      );
      setRequests((currentRequests) => currentRequests.filter(({ id }) => id !== request.id));
      setAssignedAgentIds((currentIds) => {
        return Object.fromEntries(
          Object.entries(currentIds).filter(([id]) => id !== request.id),
        );
      });
      addToast({
        title: action === "APPROVE" ? "Request approved" : "Request rejected",
        description: `Ticket #${request.ticket?.ticketNumber ?? request.ticketId} has been updated.`,
        variant: "success",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setReviewError(message);
      addToast({ title: "Request could not be updated", description: message, variant: "error" });
    } finally {
      setResolvingIds((currentIds) => currentIds.filter((id) => id !== request.id));
    }
  }

  return (
    <div className="admin-view">
      <SectionHeading
        eyebrow="Work distribution"
        title="Assignment requests"
        description="Review and resolve pending requests from the support team."
      />
      <section className="admin-card" aria-labelledby="request-queue-heading">
        <div className="card-heading request-heading">
          <div>
            <p className="section-eyebrow">Review queue</p>
            <h3 id="request-queue-heading">Pending reassignment requests</h3>
          </div>
          <div className="heading-actions">
            <span className="count-chip" aria-label={`${requests.length} pending requests`}>{requests.length}</span>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsLoading(true);
                setLoadingError("");
                setRefreshKey((currentKey) => currentKey + 1);
              }}
              disabled={isLoading}
            >
              {isLoading ? "Refreshing..." : "Refresh queue"}
            </Button>
          </div>
        </div>
        {loadingError && <ErrorNotice>{loadingError}</ErrorNotice>}
        {reviewError && <ErrorNotice>{reviewError}</ErrorNotice>}
        {isLoading ? (
          <p className="loading-state" role="status">Loading requests...</p>
        ) : loadingError ? (
          <p className="loading-state" role="status">The queue could not be loaded. Refresh after resolving the error.</p>
        ) : requests.length === 0 ? (
          <div className="empty-state compact-empty">
            <span className="empty-mark"><RiGitPullRequestLine aria-hidden="true" /></span>
            <p>The review queue is clear.</p>
            <span>Pending requests will appear here.</span>
          </div>
        ) : (
          <ul className="request-list">
            {requests.map((request) => {
              const requesterName = request.requester
                ? `${request.requester.firstName ?? ""} ${request.requester.lastName ?? ""}`.trim()
                : request.requesterId;
              const targetName = request.targetAgent
                ? `${request.targetAgent.firstName} ${request.targetAgent.lastName}`.trim()
                : "Unspecified";
              const isResolving = resolvingIds.includes(request.id);
              const approveDescriptionId = `approve-note-${request.id}`;
              const agentInputId = `approve-agent-${request.id}`;

              return (
                <li className="request-item" key={request.id}>
                  <div className="request-main">
                    <div className="request-ticket">
                      <span className="ticket-number">Ticket #{request.ticket?.ticketNumber ?? "Unknown"}</span>
                      <h4>{request.ticket?.title ?? "Ticket details unavailable"}</h4>
                      <p className="request-id">Request ID <code>{request.id}</code></p>
                    </div>
                    <dl className="request-details">
                      <div><dt>Requester agent</dt><dd>{requesterName || request.requesterId}</dd></div>
                      <div><dt>Target agent</dt><dd>{targetName}</dd></div>
                      <div><dt>Reason</dt><dd>{request.reason}</dd></div>
                      <div><dt>Request date</dt><dd>{formatDate(request.createdAt)}</dd></div>
                      <div><dt>Current status</dt><dd><StatusBadge status={request.status} /></dd></div>
                    </dl>
                  </div>
                  <div className="request-actions" aria-label={`Actions for request ${request.id}`}>
                    {!request.targetAgentId && (
                      <div className="action-agent-field">
                        <label htmlFor={agentInputId}>Active agent ID</label>
                        <Input
                          id={agentInputId}
                          value={assignedAgentIds[request.id] ?? ""}
                          onChange={(event) => setAssignedAgentIds((currentIds) => ({
                            ...currentIds,
                            [request.id]: event.target.value,
                          }))}
                          aria-describedby={approveDescriptionId}
                          autoComplete="off"
                        />
                        <p id={approveDescriptionId} className="action-hint">
                          Enter an active agent's ID to assign this ticket during approval.
                        </p>
                      </div>
                    )}
                    <Button
                      type="button"
                      disabled={isResolving || (!request.targetAgentId && !assignedAgentIds[request.id]?.trim())}
                      aria-describedby={!request.targetAgentId ? approveDescriptionId : undefined}
                      onClick={() => void reviewRequest(request, "APPROVE")}
                    >
                      {isResolving ? "Updating..." : "Approve"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isResolving}
                      onClick={() => void reviewRequest(request, "REJECT")}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function DepartmentManager() {
  const addToast = useToastStore((state) => state.addToast);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    apiClient.get<Department[]>("admin/departments")
      .then((result) => {
        if (isCurrent) setDepartments(result);
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoadingError(getErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, [refreshKey]);

  async function createDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Enter a department name.");
      return;
    }
    setFormError("");
    try {
      const payload: DepartmentPayload = {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
      };
      const department = await apiClient.post<Department, DepartmentPayload>("admin/departments", payload);
      setDepartments((currentDepartments) => [department, ...currentDepartments]);
      setName("");
      setDescription("");
      addToast({ title: "Department created", description: department.name, variant: "success" });
    } catch (error) {
      const message = getErrorMessage(error);
      setFormError(message);
      addToast({ title: "Department could not be created", description: message, variant: "error" });
    }
  }

  function startEditing(department: Department) {
    setEditingId(department.id);
    setEditName(department.name);
    setEditDescription(department.description ?? "");
    setFormError("");
  }

  async function updateDepartment(event: FormEvent<HTMLFormElement>, departmentId: string) {
    event.preventDefault();
    if (!editName.trim()) {
      setFormError("Enter a department name.");
      return;
    }
    setBusyIds((currentIds) => [...currentIds, departmentId]);
    setFormError("");
    try {
      const payload: DepartmentPayload = {
        name: editName.trim(),
        description: editDescription.trim(),
      };
      const updatedDepartment = await apiClient.put<Department, DepartmentPayload>(
        `admin/departments/${encodeURIComponent(departmentId)}`,
        payload,
      );
      setDepartments((currentDepartments) => currentDepartments.map((department) =>
        department.id === departmentId ? updatedDepartment : department,
      ));
      setEditingId(null);
      addToast({ title: "Department updated", description: updatedDepartment.name, variant: "success" });
    } catch (error) {
      const message = getErrorMessage(error);
      setFormError(message);
      addToast({ title: "Department could not be updated", description: message, variant: "error" });
    } finally {
      setBusyIds((currentIds) => currentIds.filter((id) => id !== departmentId));
    }
  }

  async function deleteDepartment(department: Department) {
    if (typeof window !== "undefined" && !window.confirm(`Delete the ${department.name} department?`)) return;
    setBusyIds((currentIds) => [...currentIds, department.id]);
    try {
      await apiClient.delete<void>(`admin/departments/${encodeURIComponent(department.id)}`);
      setDepartments((currentDepartments) => currentDepartments.filter(({ id }) => id !== department.id));
      addToast({ title: "Department deleted", description: department.name, variant: "success" });
    } catch (error) {
      const message = getErrorMessage(error);
      setFormError(message);
      addToast({ title: "Department could not be deleted", description: message, variant: "error" });
    } finally {
      setBusyIds((currentIds) => currentIds.filter((id) => id !== department.id));
    }
  }

  return (
    <div className="admin-view">
      <SectionHeading
        eyebrow="Service structure"
        title="Departments"
        description="Maintain the departments used to categorize and route support work."
      />
      <div className="department-layout">
        <section className="admin-card department-create" aria-labelledby="department-create-heading">
          <div className="card-heading">
            <div>
              <p className="section-eyebrow">Add a department</p>
              <h3 id="department-create-heading">Create department</h3>
            </div>
            <span className="card-icon"><RiBuilding2Line aria-hidden="true" /></span>
          </div>
          <form className="admin-form" onSubmit={createDepartment}>
            <div className="field-group">
              <label htmlFor="department-name">Name <span className="required-mark">Required</span></label>
              <Input
                id="department-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={Boolean(formError && !name.trim())}
                aria-describedby="department-name-help department-name-error"
                required
              />
              <p className="field-help" id="department-name-help">Choose a clear name that agents will recognize.</p>
              <FieldError id="department-name-error" message={formError && !name.trim() ? formError : undefined} />
            </div>
            <div className="field-group">
              <label htmlFor="department-description">Description <span className="optional-mark">Optional</span></label>
              <textarea
                id="department-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                aria-describedby="department-description-help"
              />
              <p className="field-help" id="department-description-help">Add a short note about the work this department handles.</p>
            </div>
            {formError && <ErrorNotice>{formError}</ErrorNotice>}
            <Button type="submit">Create department</Button>
          </form>
        </section>

        <section className="admin-card department-list-card" aria-labelledby="department-list-heading">
          <div className="card-heading">
            <div>
              <p className="section-eyebrow">Directory</p>
              <h3 id="department-list-heading">All departments</h3>
            </div>
            <div className="heading-actions">
              <span className="count-chip" aria-label={`${departments.length} departments`}>{departments.length}</span>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsLoading(true);
                  setLoadingError("");
                  setRefreshKey((currentKey) => currentKey + 1);
                }}
                disabled={isLoading}
              >
                {isLoading ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </div>
          {loadingError && <ErrorNotice>{loadingError}</ErrorNotice>}
          {isLoading ? (
            <p className="loading-state" role="status">Loading departments...</p>
          ) : loadingError ? (
            <p className="loading-state" role="status">Departments could not be loaded. Refresh after resolving the error.</p>
          ) : departments.length === 0 ? (
            <div className="empty-state compact-empty"><p>No departments yet.</p><span>Create one to start organizing tickets.</span></div>
          ) : (
            <ul className="department-list">
              {departments.map((department) => {
                const isBusy = busyIds.includes(department.id);
                const isEditing = editingId === department.id;
                return (
                  <li className="department-item" key={department.id}>
                    {isEditing ? (
                      <form className="department-edit-form" onSubmit={(event) => void updateDepartment(event, department.id)}>
                        <div className="field-group">
                          <label htmlFor={`edit-department-name-${department.id}`}>Name <span className="required-mark">Required</span></label>
                          <Input
                            id={`edit-department-name-${department.id}`}
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            aria-invalid={Boolean(formError && !editName.trim())}
                            aria-describedby={`edit-department-name-help-${department.id}`}
                            required
                          />
                          <p className="field-help" id={`edit-department-name-help-${department.id}`}>Department name cannot be blank.</p>
                        </div>
                        <div className="field-group">
                          <label htmlFor={`edit-department-description-${department.id}`}>Description <span className="optional-mark">Optional</span></label>
                          <textarea
                            id={`edit-department-description-${department.id}`}
                            value={editDescription}
                            onChange={(event) => setEditDescription(event.target.value)}
                            rows={2}
                          />
                        </div>
                        {formError && <ErrorNotice>{formError}</ErrorNotice>}
                        <div className="inline-actions">
                          <Button type="submit" disabled={isBusy}>{isBusy ? "Saving..." : "Save changes"}</Button>
                          <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="department-copy">
                          <h4>{department.name}</h4>
                          <p>{department.description || "No description provided."}</p>
                          <span>Created {formatDate(department.createdAt)}</span>
                        </div>
                        <div className="inline-actions">
                          <Button type="button" variant="outline" size="sm" onClick={() => startEditing(department)} disabled={isBusy}>Edit</Button>
                          <Button type="button" variant="destructive" size="sm" onClick={() => void deleteDepartment(department)} disabled={isBusy}>Delete</Button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SystemConfiguration() {
  const addToast = useToastStore((state) => state.addToast);
  const [days, setDays] = useState("7");
  const [savedConfig, setSavedConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [daysError, setDaysError] = useState("");

  useEffect(() => {
    let isCurrent = true;
    apiClient.get<SystemConfig[]>("admin/config")
      .then((configs) => {
        if (!isCurrent) return;
        const inactivityConfig = configs.find(({ key }) => key === inactivityConfigKey);
        if (inactivityConfig) {
          setSavedConfig(inactivityConfig);
          setDays(inactivityConfig.value);
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });
    return () => { isCurrent = false; };
  }, []);

  async function saveConfiguration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[1-9]\d*$/.test(days) || !Number.isSafeInteger(Number(days))) {
      setDaysError("Enter a positive whole number of days.");
      return;
    }
    setDaysError("");
    setSaveError("");
    setIsSaving(true);
    try {
      const updated = await apiClient.patch<SystemConfig, { key: string; value: string }>("admin/config", {
        key: inactivityConfigKey,
        value: days,
      });
      setSavedConfig(updated);
      setDays(updated.value);
      addToast({ title: "Configuration saved", description: `Tickets close after ${updated.value} inactive days.`, variant: "success" });
    } catch (error) {
      const message = getErrorMessage(error);
      setSaveError(message);
      addToast({ title: "Configuration could not be saved", description: message, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="admin-view">
      <SectionHeading
        eyebrow="Automation policy"
        title="System configuration"
        description="Set the inactivity threshold used by the scheduled ticket-closing worker."
      />
      <div className="configuration-layout">
        <section className="admin-card config-editor" aria-labelledby="inactivity-heading">
          <div className="card-heading">
            <div>
              <p className="section-eyebrow">Ticket lifecycle</p>
              <h3 id="inactivity-heading">Inactivity threshold</h3>
            </div>
            <span className="card-icon"><RiSettings3Line aria-hidden="true" /></span>
          </div>
          {loadError && <ErrorNotice>{loadError}</ErrorNotice>}
          <p className="card-copy">
            Controls <code>{inactivityConfigKey}</code>. The default is 7 days.
          </p>
          <form className="admin-form" onSubmit={saveConfiguration}>
            <div className="field-group threshold-field">
              <label htmlFor="inactivity-days">Close after <span className="required-mark">Required</span></label>
              <div className="threshold-input-row">
                <Input
                  id="inactivity-days"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  aria-invalid={Boolean(daysError)}
                  aria-describedby={`inactivity-days-help${daysError ? " inactivity-days-error" : ""}`}
                  required
                />
                <span>days of inactivity</span>
              </div>
              <p className="field-help" id="inactivity-days-help">
                Enter a positive whole number. Current saved value: {isLoading ? "Loading..." : `${savedConfig?.value ?? "7"} days`}.
              </p>
              <FieldError id="inactivity-days-error" message={daysError} />
            </div>
            {saveError && <ErrorNotice>{saveError}</ErrorNotice>}
            <Button type="submit" disabled={isSaving || isLoading}>
              {isSaving ? "Saving..." : "Save threshold"}
            </Button>
          </form>
          {savedConfig?.updatedAt && <p className="config-updated">Last updated {formatDate(savedConfig.updatedAt)}</p>}
        </section>

        <section className="admin-card rule-card" aria-labelledby="worker-rules-heading">
          <div className="card-heading">
            <div>
              <p className="section-eyebrow">Scheduled worker</p>
              <h3 id="worker-rules-heading">Automatic closure rules</h3>
            </div>
            <Badge variant="outline" className="worker-label">Cron worker</Badge>
          </div>
          <p className="card-copy">The worker checks ticket inactivity against the configured threshold.</p>
          <ol className="rule-list">
            <li>
              <span className="rule-index">A</span>
              <div><h4>Resolved tickets</h4><p>Tickets in <code>RESOLVED</code> inactive for more than {savedConfig?.value ?? days} days are closed with <code>closeReason = RESOLVED</code>.</p></div>
            </li>
            <li>
              <span className="rule-index">B</span>
              <div><h4>Waiting for the user</h4><p>Tickets in <code>PENDING_USER_RESPONSE</code> inactive for more than {savedConfig?.value ?? days} days are closed with <code>closeReason = NO_RESPONSE</code>.</p></div>
            </li>
          </ol>
          <div className="terminal-notice">
            <strong>Closed tickets are terminal.</strong>
            <p>Once closed, a ticket cannot be reopened.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: TabId) {
    const currentIndex = tabs.findIndex(({ id }) => id === currentTab);
    let nextIndex: number;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  return (
    <div className="admin-app min-h-screen bg-background text-foreground dark:bg-background dark:text-foreground">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <a className="admin-brand" href="#admin-dashboard" aria-label="Ticketdesk administration home">
            <span className="brand-mark" aria-hidden="true">T</span>
            <span><strong>Ticketdesk</strong><small>Administration</small></span>
          </a>
          <div className="topbar-tools">
            <span className="admin-scope"><span className="scope-indicator" aria-hidden="true" />Admin workspace</span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="admin-main" id="admin-dashboard">
        <div className="page-intro">
          <div>
            <p className="section-eyebrow">Control room / Admin</p>
            <h1>Administration</h1>
            <p>Manage access, service structure, assignment decisions, and ticket automation.</p>
          </div>
          <div className="page-stamp"><span>SUPPORT OPERATIONS</span><strong>ADMIN</strong></div>
        </div>

        <div className="admin-tabs" role="tablist" aria-label="Administrative capabilities">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              className="admin-tab"
              id={`admin-tab-${id}`}
              key={id}
              ref={(element) => { tabRefs.current[id] = element; }}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`admin-panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => handleTabKeyDown(event, id)}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <section id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users" tabIndex={0} hidden={activeTab !== "users"}>
          <UserProvisioning />
        </section>
        <section id="admin-panel-requests" role="tabpanel" aria-labelledby="admin-tab-requests" tabIndex={0} hidden={activeTab !== "requests"}>
          <AssignmentRequests />
        </section>
        <section id="admin-panel-departments" role="tabpanel" aria-labelledby="admin-tab-departments" tabIndex={0} hidden={activeTab !== "departments"}>
          <DepartmentManager />
        </section>
        <section id="admin-panel-configuration" role="tabpanel" aria-labelledby="admin-tab-configuration" tabIndex={0} hidden={activeTab !== "configuration"}>
          <SystemConfiguration />
        </section>
      </main>
      <ToastRegion />
    </div>
  );
}