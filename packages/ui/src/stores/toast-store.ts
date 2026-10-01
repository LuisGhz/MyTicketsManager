import { create } from "zustand";

export type ToastVariant = "success" | "info" | "warning" | "error";

export interface ToastMessage {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

export type NewToast = Omit<ToastMessage, "id" | "duration"> & {
  id?: string;
  duration?: number;
};

interface ToastState {
  toasts: ToastMessage[];
  addToast: (toast: NewToast) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function createToastId(): string {
  return globalThis.crypto?.randomUUID?.() ??
    `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cancelTimer(id: string): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    const id = toast.id ?? createToastId();
    const duration = toast.duration ?? 5000;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, duration }],
    }));
    cancelTimer(id);
    if (duration > 0) {
      timers.set(id, setTimeout(() => get().dismissToast(id), duration));
    }
    return id;
  },
  dismissToast: (id) => {
    cancelTimer(id);
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  clearToasts: () => {
    for (const id of timers.keys()) cancelTimer(id);
    set({ toasts: [] });
  },
}));
