"use client";

import { useMemo } from "react";

import { useDashboardStore } from "@/store/useDashboardStore";

type SearchKey = "type" | "district" | "protocol" | "status" | "trace" | "kind" | "node";

interface ParsedSearch {
  terms: string[];
  kv: Partial<Record<SearchKey, string[]>>;
}

function parseSearch(raw: string): ParsedSearch {
  const tokens = raw
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const kv: Partial<Record<SearchKey, string[]>> = {};
  const terms: string[] = [];

  for (const token of tokens) {
    const sep = token.indexOf(":");
    if (sep <= 0) {
      terms.push(token.toLowerCase());
      continue;
    }
    const key = token.slice(0, sep).toLowerCase() as SearchKey;
    const value = token.slice(sep + 1).toLowerCase();
    if (!value.length) continue;
    if (["type", "district", "protocol", "status", "trace", "kind", "node"].includes(key)) {
      kv[key] = [...(kv[key] ?? []), value];
    } else {
      terms.push(token.toLowerCase());
    }
  }

  return { terms, kv };
}

function matchAny(value: string, patterns: string[]): boolean {
  if (!patterns.length) return true;
  const lower = value.toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

export function useFilteredTopology() {
  const topology = useDashboardStore((state) => state.topology);
  const filters = useDashboardStore((state) => state.filters);
  const liveEvents = useDashboardStore((state) => state.liveEvents);
  const searchQuery = useDashboardStore((state) => state.searchQuery);

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

          const kvTypePass = matchAny(node.type, parsed.kv.type ?? []);
          const kvDistrictPass =
            (parsed.kv.district?.length ?? 0) === 0 ||
            matchAny(node.district_id, parsed.kv.district ?? []) ||
            matchAny(districtMap.get(node.district_id) ?? "", parsed.kv.district ?? []);
          const kvStatusPass = matchAny(node.status, parsed.kv.status ?? []);
          const kvNodePass = matchAny(node.id, parsed.kv.node ?? []) || matchAny(node.name, parsed.kv.node ?? []);

          const freeTextPass =
            parsed.terms.length === 0 ||
            parsed.terms.every(
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
            kvTypePass &&
            kvDistrictPass &&
            kvStatusPass &&
            kvNodePass &&
            freeTextPass
          );
        })
        .map((node) => node.id),
    );

    const nodes = topology.nodes.filter((node) => nodeIds.has(node.id));
    const edges = topology.edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to),
    );

    const queryTrace = parsed.kv.trace?.[0];

    const events = liveEvents.filter((event) => {
      const nodePass = nodeIds.has(event.from_node) || (event.to_node ? nodeIds.has(event.to_node) : false);
      const tracePass =
        (!filters.traceId || filters.traceId === event.trace_id) &&
        (!queryTrace || event.trace_id.toLowerCase().includes(queryTrace));
      const spanKindPass =
        filters.spanKinds.length === 0 || filters.spanKinds.includes(event.span_kind);
      const statusPass =
        (filters.statuses.length === 0 || filters.statuses.includes(event.status)) &&
        matchAny(event.status, parsed.kv.status ?? []);
      const protocolPass = matchAny(event.protocol, parsed.kv.protocol ?? []);
      const kindPass = matchAny(event.span_kind, parsed.kv.kind ?? []);
      const nodeDslPass =
        (parsed.kv.node?.length ?? 0) === 0 ||
        matchAny(event.from_node, parsed.kv.node ?? []) ||
        matchAny(event.to_node ?? "", parsed.kv.node ?? []);

      const freeTextPass =
        parsed.terms.length === 0 ||
        parsed.terms.every(
          (term) =>
            event.trace_id.toLowerCase().includes(term) ||
            event.span_id.toLowerCase().includes(term) ||
            event.summary.toLowerCase().includes(term) ||
            event.protocol.toLowerCase().includes(term) ||
            event.from_node.toLowerCase().includes(term) ||
            (event.to_node?.toLowerCase().includes(term) ?? false),
        );

      return nodePass && tracePass && spanKindPass && statusPass && protocolPass && kindPass && nodeDslPass && freeTextPass;
    });

    return {
      topology,
      nodes,
      edges,
      events,
    };
  }, [filters, liveEvents, searchQuery, topology]);
}

