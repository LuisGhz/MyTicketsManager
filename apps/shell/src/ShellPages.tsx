import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ApiError,
  Badge,
  Button,
  Input,
  PageWrapper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  apiClient,
  useAuthStore,
  useToastStore,
  useToastManager,
} from '@myticketsmanager/ui'
import type { AuthUser, CloseReason, Department, Role, Ticket, TicketComment, TicketPriority, TicketStatus } from '@myticketsmanager/ui'

type ToastVariant = 'success' | 'info' | 'warning' | 'error'

function useNotify() {
  const manager = useToastManager()
  return (variant: ToastVariant, title: string, description: string) => {
    useToastStore.getState().addToast({ variant, title, description })
    manager.add({ title, description, type: variant })
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="text-sm text-destructive" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  )
}

function inputDescription(id: string, hasError: boolean, hasHint = true) {
  return [hasHint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
}

const inputClass = 'min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60'
const selectClass = `${inputClass} pr-8`
const errorBoxClass = 'rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'
const validationProps = {
  onInvalid: (event: FormEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    event.currentTarget.setAttribute('aria-invalid', 'true')
  },
  onInput: (event: FormEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    event.currentTarget.setAttribute('aria-invalid', String(!event.currentTarget.validity.valid))
  },
}

function roleDestination(role: Role) {
  if (role === 'ADMIN') return '/admin'
  if (role === 'AGENT') return '/agent'
  return '/tickets/my'
}

interface LoginResponse {
  accessToken: string
  user: AuthUser
}

interface SetupStatus {
  isSetupAllowed: boolean
}

interface SetupPayload {
  firstName: string
  lastName: string
  email: string
  password: string
}

export function AdminSetupPage() {
  const notify = useNotify()
  const navigate = useNavigate()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [statusError, setStatusError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    apiClient.get<SetupStatus>('auth/setup-status')
      .then((status) => {
        if (!active) return
        if (typeof status !== 'object' || status === null || Array.isArray(status) || typeof status.isSetupAllowed !== 'boolean') {
          setStatusError('The server returned an invalid setup status. Please try again or contact support.')
          return
        }
        setAllowed(status.isSetupAllowed)
      })
      .catch((error: unknown) => {
        if (active) setStatusError(errorMessage(error))
      })
      .finally(() => {
        if (active) setLoadingStatus(false)
      })
    return () => { active = false }
  }, [])

  async function submitSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    const formData = new FormData(event.currentTarget)
    const payload: SetupPayload = {
      firstName: String(formData.get('firstName') ?? '').trim(),
      lastName: String(formData.get('lastName') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    }
    setSubmitting(true)
    try {
      await apiClient.post<AuthUser, SetupPayload>('auth/setup', payload)
      const session = await apiClient.post<LoginResponse, Pick<SetupPayload, 'email' | 'password'>>('auth/login', {
        email: payload.email,
        password: payload.password,
      })
      useAuthStore.getState().login(session.accessToken, session.user)
      notify('success', 'Administrator created', 'Your admin account is ready.')
      navigate('/admin', { replace: true })
    } catch (error) {
      const message = errorMessage(error)
      if (error instanceof ApiError && typeof error.body === 'object' && error.body !== null && 'error' in error.body && error.body.error === 'SETUP_ALREADY_COMPLETED') {
        setAllowed(false)
      }
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageWrapper>
      <section className="mx-auto max-w-xl py-8 sm:py-12">
        <p className="text-sm font-semibold uppercase text-primary-700 dark:text-primary-500">Initial configuration</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-normal">Set up the first administrator</h1>
        {loadingStatus && <p className="mt-6 text-sm text-muted-foreground" role="status">Checking setup status...</p>}
        {statusError && <div className={`${errorBoxClass} mt-6`} role="alert">Could not check setup status: {statusError}</div>}
        {!loadingStatus && !statusError && allowed === false && (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="alert">
              <p className="font-semibold">SETUP_ALREADY_COMPLETED</p>
              <p className="mt-1 text-muted-foreground">Initial administrator setup is locked because an account already exists.</p>
            </div>
            <Link className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/login">Go to sign in</Link>
          </div>
        )}
        {!loadingStatus && !statusError && allowed && (
          <form className="mt-6 space-y-5" onSubmit={submitSetup}>
            {submitError && <div className={errorBoxClass} role="alert">{submitError}</div>}
            <Field id="setup-first-name" label="First name" hint="Required.">
              <Input {...validationProps} aria-describedby="setup-first-name-hint" autoComplete="given-name" className={inputClass} id="setup-first-name" name="firstName" required />
            </Field>
            <Field id="setup-last-name" label="Last name" hint="Required.">
              <Input {...validationProps} aria-describedby="setup-last-name-hint" autoComplete="family-name" className={inputClass} id="setup-last-name" name="lastName" required />
            </Field>
            <Field id="setup-email" label="Email address" hint="Required. Use an address you can access.">
              <Input {...validationProps} aria-describedby="setup-email-hint" autoComplete="email" className={inputClass} id="setup-email" name="email" required type="email" />
            </Field>
            <Field id="setup-password" label="Password" hint="Use at least 8 characters.">
              <Input {...validationProps} aria-describedby="setup-password-hint" autoComplete="new-password" className={inputClass} id="setup-password" minLength={8} name="password" required type="password" />
            </Field>
            <Button className="min-h-10 rounded-md" disabled={submitting} type="submit">{submitting ? 'Creating account...' : 'Create administrator'}</Button>
          </form>
        )}
      </section>
    </PageWrapper>
  )
}

export function LoginPage() {
  const notify = useNotify()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [pendingVerification, setPendingVerification] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const from = (location.state as { from?: string } | null)?.from

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPendingVerification(false)
    const formData = new FormData(event.currentTarget)
    const credentials = { email: String(formData.get('email') ?? '').trim(), password: String(formData.get('password') ?? '') }
    setSubmitting(true)
    try {
      const session = await apiClient.post<LoginResponse, typeof credentials>('auth/login', credentials)
      useAuthStore.getState().login(session.accessToken, session.user)
      notify('success', 'Signed in', 'Welcome back to Ticket Desk.')
      navigate(from ?? roleDestination(session.user.role), { replace: true })
    } catch (caught) {
      const message = errorMessage(caught)
      if (message.toLowerCase().includes('pending verification')) {
        setPendingVerification(true)
      } else {
        setError(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageWrapper>
      <section className="mx-auto max-w-md py-8 sm:py-12">
        <p className="text-sm font-semibold uppercase text-primary-700 dark:text-primary-500">Ticket Desk</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Access your tickets and dashboard.</p>
        {pendingVerification && (
          <div className="mt-6 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="alert">
            Account verification pending. Please check your email for activation link.
            <Link className="ml-1 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/verify-account">Verify account</Link>
          </div>
        )}
        <form className="mt-6 space-y-5" onSubmit={submitLogin}>
          {error && <div className={errorBoxClass} role="alert">{error}</div>}
          <Field id="login-email" label="Email address" hint="Required.">
            <Input {...validationProps} aria-describedby="login-email-hint" autoComplete="email" className={inputClass} id="login-email" name="email" required type="email" />
          </Field>
          <Field id="login-password" label="Password" hint="Required.">
            <Input {...validationProps} aria-describedby="login-password-hint" autoComplete="current-password" className={inputClass} id="login-password" name="password" required type="password" />
          </Field>
          <Button className="min-h-10 w-full rounded-md" disabled={submitting} type="submit">{submitting ? 'Signing in...' : 'Sign in'}</Button>
        </form>
        <p className="mt-5 text-sm text-muted-foreground">First administrator? <Link className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/setup">Start setup</Link></p>
      </section>
    </PageWrapper>
  )
}

export function VerifyAccountPage() {
  const notify = useNotify()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState(searchParams.get('token') ?? '')
  const [error, setError] = useState('')
  const [confirmationError, setConfirmationError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setConfirmationError('')
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password') ?? '')
    const confirmation = String(formData.get('confirmPassword') ?? '')
    if (password !== confirmation) {
      setConfirmationError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post<AuthUser, { token: string; password: string }>('auth/verify', { token: token.trim(), password })
      notify('success', 'Account activated', 'Account activated successfully! You can now log in.')
      navigate('/login', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageWrapper>
      <section className="mx-auto max-w-md py-8 sm:py-12">
        <h1 className="text-2xl font-semibold">Activate your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a password to complete account verification.</p>
        <form className="mt-6 space-y-5" onSubmit={submitVerification}>
          {error && <div className={errorBoxClass} role="alert">{error}</div>}
          {!searchParams.get('token') && (
            <Field id="verify-token" label="Verification token" hint="Required.">
              <Input {...validationProps} aria-describedby="verify-token-hint" autoComplete="one-time-code" className={inputClass} id="verify-token" onChange={(event) => setToken(event.target.value)} required value={token} />
            </Field>
          )}
          <Field id="verify-password" label="New password" hint="Use at least 8 characters.">
            <Input {...validationProps} aria-describedby="verify-password-hint" autoComplete="new-password" className={inputClass} id="verify-password" minLength={8} name="password" required type="password" />
          </Field>
          <Field id="verify-confirm-password" label="Confirm new password" error={confirmationError} hint="Required.">
            <Input {...validationProps} aria-describedby={inputDescription('verify-confirm-password', Boolean(confirmationError))} aria-invalid={Boolean(confirmationError)} autoComplete="new-password" className={inputClass} id="verify-confirm-password" name="confirmPassword" required type="password" />
          </Field>
          <Button className="min-h-10 w-full rounded-md" disabled={submitting || token.trim().length === 0} type="submit">{submitting ? 'Activating...' : 'Activate account'}</Button>
        </form>
      </section>
    </PageWrapper>
  )
}

export function NewTicketPage() {
  const notify = useNotify()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentError, setDepartmentError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    apiClient.get<Department[]>('admin/departments')
      .then((items) => { if (active) setDepartments(items) })
      .catch((error: unknown) => { if (active) setDepartmentError(errorMessage(error)) })
    return () => { active = false }
  }, [])

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    const formData = new FormData(event.currentTarget)
    const payload = {
      title: String(formData.get('title') ?? '').trim(),
      description: String(formData.get('description') ?? '').trim(),
      departmentId: String(formData.get('departmentId') ?? ''),
      priority: String(formData.get('priority') ?? 'MEDIUM') as TicketPriority,
    }
    setSubmitting(true)
    try {
      await apiClient.post<Ticket, typeof payload>('tickets', payload)
      notify('success', 'Ticket submitted', 'Your issue has been sent to the support team.')
      navigate('/tickets/my')
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageWrapper>
      <section className="mx-auto max-w-2xl py-6 sm:py-10">
        <h1 className="text-2xl font-semibold">Report an issue</h1>
        <p className="mt-2 text-sm text-muted-foreground">Describe what happened and where you need help.</p>
        <form className="mt-6 space-y-5" onSubmit={submitTicket}>
          {departmentError && <div className={errorBoxClass} role="alert">Departments could not be loaded: {departmentError}</div>}
          {submitError && <div className={errorBoxClass} role="alert">{submitError}</div>}
          <Field id="ticket-title" label="Title" hint="Required, up to 200 characters.">
            <Input {...validationProps} aria-describedby="ticket-title-hint" className={inputClass} id="ticket-title" maxLength={200} name="title" required />
          </Field>
          <Field id="ticket-description" label="Description" hint="Required. Include the steps or details that will help us investigate.">
            <textarea {...validationProps} aria-describedby="ticket-description-hint" className={`${inputClass} min-h-36 resize-y`} id="ticket-description" name="description" required />
          </Field>
          <Field id="ticket-department" label="Department" error={departmentError ? 'A department is required before you can submit a ticket.' : undefined} hint="Required.">
            <select {...validationProps} aria-describedby={inputDescription('ticket-department', Boolean(departmentError))} aria-invalid={Boolean(departmentError)} className={selectClass} disabled={departments.length === 0} id="ticket-department" name="departmentId" required>
              <option value="">{departments.length > 0 ? 'Choose a department' : 'No departments available'}</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </Field>
          <Field id="ticket-priority" label="Priority" hint="Choose the impact level that best fits your issue.">
            <select {...validationProps} aria-describedby="ticket-priority-hint" className={selectClass} defaultValue="MEDIUM" id="ticket-priority" name="priority">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </Field>
          <Button className="min-h-10 rounded-md" disabled={submitting || departments.length === 0} type="submit">{submitting ? 'Submitting...' : 'Submit ticket'}</Button>
        </form>
      </section>
    </PageWrapper>
  )
}

interface TicketListResponse {
  items: Ticket[]
  total: number
  page: number
  pageSize: number
}

const statusTone: Record<TicketStatus, string> = {
  OPEN: 'border-sky-600/30 bg-sky-600/10 text-sky-800 dark:text-sky-300',
  IN_PROGRESS: 'border-amber-600/30 bg-amber-600/10 text-amber-800 dark:text-amber-300',
  PENDING_USER_RESPONSE: 'border-orange-600/30 bg-orange-600/10 text-orange-800 dark:text-orange-300',
  RESOLVED: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300',
  CLOSED: 'border-muted bg-muted text-muted-foreground',
}

const priorityTone: Record<TicketPriority, string> = {
  LOW: 'border-border bg-muted text-muted-foreground',
  MEDIUM: 'border-sky-600/30 bg-sky-600/10 text-sky-800 dark:text-sky-300',
  HIGH: 'border-amber-600/30 bg-amber-600/10 text-amber-800 dark:text-amber-300',
  URGENT: 'border-destructive/30 bg-destructive/10 text-destructive',
}

function formatDate(date: string | undefined) {
  if (!date) return 'Not available'
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed)
}

function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge className={statusTone[status]} variant="outline">{status.replaceAll('_', ' ')}</Badge>
}

function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return <Badge className={priorityTone[priority]} variant="outline">{priority}</Badge>
}

