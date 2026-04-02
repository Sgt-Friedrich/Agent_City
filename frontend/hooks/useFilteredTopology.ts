"use client";

import { useMemo } from "react";

import { useDashboardStore } from "@/store/useDashboardStore";

type SearchKey = "type" | "district" | "protocol" | "status" | "trace" | "kind" | "node" | "has";
type NumericKey = "latency" | "qps";
type NumericOp = ">" | ">=" | "<" | "<=";

interface NumericExpr {
  key: NumericKey;
  op: NumericOp;
  value: number;
}

interface ParsedSearch {
  includeTerms: string[];
  excludeTerms: string[];
  includeKv: Partial<Record<SearchKey, string[]>>;
  excludeKv: Partial<Record<SearchKey, string[]>>;
  numeric: NumericExpr[];
}

function parseSearch(raw: string): ParsedSearch {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const parsed: ParsedSearch = {
    includeTerms: [],
    excludeTerms: [],
    includeKv: {},
    excludeKv: {},
    numeric: [],
  };

  for (const token of tokens) {
    const numericMatch = token.match(/^(latency|qps)(>=|<=|>|<)(\d+(?:\.\d+)?)$/i);
    if (numericMatch) {
      parsed.numeric.push({
        key: numericMatch[1].toLowerCase() as NumericKey,
        op: numericMatch[2] as NumericOp,
        value: Number(numericMatch[3]),
      });
      continue;
    }

    const kvExcludeMatch = token.match(/^([a-z_]+)!=([^]+)$/i);
    if (kvExcludeMatch) {
      const key = kvExcludeMatch[1].toLowerCase() as SearchKey;
      const values = kvExcludeMatch[2]
        .toLowerCase()
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (isSearchKey(key) && values.length > 0) {
        parsed.excludeKv[key] = [...(parsed.excludeKv[key] ?? []), ...values];
        continue;
      }
    }

    const kvIncludeMatch = token.match(/^([a-z_]+):([^]+)$/i);
    if (kvIncludeMatch) {
      const key = kvIncludeMatch[1].toLowerCase() as SearchKey;
      const values = kvIncludeMatch[2]
        .toLowerCase()
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (isSearchKey(key) && values.length > 0) {
        parsed.includeKv[key] = [...(parsed.includeKv[key] ?? []), ...values];
        continue;
      }
    }

    if (token.startsWith("-") || token.startsWith("!")) {
      const value = token.slice(1).toLowerCase();
      if (value) parsed.excludeTerms.push(value);
    } else {
      parsed.includeTerms.push(token.toLowerCase());
    }
  }

  return parsed;
}

function isSearchKey(value: string): value is SearchKey {
  return ["type", "district", "protocol", "status", "trace", "kind", "node", "has"].includes(value);
}

