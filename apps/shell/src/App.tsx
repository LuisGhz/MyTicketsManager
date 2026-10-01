import { Component, Suspense, lazy, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Badge, Navbar, PageWrapper, Toaster, useAuthStore, useThemeStore } from '@myticketsmanager/ui'
import type { Role } from '@myticketsmanager/ui'
import { AdminSetupPage, LoginPage, MyTicketsPage, NewTicketPage, VerifyAccountPage } from './ShellPages'

const AgentApp = lazy(() => import('agentDashboard/AgentApp'))
const AdminApp = lazy(() => import('adminDashboard/AdminApp'))

useThemeStore.getState().initTheme()
useAuthStore.getState().checkAuth()

const navigationLinks = [
  { href: '/tickets/new', label: 'New ticket', roles: ['USER', 'AGENT', 'ADMIN'] as const },
  { href: '/tickets/my', label: 'My tickets', roles: ['USER', 'AGENT', 'ADMIN'] as const },
  { href: '/agent', label: 'Agent dashboard', roles: ['AGENT', 'ADMIN'] as const },
  { href: '/admin', label: 'Admin dashboard', roles: ['ADMIN'] as const },
]

function roleHome(role: Role | undefined): string {
  if (role === 'ADMIN') return '/admin'
  if (role === 'AGENT') return '/agent'
  return '/tickets/my'
}

function HomeRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate replace to={user ? roleHome(user.role) : '/login'} />
}

function RequireUser({ roles }: { roles?: readonly Role[] }) {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()
  if (!user) return <Navigate replace to="/login" state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />
  return <Outlet />
}

class RemoteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <PageWrapper>
          <section className="mx-auto max-w-2xl rounded-lg border border-destructive/40 bg-background p-6" role="alert">
            <h1 className="text-xl font-semibold">Dashboard unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">The remote application could not be loaded. Check that its dashboard service is running, then try again.</p>
            <button className="mt-5 min-h-10 rounded-md border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => window.location.reload()} type="button">
              Reload shell
            </button>
          </section>
        </PageWrapper>
      )
    }
    return this.props.children
  }
}

function RemoteLoading() {
  return (
    <PageWrapper>
      <div aria-live="polite" className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
        <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
        Loading dashboard...
      </div>
    </PageWrapper>
  )
}

function ForbiddenPage() {
  return (
    <PageWrapper>
      <section className="mx-auto max-w-xl py-12" role="alert">
        <p className="text-sm font-semibold uppercase text-destructive">403 Forbidden</p>
        <h1 className="mt-2 text-2xl font-semibold">You do not have access to this page</h1>
        <p className="mt-2 text-muted-foreground">Your account does not have the role required for this area.</p>
        <Link className="mt-5 inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/">Return to your dashboard</Link>
      </section>
    </PageWrapper>
  )
}

function NotFoundPage() {
  return (
    <PageWrapper>
      <section className="mx-auto max-w-xl py-12">
        <p className="text-sm font-semibold uppercase text-muted-foreground">404</p>
        <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
        <Link className="mt-5 inline-flex min-h-10 items-center rounded-md border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" to="/">Back to home</Link>
      </section>
    </PageWrapper>
  )
}

function ShellLayout() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <a className="sr-only rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:ring-2 focus:ring-ring" href="#main-content">Skip to content</a>
      <Navbar brandName="Ticket Desk" links={navigationLinks} />
      {user && (
        <div className="mx-auto flex max-w-7xl justify-end px-4 pt-2 sm:px-6 lg:px-8">
          <Badge variant="outline" aria-label={`Signed in as ${user.role}`}>
            {user.role}
          </Badge>
        </div>
      )}
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/setup" element={<AdminSetupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-account" element={<VerifyAccountPage />} />
        <Route element={<RequireUser />}>
          <Route path="/tickets/new" element={<NewTicketPage />} />
          <Route path="/tickets/my" element={<MyTicketsPage />} />
        </Route>
        <Route element={<RequireUser roles={['AGENT', 'ADMIN']} />}>
          <Route path="/agent/*" element={<RemoteErrorBoundary><Suspense fallback={<RemoteLoading />}><AgentApp /></Suspense></RemoteErrorBoundary>} />
        </Route>
        <Route element={<RequireUser roles={['ADMIN']} />}>
          <Route path="/admin/*" element={<RemoteErrorBoundary><Suspense fallback={<RemoteLoading />}><AdminApp /></Suspense></RemoteErrorBoundary>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  )
}

function App() {
  return (
    <Toaster>
      <BrowserRouter>
        <ShellLayout />
      </BrowserRouter>
    </Toaster>
  )
}

export default App
