import { Component, type ReactNode } from "react";
import "./App.css";
import { AdminDashboard } from "./components/AdminDashboard";

class AdminAppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="admin-app min-h-screen bg-background text-foreground dark:bg-background dark:text-foreground">
          <section className="boundary-error" role="alert">
            <p className="section-eyebrow">Admin workspace</p>
            <h1>Dashboard unavailable</h1>
            <p>The administration view encountered an unexpected error.</p>
            <button className="boundary-reload" type="button" onClick={() => window.location.reload()}>
              Reload dashboard
            </button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

export function AdminApp() {
  return (
    <AdminAppErrorBoundary>
      <AdminDashboard />
    </AdminAppErrorBoundary>
  );
}

export { AdminDashboard };

export default AdminApp;