function MyTicketDetail({ ticketId, onClose, onChanged }: { ticketId: string; onClose: () => void; onChanged: () => void }) {
  const notify = useNotify()
  const user = useAuthStore((state) => state.user)
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commentError, setCommentError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  const canChangeStatus = user?.role === 'ADMIN' || (user?.role === 'USER' && user.id === ticket?.reporterId)

  useEffect(() => {
    let active = true
    apiClient.get<Ticket>(`tickets/${ticketId}`)
      .then((data) => {
        if (active) {
          setTicket(data)
          setError('')
        }
      })
      .catch((caught: unknown) => { if (active) setError(errorMessage(caught)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [ticketId])

  async function reloadTicket() {
    const latest = await apiClient.get<Ticket>(`tickets/${ticketId}`)
    setTicket(latest)
    onChanged()
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCommentError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    const content = String(formData.get('content') ?? '').trim()
    if (!content) return
    setBusy(true)
    try {
      await apiClient.post<TicketComment, { content: string }>(`tickets/${ticketId}/comments`, { content })
      form.reset()
      await reloadTicket()
      notify('success', 'Comment added', 'Your comment was added to the ticket.')
    } catch (caught) {
      setCommentError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(status: 'OPEN' | 'CLOSED', closeReason?: CloseReason) {
    setActionError('')
    setBusy(true)
    try {
      await apiClient.patch<Ticket, { status: 'OPEN' | 'CLOSED'; closeReason?: CloseReason }>(`tickets/${ticketId}/status`, { status, ...(closeReason ? { closeReason } : {}) })
      await reloadTicket()
      notify('success', status === 'CLOSED' ? 'Ticket closed' : 'Ticket reopened', status === 'CLOSED' ? 'This ticket is now closed.' : 'This ticket has been reopened.')
    } catch (caught) {
      setActionError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="ticket-detail-title" className="mt-8 rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Ticket detail</p>
          <h2 className="mt-1 text-xl font-semibold" id="ticket-detail-title">{ticket ? `#${ticket.ticketNumber} ${ticket.title}` : 'Ticket detail'}</h2>
        </div>
        <Button aria-label="Close ticket details" className="rounded-md" onClick={onClose} type="button" variant="outline">Close details</Button>
      </div>
      {loading && <p className="mt-5 text-sm text-muted-foreground" role="status">Loading ticket...</p>}
      {error && <div className={`${errorBoxClass} mt-5`} role="alert">{error}</div>}
      {ticket && !loading && (
        <>
          <dl className="mt-5 grid gap-4 border-y border-border py-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Department</dt><dd className="mt-1 text-sm">{ticket.department?.name ?? 'Not assigned'}</dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Status</dt><dd className="mt-1"><StatusBadge status={ticket.status} /></dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Priority</dt><dd className="mt-1"><PriorityBadge priority={ticket.priority} /></dd></div>
            <div><dt className="text-xs font-semibold uppercase text-muted-foreground">Reporter</dt><dd className="mt-1 text-sm">{ticket.reporter?.firstName ? `${ticket.reporter.firstName} ${ticket.reporter.lastName ?? ''}`.trim() : ticket.reporter?.email ?? user?.email}</dd></div>
          </dl>
          <div className="py-5">
            <h3 className="text-sm font-semibold">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{ticket.description}</p>
          </div>
          <section aria-labelledby="comments-heading" className="border-t border-border pt-5">
            <h3 className="text-base font-semibold" id="comments-heading">Comments</h3>
            {(ticket.comments ?? []).length === 0
              ? <p className="mt-3 text-sm text-muted-foreground">No comments yet.</p>
              : <ol className="mt-4 space-y-4">{ticket.comments?.map((comment) => (
                <li className="border-l-2 border-border pl-4" key={comment.id}>
                  <p className="text-sm font-medium">{comment.author?.firstName ? `${comment.author.firstName} ${comment.author.lastName ?? ''}`.trim() : comment.author?.email ?? 'Ticket participant'}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{comment.content}</p>
                  <time className="mt-1 block text-xs text-muted-foreground" dateTime={comment.createdAt}>{formatDate(comment.createdAt)}</time>
                </li>
              ))}</ol>}
            {ticket.status !== 'CLOSED' && (
              <form className="mt-5 space-y-3" onSubmit={submitComment}>
                {commentError && <div className={errorBoxClass} role="alert">{commentError}</div>}
                <Field id="ticket-comment" label="Add a comment" hint="Required; up to 5,000 characters.">
                  <textarea {...validationProps} aria-describedby="ticket-comment-hint" className={`${inputClass} min-h-24 resize-y`} id="ticket-comment" maxLength={5000} name="content" required />
                </Field>
                <Button className="min-h-10 rounded-md" disabled={busy} type="submit">Add comment</Button>
              </form>
            )}
          </section>
          <section aria-labelledby="ticket-actions-heading" className="mt-6 border-t border-border pt-5">
            <h3 className="text-base font-semibold" id="ticket-actions-heading">Ticket actions</h3>
            {actionError && <div className={`${errorBoxClass} mt-3`} role="alert">{actionError}</div>}
            {ticket.status === 'RESOLVED' && canChangeStatus && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground">This ticket is resolved. You may reopen it if more help is needed.</p>
                <Button className="mt-3 min-h-10 rounded-md" disabled={busy} onClick={() => void updateStatus('OPEN')} type="button" variant="outline">Reopen ticket</Button>
              </div>
            )}
            {ticket.status === 'CLOSED' && <p className="mt-3 text-sm text-muted-foreground">Closed tickets are in a terminal state and cannot be reopened.</p>}
            {ticket.status !== 'CLOSED' && canChangeStatus && (
              <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void updateStatus('CLOSED', String(data.get('closeReason')) as CloseReason) }}>
                <Field id="close-reason" label="Close reason" hint="Required to close this ticket.">
                  <select {...validationProps} aria-describedby="close-reason-hint" className={selectClass} id="close-reason" name="closeReason" required>
                    <option value="RESOLVED">Resolved</option>
                    <option value="NO_RESPONSE">No response</option>
                    <option value="CANCELED">Canceled</option>
                    <option value="DUPLICATED">Duplicate</option>
                  </select>
                </Field>
                <Button className="min-h-10 rounded-md" disabled={busy} type="submit" variant="outline">Close ticket</Button>
              </form>
            )}
          </section>
        </>
      )}
    </section>
  )
}

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const reloadTickets = useCallback(async () => {
    try {
      const response = await apiClient.get<TicketListResponse>('tickets?page=1&pageSize=100')
      setTickets(response.items)
      setTotal(response.total)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }, [])

  useEffect(() => {
    let active = true
    apiClient.get<TicketListResponse>('tickets?page=1&pageSize=100')
      .then((response) => {
        if (active) {
          setTickets(response.items)
          setTotal(response.total)
          setError('')
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <PageWrapper>
      <section className="py-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-primary-700 dark:text-primary-500">Support requests</p>
            <h1 className="mt-2 text-2xl font-semibold">My tickets</h1>
            <p className="mt-2 text-sm text-muted-foreground">{total} {total === 1 ? 'ticket' : 'tickets'}</p>
          </div>
          <Link className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/tickets/new">Report an issue</Link>
        </div>
        {error && <div className={`${errorBoxClass} mt-6`} role="alert">{error}</div>}
        {loading && <p className="mt-6 text-sm text-muted-foreground" role="status">Loading tickets...</p>}
        {!loading && !error && tickets.length === 0 && <p className="mt-6 rounded-md border border-border p-5 text-sm text-muted-foreground">No tickets found. Report an issue to get started.</p>}
        {!loading && tickets.length > 0 && (
          <>
            <div className="mt-6 hidden overflow-x-auto rounded-lg border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Ticket</TableHead>
                    <TableHead scope="col">Title</TableHead>
                    <TableHead scope="col">Status</TableHead>
                    <TableHead scope="col">Priority</TableHead>
                    <TableHead scope="col">Last activity</TableHead>
                    <TableHead scope="col"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">#{ticket.ticketNumber}</TableCell>
                      <TableCell className="max-w-sm truncate">{ticket.title}</TableCell>
                      <TableCell><StatusBadge status={ticket.status} /></TableCell>
                      <TableCell><PriorityBadge priority={ticket.priority} /></TableCell>
                      <TableCell>{formatDate(ticket.lastActivityAt)}</TableCell>
                      <TableCell><Button aria-label={`View ticket ${ticket.ticketNumber}: ${ticket.title}`} className="rounded-md" onClick={() => setSelectedId(ticket.id)} type="button" variant="outline">View</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul aria-label="Tickets" className="mt-5 space-y-3 md:hidden">
              {tickets.map((ticket) => (
                <li className="rounded-lg border border-border bg-card p-4 text-card-foreground" key={ticket.id}>
                  <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">#{ticket.ticketNumber}</p><StatusBadge status={ticket.status} /></div>
                  <h2 className="mt-2 font-medium">{ticket.title}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2"><PriorityBadge priority={ticket.priority} /><time className="text-xs text-muted-foreground" dateTime={ticket.lastActivityAt}>Updated {formatDate(ticket.lastActivityAt)}</time></div>
                  <Button aria-label={`View ticket ${ticket.ticketNumber}: ${ticket.title}`} className="mt-4 min-h-10 w-full rounded-md" onClick={() => setSelectedId(ticket.id)} type="button" variant="outline">View details</Button>
                </li>
              ))}
            </ul>
          </>
        )}
        {selectedId && <MyTicketDetail key={selectedId} onChanged={() => void reloadTickets()} onClose={() => setSelectedId(null)} ticketId={selectedId} />}
      </section>
    </PageWrapper>
  )
}
