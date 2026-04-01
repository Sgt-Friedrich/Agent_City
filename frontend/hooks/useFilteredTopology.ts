"use client";

import { useMemo } from "react";

import { useDashboardStore } from "@/store/useDashboardStore";

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

    const nodeIds = new Set(
      topology.nodes
        .filter((node) => {
          const q = searchQuery.trim().toLowerCase();
          const districtPass =
            filters.districtIds.length === 0 || filters.districtIds.includes(node.district_id);
          const nodeTypePass =
            filters.nodeTypes.length === 0 || filters.nodeTypes.includes(node.type);
          const statusPass =
            filters.statuses.length === 0 || filters.statuses.includes(node.status);
          const searchPass =
            q.length === 0 ||
            node.id.toLowerCase().includes(q) ||
            node.name.toLowerCase().includes(q) ||
            node.type.toLowerCase().includes(q) ||
            node.labels.some((label) => label.toLowerCase().includes(q));
          return districtPass && nodeTypePass && statusPass && searchPass;
        })
        .map((node) => node.id),
    );

    const nodes = topology.nodes.filter((node) => nodeIds.has(node.id));
    const edges = topology.edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to),
    );

    const events = liveEvents.filter((event) => {
      const q = searchQuery.trim().toLowerCase();
      const nodePass = nodeIds.has(event.from_node) || (event.to_node ? nodeIds.has(event.to_node) : false);
      const tracePass = !filters.traceId || filters.traceId === event.trace_id;
      const spanKindPass =
        filters.spanKinds.length === 0 || filters.spanKinds.includes(event.span_kind);
      const statusPass = filters.statuses.length === 0 || filters.statuses.includes(event.status);
      const searchPass =
        q.length === 0 ||
        event.trace_id.toLowerCase().includes(q) ||
        event.span_id.toLowerCase().includes(q) ||
        event.summary.toLowerCase().includes(q) ||
        event.protocol.toLowerCase().includes(q) ||
        event.from_node.toLowerCase().includes(q) ||
        (event.to_node?.toLowerCase().includes(q) ?? false);
      return nodePass && tracePass && spanKindPass && statusPass && searchPass;
    });

    return {
      topology,
      nodes,
      edges,
      events,
    };
  }, [filters, liveEvents, searchQuery, topology]);
}
