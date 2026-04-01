import { API_BASE_URL } from "@/lib/config";
import {
  BoundTraceResponse,
  MetricsSummary,
  TopologyGraph,
  TracesResponse,
} from "@/types/schema";

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    next: { revalidate: 0 },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${path} -> ${response.status}`);
  }

  return (await response.json()) as T;
}

export const api = {
  getTopology: () => request<TopologyGraph>("/api/topology"),
  getTraces: () => request<TracesResponse>("/api/traces"),
  getTraceDetail: (traceId: string) =>
    request<BoundTraceResponse>(`/api/traces/${traceId}`),
  getMetricsSummary: () => request<MetricsSummary>("/api/metrics/summary"),
  getNode: (nodeId: string) => request(`/api/nodes/${nodeId}`),
};
