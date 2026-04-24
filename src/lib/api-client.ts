import axios, { AxiosInstance, AxiosError } from "axios";
import { API_URLS } from "./api-config";

const STORAGE_KEY = "elitecoach.auth";

export interface StoredAuth {
  accessToken: string | null;
  refreshToken: string | null;
}

export function readAuth(): StoredAuth {
  if (typeof window === "undefined")
    return { accessToken: null, refreshToken: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { accessToken: null, refreshToken: null };
    return JSON.parse(raw) as StoredAuth;
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export function writeAuth(auth: StoredAuth) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

function makeClient(baseURL: string): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 30000 });

  client.interceptors.request.use((config) => {
    const { accessToken } = readAuth();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  let refreshing: Promise<string | null> | null = null;

  client.interceptors.response.use(
    (r) => r,
    async (error: AxiosError) => {
      const original = error.config as
        | (typeof error.config & { _retried?: boolean })
        | undefined;
      if (
        error.response?.status === 401 &&
        original &&
        !original._retried &&
        !original.url?.includes("/auth/")
      ) {
        original._retried = true;
        try {
          if (!refreshing) {
            refreshing = (async () => {
              const { refreshToken } = readAuth();
              if (!refreshToken) return null;
              const res = await axios.post(
                `${API_URLS.identity}/api/v1/auth/refresh`,
                {
                  refreshToken,
                },
              );
              const newAccess =
                res.data?.accessToken ?? res.data?.data?.accessToken;
              const newRefresh =
                res.data?.refreshToken ??
                res.data?.data?.refreshToken ??
                refreshToken;
              if (newAccess) {
                writeAuth({ accessToken: newAccess, refreshToken: newRefresh });
                return newAccess;
              }
              return null;
            })();
          }
          const token = await refreshing;
          refreshing = null;
          if (token && original.headers) {
            original.headers.Authorization = `Bearer ${token}`;
            return client.request(original);
          }
        } catch {
          refreshing = null;
          clearAuth();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export const identityApi = makeClient(API_URLS.identity);
export const aiTutorApi = makeClient(API_URLS.aiTutor);
export const assessmentsApi = makeClient(API_URLS.assessments);
export const contentApi = makeClient(API_URLS.content);
export const notificationsApi = makeClient(API_URLS.notifications);

export function extractErrorMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.message === "string") return data.message;
      if (typeof data.error === "string") return data.error;
      if (typeof data.detail === "string") return data.detail;
    }
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
