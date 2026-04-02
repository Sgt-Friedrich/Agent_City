import { API_BASE_URL } from "@/lib/config";
import {
  AppRuntimeStatus,
  AppSettings,
  BoundTraceResponse,
  DiagnosticsSummary,
  JobRunRequest,
  JobRunResponse,
  JobsResponse,
  MetricsSummary,
  ParseJobsResponse,
  ParserAnalysisReport,
  RepositoriesResponse,
  ReportContentResponse,
  RegisterTargetRequest,
  RegisterTargetResponse,
  SettingsResponse,
  TargetPreviewRequest,
  TargetPreviewResponse,
  ReportsResponse,
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
  previewTarget: (payload: TargetPreviewRequest) =>
    requestPost<TargetPreviewResponse>("/api/targets/preview", payload),
  registerTarget: (payload: RegisterTargetRequest) =>
    requestPost<RegisterTargetResponse>("/api/targets/register", payload),
  getTopology: (target: string) => request<TopologyGraph>("/api/topology", { target }),
  getTraces: (target: string) => request<TracesResponse>("/api/traces", { target }),
  getTraceDetail: (traceId: string, target: string) =>
    request<BoundTraceResponse>(`/api/traces/${traceId}`, { target }),
  getMetricsSummary: (target: string) => request<MetricsSummary>("/api/metrics/summary", { target }),
  getNode: (nodeId: string, target: string) => request(`/api/nodes/${nodeId}`, { target }),
  getParseJobs: () => request<ParseJobsResponse>("/api/parse-jobs"),
  scanParseJobs: () => requestPost<{ count: number; drop_directory: string }>("/api/parse-jobs/scan", {}),
  getDiagnosticsSummary: (target: string) =>
    request<DiagnosticsSummary>("/api/analysis/diagnostics", { target }),
  getParserAnalysis: (target: string) =>
    request<ParserAnalysisReport>("/api/analysis/parser", { target }),
  getAnalysisReportMarkdown: (target: string) =>
    fetch(`${API_BASE_URL}/api/analysis/report?target=${encodeURIComponent(target)}&fmt=markdown`, {
      cache: "no-store",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed: /api/analysis/report -> ${response.status}`);
      }
      return response.text();
    }),
  getReports: (category?: string) => request<ReportsResponse>("/api/reports", { category }),
  getReportContent: (reportId: string) =>
    request<ReportContentResponse>(`/api/reports/${encodeURIComponent(reportId)}`),
  getRepositories: () => request<RepositoriesResponse>("/api/control/repositories"),
  removeRepository: (targetId: string) =>
    fetch(`${API_BASE_URL}/api/control/repositories/${encodeURIComponent(targetId)}`, {
      method: "DELETE",
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Request failed: delete repository -> ${response.status}`);
      }
      return response.json() as Promise<{ ok: boolean; target_id: string }>;
    }),
  getJobs: () => request<JobsResponse>("/api/control/jobs"),
  runJob: (payload: JobRunRequest) => requestPost<JobRunResponse>("/api/control/jobs", payload),
  cancelJob: (jobId: string) =>
    requestPost<JobRunResponse>(`/api/control/jobs/${encodeURIComponent(jobId)}/cancel`, {}),
  getSettings: () => request<SettingsResponse>("/api/control/settings"),
  updateSettings: (payload: Partial<AppSettings>) =>
    fetch(`${API_BASE_URL}/api/control/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Request failed: /api/control/settings -> ${response.status} ${text}`);
      }
      return response.json() as Promise<SettingsResponse>;
    }),
  getRuntimeStatus: () => request<{ runtime: AppRuntimeStatus }>("/api/control/runtime"),
};
