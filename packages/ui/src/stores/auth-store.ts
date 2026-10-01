import { create } from "zustand";
import type { AuthUser, Role, UserStatus } from "../types";

const ACCESS_TOKEN_KEY = "accessToken";
const AUTH_USER_KEY = "auth-user";

type TokenStorage = "local" | "session";

interface LoginResponse {
  accessToken: string;
  user?: AuthUser;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (
    session: string | LoginResponse,
    userOrRememberMe?: AuthUser | boolean,
    rememberMe?: boolean,
  ) => void;
  logout: () => void;
  checkAuth: () => boolean;
}

interface JwtPayload {
  sub?: unknown;
  id?: unknown;
  email?: unknown;
  role?: unknown;
  status?: unknown;
  exp?: unknown;
}

const roles: Role[] = ["ADMIN", "AGENT", "USER"];
const userStatuses: UserStatus[] = ["PENDING_VERIFICATION", "ACTIVE", "DISABLED"];

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;

    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const binary = window.atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload;
  } catch {
    return null;
  }
}

function userFromToken(token: string, profile?: AuthUser | null): AuthUser | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
    return null;
  }

  const id = typeof payload.sub === "string" ? payload.sub : payload.id;
  const email = typeof payload.email === "string" ? payload.email : profile?.email;
  const role = roles.includes(payload.role as Role) ? payload.role as Role : profile?.role;
  if (typeof id !== "string" || typeof email !== "string" || !role || !roles.includes(role)) {
    return null;
  }

  const user: AuthUser = {
    ...profile,
    id,
    email,
    role,
  };
  if (userStatuses.includes(payload.status as UserStatus)) {
    user.status = payload.status as UserStatus;
  }
  return user;
}

function getStorage(kind: TokenStorage): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readProfile(storage: Storage): AuthUser | null {
  try {
    const storedUser = storage.getItem(AUTH_USER_KEY);
    return storedUser ? JSON.parse(storedUser) as AuthUser : null;
  } catch {
    return null;
  }
}

function restoreSession(): Pick<AuthState, "token" | "user" | "isAuthenticated"> {
  for (const kind of ["local", "session"] as const) {
    const storage = getStorage(kind);
    if (!storage) continue;

    try {
      const token = storage.getItem(ACCESS_TOKEN_KEY);
      if (!token) continue;

      const user = userFromToken(token, readProfile(storage));
      if (user) return { token, user, isAuthenticated: true };
      storage.removeItem(ACCESS_TOKEN_KEY);
      storage.removeItem(AUTH_USER_KEY);
    } catch {
      // Continue to the other storage if this one is unavailable.
    }
  }

  return { token: null, user: null, isAuthenticated: false };
}

function clearStoredSession(): void {
  for (const kind of ["local", "session"] as const) {
    const storage = getStorage(kind);
    try {
      storage?.removeItem(ACCESS_TOKEN_KEY);
      storage?.removeItem(AUTH_USER_KEY);
    } catch {
      // The in-memory session is still cleared below.
    }
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  ...restoreSession(),
  login: (session, userOrRememberMe, rememberMe = true) => {
    const response = typeof session === "string" ? null : session;
    const token = response?.accessToken ?? session as string;
    const profile = response?.user ??
      (typeof userOrRememberMe === "object" ? userOrRememberMe : null);
    const shouldRemember = typeof userOrRememberMe === "boolean"
      ? userOrRememberMe
      : rememberMe;
    const user = userFromToken(token, profile);
    if (!user) throw new Error("The access token is invalid or expired.");

    clearStoredSession();
    const storage = getStorage(shouldRemember ? "local" : "session");
    try {
      storage?.setItem(ACCESS_TOKEN_KEY, token);
      storage?.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch {
      // Authentication remains available for the current page session.
    }
    set({ token, user, isAuthenticated: true });
  },
  logout: () => {
    clearStoredSession();
    set({ token: null, user: null, isAuthenticated: false });
  },
  checkAuth: () => {
    const restored = restoreSession();
    set(restored);
    return restored.isAuthenticated;
  },
}));
