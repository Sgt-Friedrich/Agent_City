import { SpanKind } from "@/types/schema";

export function statusColor(status: string): string {
  switch (status) {
    case "healthy":
    case "success":
      return "#3ad17d";
    case "warning":
    case "partial":
      return "#f6c44b";
    case "error":
    case "failed":
      return "#ff5e64";
    default:
      return "#6e7f92";
  }
}

export function spanKindColor(spanKind: SpanKind, status?: string): string {
  if (status === "error" || status === "failed") {
    return "#ff5e64";
  }

  switch (spanKind) {
    case "LLM":
      return "#4da2ff";
    case "RETRIEVER":
    case "RERANKER":
    case "EMBEDDING":
      return "#33c671";
    case "TOOL":
    case "MCP":
      return "#9a68ff";
    case "MEMORY":
      return "#f6c44b";
    case "GUARDRAIL":
    case "EVALUATOR":
      return "#ff8c5a";
    default:
      return "#5aa4ff";
  }
}