function includesAny(value: string, patterns: string[]): boolean {
  if (!patterns.length) return true;
  const lower = value.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function excludesAny(value: string, patterns: string[]): boolean {
  if (!patterns.length) return false;
  const lower = value.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function compareNumeric(op: NumericOp, value: number, expected: number): boolean {
  if (op === ">") return value > expected;
  if (op === ">=") return value >= expected;
  if (op === "<") return value < expected;
  return value <= expected;
}

export function useFilteredTopology() {
  const topology = useDashboardStore((state) => state.topology);
  const filters = useDashboardStore((state) => state.filters);
  const liveEvents = useDashboardStore((state) => state.liveEvents);
  const searchQuery = useDashboardStore((state) => state.searchQuery);
  const diagnosticFocus = useDashboardStore((state) => state.diagnosticFocus);

  return useMemo(() => {
    if (!topology) {
      return {
        topology,
        nodes: [],
        edges: [],
        events: [],
      };
    }

    const parsed = parseSearch(searchQuery);
    const districtMap = new Map(topology.districts.map((district) => [district.id, district.name.toLowerCase()]));

    const nodeIds = new Set(
      topology.nodes
        .filter((node) => {
          const districtPass =
            filters.districtIds.length === 0 || filters.districtIds.includes(node.district_id);
          const nodeTypePass =
            filters.nodeTypes.length === 0 || filters.nodeTypes.includes(node.type);
          const statusPass =
            filters.statuses.length === 0 || filters.statuses.includes(node.status);

          const includeTypePass = includesAny(node.type, parsed.includeKv.type ?? []);
          const includeDistrictPass =
            (parsed.includeKv.district?.length ?? 0) === 0 ||
            includesAny(node.district_id, parsed.includeKv.district ?? []) ||
            includesAny(districtMap.get(node.district_id) ?? "", parsed.includeKv.district ?? []);
          const includeStatusPass = includesAny(node.status, parsed.includeKv.status ?? []);
          const includeNodePass =
            includesAny(node.id, parsed.includeKv.node ?? []) || includesAny(node.name, parsed.includeKv.node ?? []);

          const excludeTypeHit = excludesAny(node.type, parsed.excludeKv.type ?? []);
          const excludeDistrictHit =
            excludesAny(node.district_id, parsed.excludeKv.district ?? []) ||
            excludesAny(districtMap.get(node.district_id) ?? "", parsed.excludeKv.district ?? []);
          const excludeStatusHit = excludesAny(node.status, parsed.excludeKv.status ?? []);
          const excludeNodeHit =
            excludesAny(node.id, parsed.excludeKv.node ?? []) ||
            excludesAny(node.name, parsed.excludeKv.node ?? []);

          const qpsValue = node.metrics?.qps ?? 0;
          const qpsPass = parsed.numeric
            .filter((expr) => expr.key === "qps")
            .every((expr) => compareNumeric(expr.op, qpsValue, expr.value));

          const includeTermPass =
            parsed.includeTerms.length === 0 ||
            parsed.includeTerms.every(
              (term) =>
                node.id.toLowerCase().includes(term) ||
                node.name.toLowerCase().includes(term) ||
                node.type.toLowerCase().includes(term) ||
                node.labels.some((label) => label.toLowerCase().includes(term)),
            );

          const excludeTermHit = parsed.excludeTerms.some(
            (term) =>
              node.id.toLowerCase().includes(term) ||
              node.name.toLowerCase().includes(term) ||
              node.type.toLowerCase().includes(term) ||
              node.labels.some((label) => label.toLowerCase().includes(term)),
          );

          return (
            districtPass &&
            nodeTypePass &&
            statusPass &&
            includeTypePass &&
            includeDistrictPass &&
            includeStatusPass &&
            includeNodePass &&
            !excludeTypeHit &&
            !excludeDistrictHit &&
            !excludeStatusHit &&
            !excludeNodeHit &&
            qpsPass &&
            includeTermPass &&
            !excludeTermHit
          );
        })
        .map((node) => node.id),
    );

    const nodes = topology.nodes.filter((node) => nodeIds.has(node.id));
    const edges = topology.edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to),
    );

    const queryTrace = parsed.includeKv.trace?.[0];
    const requiredHas = parsed.includeKv.has ?? [];
    const excludedHas = parsed.excludeKv.has ?? [];

    const events = liveEvents.filter((event) => {
      const nodePass = nodeIds.has(event.from_node) || (event.to_node ? nodeIds.has(event.to_node) : false);
      const tracePass =
        (!filters.traceId || filters.traceId === event.trace_id) &&
        (!queryTrace || event.trace_id.toLowerCase().includes(queryTrace));
      const spanKindPass =
        filters.spanKinds.length === 0 || filters.spanKinds.includes(event.span_kind);
      const statusPass =
        (filters.statuses.length === 0 || filters.statuses.includes(event.status)) &&
        includesAny(event.status, parsed.includeKv.status ?? []);
      const protocolPass = includesAny(event.protocol, parsed.includeKv.protocol ?? []);
      const kindPass = includesAny(event.span_kind, parsed.includeKv.kind ?? []);
      const nodeDslPass =
        (parsed.includeKv.node?.length ?? 0) === 0 ||
        includesAny(event.from_node, parsed.includeKv.node ?? []) ||
        includesAny(event.to_node ?? "", parsed.includeKv.node ?? []);

      const excludedStatusHit = excludesAny(event.status, parsed.excludeKv.status ?? []);
      const excludedProtocolHit = excludesAny(event.protocol, parsed.excludeKv.protocol ?? []);
      const excludedKindHit = excludesAny(event.span_kind, parsed.excludeKv.kind ?? []);
      const excludedNodeHit =
        excludesAny(event.from_node, parsed.excludeKv.node ?? []) ||
        excludesAny(event.to_node ?? "", parsed.excludeKv.node ?? []);
      const excludedTraceHit = excludesAny(event.trace_id, parsed.excludeKv.trace ?? []);

      const includeTermPass =
        parsed.includeTerms.length === 0 ||
        parsed.includeTerms.every(
          (term) =>
            event.trace_id.toLowerCase().includes(term) ||
            event.span_id.toLowerCase().includes(term) ||
            event.summary.toLowerCase().includes(term) ||
            event.protocol.toLowerCase().includes(term) ||
            event.from_node.toLowerCase().includes(term) ||
            (event.to_node?.toLowerCase().includes(term) ?? false),
        );
      const excludeTermHit = parsed.excludeTerms.some(
        (term) =>
          event.trace_id.toLowerCase().includes(term) ||
          event.span_id.toLowerCase().includes(term) ||
          event.summary.toLowerCase().includes(term) ||
          event.protocol.toLowerCase().includes(term) ||
          event.from_node.toLowerCase().includes(term) ||
          (event.to_node?.toLowerCase().includes(term) ?? false),
      );

      const latencyValue = event.latency_ms;
      const latencyPass = parsed.numeric
        .filter((expr) => expr.key === "latency")
        .every((expr) => compareNumeric(expr.op, latencyValue, expr.value));

      const hasRetry = event.retry_count > 0;
      const hasFallback = Boolean(event.fallback_from);
      const hasError = event.status === "error" || hasRetry || hasFallback;
      const hasMcp = event.protocol.toLowerCase().includes("mcp");
      const hasMap: Record<string, boolean> = {
        retry: hasRetry,
        fallback: hasFallback,
        error: hasError,
        mcp: hasMcp,
      };
      const requiredHasPass = requiredHas.every((key) => hasMap[key] ?? false);
      const excludedHasHit = excludedHas.some((key) => hasMap[key] ?? false);

      const focusPass = (() => {
        if (diagnosticFocus === "all") return true;
        if (diagnosticFocus === "errors") return hasError;
        if (diagnosticFocus === "retry_fallback") return hasRetry || hasFallback;
        if (diagnosticFocus === "slow") return event.latency_ms >= 700;
        if (diagnosticFocus === "congestion") return (event.attributes?.queue_depth as number | undefined ?? 0) >= 5;
        return true;
      })();

      return (
        nodePass &&
        tracePass &&
        spanKindPass &&
        statusPass &&
        protocolPass &&
        kindPass &&
        nodeDslPass &&
        !excludedStatusHit &&
        !excludedProtocolHit &&
        !excludedKindHit &&
        !excludedNodeHit &&
        !excludedTraceHit &&
        includeTermPass &&
        !excludeTermHit &&
        latencyPass &&
        requiredHasPass &&
        !excludedHasHit &&
        focusPass
      );
    });

    return {
      topology,
      nodes,
      edges,
      events,
    };
  }, [diagnosticFocus, filters, liveEvents, searchQuery, topology]);
}
