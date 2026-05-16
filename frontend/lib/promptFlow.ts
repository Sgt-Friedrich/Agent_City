import { FlowEvent, Node, NodeType, SpanKind } from "@/types/schema";

export type PromptStageId =
  | "ingress"
  | "planning"
  | "context"
  | "tools"
  | "llm"
  | "safety"
  | "output"
  | "runtime";

export interface PromptStageSnapshot {
  id: PromptStageId;
  labelKey: string;
  hintKey: string;
  nodeIds: string[];
  nodeNames: string[];
}

interface PromptStageRule {
  id: PromptStageId;
  labelKey: string;
  hintKey: string;
  typeSet: Set<NodeType>;
  districtHints: string[];
  nameHints: string[];
}

const STAGE_ORDER: PromptStageId[] = [
  "ingress",
  "planning",
  "context",
  "tools",
  "llm",
  "safety",
  "output",
  "runtime",
];

const STAGE_RULES: PromptStageRule[] = [
  {
    id: "ingress",
    labelKey: "promptFlow.stage.ingress",
    hintKey: "promptFlow.hint.ingress",
    typeSet: new Set<NodeType>(["runtime", "session", "event_bus"]),
    districtHints: ["runtime"],
    nameHints: ["gateway", "chat", "entry", "ingress", "cli", "ui", "app-server", "client"],
  },
  {
    id: "planning",
    labelKey: "promptFlow.stage.planning",
    hintKey: "promptFlow.hint.planning",
    typeSet: new Set<NodeType>(["planner", "agent", "sub_agent"]),
    districtHints: ["planning"],
    nameHints: ["planner", "orchestr", "core", "rollout", "agent"],
  },
  {
    id: "context",
    labelKey: "promptFlow.stage.context",
    hintKey: "promptFlow.hint.context",
    typeSet: new Set<NodeType>(["retriever", "reranker", "embedding", "memory", "prompt"]),
    districtHints: ["retrieval", "memory"],
    nameHints: ["retriev", "rerank", "memory", "context", "session", "prompt", "state", "search"],
  },
  {
    id: "tools",
    labelKey: "promptFlow.stage.tools",
    hintKey: "promptFlow.hint.tools",
    typeSet: new Set<NodeType>(["tool", "mcp"]),
    districtHints: ["tools"],
    nameHints: ["tool", "plugin", "command", "exec", "shell", "patch", "hook", "mcp"],
  },
  {
    id: "llm",
    labelKey: "promptFlow.stage.llm",
    hintKey: "promptFlow.hint.llm",
    typeSet: new Set<NodeType>(["llm", "prompt"]),
    districtHints: ["llm"],
    nameHints: ["llm", "model", "inference", "responses", "api-proxy", "ollama", "lmstudio"],
  },
  {
    id: "safety",
    labelKey: "promptFlow.stage.safety",
    hintKey: "promptFlow.hint.safety",
    typeSet: new Set<NodeType>(["guardrail", "evaluator"]),
    districtHints: ["safety"],
    nameHints: ["guardrail", "policy", "sandbox", "security", "eval", "feedback", "hardening"],
  },
  {
    id: "output",
    labelKey: "promptFlow.stage.output",
    hintKey: "promptFlow.hint.output",
    typeSet: new Set<NodeType>(["runtime"]),
    districtHints: ["runtime", "boundary"],
    nameHints: ["render", "output", "response", "adapter", "fallback", "final", "analytics"],
  },
  {
    id: "runtime",
    labelKey: "promptFlow.stage.runtime",
    hintKey: "promptFlow.hint.runtime",
    typeSet: new Set<NodeType>(["runtime", "session", "event_bus", "external"]),
    districtHints: ["runtime", "boundary"],
    nameHints: ["runtime", "telemetry", "trace", "event", "infra", "transport", "backend", "frontend"],
  },
];

const SPAN_STAGE_MAP: Partial<Record<SpanKind, PromptStageId>> = {
  AGENT: "planning",
  CHAIN: "planning",
  RETRIEVER: "context",
  RERANKER: "context",
  EMBEDDING: "context",
  MEMORY: "context",
  TOOL: "tools",
  MCP: "tools",
  LLM: "llm",
  GUARDRAIL: "safety",
  EVALUATOR: "safety",
};

function extractDistrictHint(node: Node): string {
  const parts = node.district_id.toLowerCase().split(".");
  return parts[parts.length - 1] ?? node.district_id.toLowerCase();
}

function normalizedNodeName(node: Node): string {
  return `${node.name} ${node.id}`.toLowerCase();
}

function scoreNodeForStage(
  node: Node,
  rule: PromptStageRule,
  spanStageScore: number,
): number {
  let score = 0;
  if (rule.typeSet.has(node.type)) score += 4;
  const district = extractDistrictHint(node);
  if (rule.districtHints.some((hint) => district.includes(hint))) score += 2;

  const name = normalizedNodeName(node);
  let nameHit = 0;
  for (const hint of rule.nameHints) {
    if (name.includes(hint)) nameHit += 1;
  }
  score += Math.min(4, nameHit * 1.4);

  score += spanStageScore;
  return score;
}

export function resolvePromptStageSnapshots(
  nodes: Node[],
  events: FlowEvent[],
): PromptStageSnapshot[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const spanContribution = new Map<string, Map<PromptStageId, number>>();

  for (const event of events) {
    const stage = SPAN_STAGE_MAP[event.span_kind];
    if (!stage) continue;
    const ids = [event.from_node, event.to_node].filter(Boolean) as string[];
    for (const nodeId of ids) {
      const stageMap = spanContribution.get(nodeId) ?? new Map<PromptStageId, number>();
      stageMap.set(stage, (stageMap.get(stage) ?? 0) + 0.9);
      spanContribution.set(nodeId, stageMap);
    }
  }

  const stageBuckets = new Map<PromptStageId, string[]>();
  for (const stage of STAGE_ORDER) stageBuckets.set(stage, []);

  for (const node of nodes) {
    let bestStage: PromptStageId | undefined;
    let bestScore = -1;

    for (const rule of STAGE_RULES) {
      const spanScore = spanContribution.get(node.id)?.get(rule.id) ?? 0;
      const score = scoreNodeForStage(node, rule, spanScore);
      if (score > bestScore) {
        bestScore = score;
        bestStage = rule.id;
      }
    }

    if (!bestStage || bestScore < 1) {
      bestStage = node.type === "runtime" || node.type === "event_bus" ? "runtime" : "output";
    }
    stageBuckets.get(bestStage)?.push(node.id);
  }

  return STAGE_RULES.map((rule) => {
    const nodeIds = stageBuckets.get(rule.id) ?? [];
    const nodeNames = nodeIds
      .map((id) => nodeById.get(id)?.name ?? id)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 12);
    return {
      id: rule.id,
      labelKey: rule.labelKey,
      hintKey: rule.hintKey,
      nodeIds,
      nodeNames,
    };
  });
}
