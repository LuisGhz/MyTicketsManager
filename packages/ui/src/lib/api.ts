import { useAuthStore } from "../stores/auth-store";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiClient {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  get: <T>(path: string, init?: RequestInit) => Promise<T>;
  post: <T, TBody = unknown>(path: string, body?: TBody, init?: RequestInit) => Promise<T>;
  put: <T, TBody = unknown>(path: string, body?: TBody, init?: RequestInit) => Promise<T>;
  patch: <T, TBody = unknown>(path: string, body?: TBody, init?: RequestInit) => Promise<T>;
  delete: <T>(path: string, init?: RequestInit) => Promise<T>;
}

function joinUrl(baseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function errorMessage(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.length > 0) return body;
  if (body && typeof body === "object" && "message" in body) {
    const message = body.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return fallback;
}

export function createApiClient(baseUrl = "/api/v1"): ApiClient {
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const headers = new Headers(init.headers);
    const token = useAuthStore.getState().token;
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (typeof init.body === "string" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(joinUrl(baseUrl, path), {
      ...init,
      headers,
    });
    let body: unknown = null;
    if (response.status !== 204) {
      const contentType = response.headers.get("content-type") ?? "";
      body = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    }

    if (!response.ok) {
      throw new ApiError(
        errorMessage(body, response.statusText || "Request failed"),
        response.status,
        body,
      );
    }
    return body as T;
  };

  const sendJson = <T, TBody>(
    method: "POST" | "PUT" | "PATCH",
    path: string,
    body?: TBody,
    init: RequestInit = {},
  ) => request<T>(path, {
    ...init,
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return {
    request,
    get: (path, init) => request(path, { ...init, method: "GET" }),
    post: (path, body, init) => sendJson("POST", path, body, init),
    put: (path, body, init) => sendJson("PUT", path, body, init),
    patch: (path, body, init) => sendJson("PATCH", path, body, init),
    delete: (path, init) => request(path, { ...init, method: "DELETE" }),
  };
}

export const apiClient = createApiClient();
export const apiRequest = apiClient.request;
