"use client";

import { useMemo } from "react";

import { useDashboardStore } from "@/store/useDashboardStore";

export function useFilteredTopology() {
  const topology = useDashboardStore((state) => state.topology);
  const filters = useDashboardStore((state) => state.filters);
  const liveEvents = useDashboardStore((state) => state.liveEvents);

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
          const districtPass =
            filters.districtIds.length === 0 || filters.districtIds.includes(node.district_id);
          const nodeTypePass =
            filters.nodeTypes.length === 0 || filters.nodeTypes.includes(node.type);
          const statusPass =
            filters.statuses.length === 0 || filters.statuses.includes(node.status);
          return districtPass && nodeTypePass && statusPass;
        })
        .map((node) => node.id),
    );

    const nodes = topology.nodes.filter((node) => nodeIds.has(node.id));
    const edges = topology.edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to),
    );

    const events = liveEvents.filter((event) => {
      const nodePass = nodeIds.has(event.from_node) || (event.to_node ? nodeIds.has(event.to_node) : false);
      const tracePass = !filters.traceId || filters.traceId === event.trace_id;
      const spanKindPass =
        filters.spanKinds.length === 0 || filters.spanKinds.includes(event.span_kind);
      const statusPass = filters.statuses.length === 0 || filters.statuses.includes(event.status);
      return nodePass && tracePass && spanKindPass && statusPass;
    });

    return {
      topology,
      nodes,
      edges,
      events,
    };
  }, [filters, liveEvents, topology]);
}
