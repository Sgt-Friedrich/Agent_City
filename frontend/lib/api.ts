import { API_BASE_URL } from "@/lib/config";
import {
  BoundTraceResponse,
  MetricsSummary,
  RegisterTargetRequest,
  RegisterTargetResponse,
  TopologyGraph,
  TargetsResponse,
  TracesResponse,
} from "@/types/schema";

function withQuery(path: string, query?: Record<string, string | number | undefined>): string {
  if (!query) {
    return path;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function request<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${withQuery(path, query)}`, {
    next: { revalidate: 0 },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${path} -> ${response.status}`);
  }

  return (await response.json()) as T;
}

async function requestPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${path} -> ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

export const api = {
  getTargets: () => request<TargetsResponse>("/api/targets"),
  registerTarget: (payload: RegisterTargetRequest) =>
    requestPost<RegisterTargetResponse>("/api/targets/register", payload),
  getTopology: (target: string) => request<TopologyGraph>("/api/topology", { target }),
  getTraces: (target: string) => request<TracesResponse>("/api/traces", { target }),
  getTraceDetail: (traceId: string, target: string) =>
    request<BoundTraceResponse>(`/api/traces/${traceId}`, { target }),
  getMetricsSummary: (target: string) => request<MetricsSummary>("/api/metrics/summary", { target }),
  getNode: (nodeId: string, target: string) => request(`/api/nodes/${nodeId}`, { target }),
};
