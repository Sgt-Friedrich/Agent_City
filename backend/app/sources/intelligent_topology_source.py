from __future__ import annotations

import math
import os
import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.parsers import ParserRegistry, default_parser_registry


@dataclass
class ClusterStat:
    file_count: int = 0
    role_scores: dict[str, float] = field(default_factory=lambda: defaultdict(float))
    sample_file: str = ""


class IntelligentTopologySource:
    """Heuristic parser for unseen agent repositories.

    This source combines directory signals, config/code keyword signals,
    import/call references, and registration markers to infer a topology.
    """

    SKIP_DIRS = {
        ".git",
        ".next",
        ".turbo",
        ".cache",
        "node_modules",
        "target",
        "build",
        "dist",
        "vendor",
        "venv",
        ".venv",
        "__pycache__",
        ".pytest_cache",
        ".mypy_cache",
    }

    ALLOWED_EXT = {
        ".py",
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        ".rs",
        ".go",
        ".java",
        ".kt",
        ".scala",
        ".cs",
        ".swift",
        ".xml",
        ".yaml",
        ".yml",
        ".json",
        ".toml",
        ".ini",
        ".md",
    }

    ROLE_HINTS: dict[str, list[str]] = {
        "agent": ["agent", "assistant", "worker", "handoff"],
        "sub_agent": ["subagent", "sub-agent", "delegate"],
        "planner": ["planner", "plan", "orchestr", "workflow", "graph", "router", "dispatch", "coordinator"],
        "retriever": ["retriev", "search", "query", "rag", "index"],
        "reranker": ["rerank", "ranker", "ranking"],
        "embedding": ["embed", "vectorize", "encoder"],
        "memory": ["memory", "state", "cache", "history", "session", "store"],
        "tool": ["tool", "plugin", "action", "function", "shell", "command", "browser", "exec"],
        "mcp": ["mcp", "modelcontextprotocol", "rmcp"],
        "llm": ["llm", "model", "inference", "provider", "chatgpt", "openai", "anthropic", "completion"],
        "prompt": ["prompt", "template", "system_prompt", "instruction"],
        "guardrail": ["guard", "policy", "safety", "moderation", "rule", "sandbox", "approval"],
        "evaluator": ["eval", "judge", "score", "feedback", "metric", "test"],
        "runtime_node": ["runtime", "entry", "main", "cli", "server", "app", "transport", "gateway", "api"],
        "external": ["http", "client", "connector", "integration", "remote", "sdk", "service"],
    }

    SUMMARY_BY_ROLE = {
        "agent": "Agent runtime/executor inferred from repository signals.",
        "sub_agent": "Delegated sub-agent subsystem inferred from coordination signals.",
        "planner": "Planning and orchestration subsystem inferred from repository signals.",
        "retriever": "Retrieval subsystem inferred from code and config structure.",
        "reranker": "Reranking/ordering subsystem inferred from architecture hints.",
        "embedding": "Embedding/vectorization subsystem inferred from code signals.",
        "memory": "Memory/state subsystem inferred from runtime and storage signals.",
        "tool": "Tool execution/registry subsystem inferred from command/tool signals.",
        "mcp": "MCP integration subsystem inferred from protocol and integration signals.",
        "llm": "Model gateway/inference subsystem inferred from provider/model signals.",
        "prompt": "Prompt/template subsystem inferred from prompt assets and templates.",
        "guardrail": "Safety/policy guardrail subsystem inferred from approval/policy signals.",
        "evaluator": "Evaluation and feedback subsystem inferred from scoring signals.",
        "runtime_node": "Runtime/session transport subsystem inferred from entrypoint signals.",
        "external": "External integration boundary inferred from connector/client signals.",
    }

    STATUS_BY_ROLE = {
        "agent": "healthy",
        "sub_agent": "healthy",
        "planner": "healthy",
        "retriever": "healthy",
        "reranker": "healthy",
        "embedding": "healthy",
        "memory": "healthy",
        "tool": "warning",
        "mcp": "warning",
        "llm": "healthy",
        "prompt": "idle",
        "guardrail": "healthy",
        "evaluator": "idle",
        "runtime_node": "healthy",
        "external": "warning",
    }

    def __init__(
        self,
        repo_root: Path,
        target_hint: str = "intelligent",
        max_files: int = 2800,
        parser_registry: ParserRegistry | None = None,
    ):
        self.repo_root = repo_root
        self.target_hint = target_hint
        self.max_files = max_files
        self._parser_registry = parser_registry or default_parser_registry()

        self._scanned = False
        self._components_cache: list[dict[str, Any]] = []
        self._relations_cache: list[dict[str, Any]] = []
        self._snippets_cache: list[dict[str, Any]] = []
        self._unresolved_hints_cache: list[str] = []

    def config_components(self) -> list[dict[str, Any]]:
        self._ensure_scan()
        return self._components_cache

    def workflow_relations(self) -> list[dict[str, Any]]:
        self._ensure_scan()
        return self._relations_cache

    def python_registration_snippets(self) -> list[dict[str, Any]]:
        self._ensure_scan()
        return self._snippets_cache

    def unresolved_hints(self) -> list[str]:
        self._ensure_scan()
        return self._unresolved_hints_cache

    def _ensure_scan(self) -> None:
        if self._scanned:
            return

        file_paths = self._collect_candidate_files()
        cluster_stats: dict[str, ClusterStat] = defaultdict(ClusterStat)
        raw_snippets: list[tuple[str, str, str]] = []
        import_signals: list[tuple[str, str, str]] = []
        unresolved_hints: set[str] = set()

        for file_path in file_paths:
            rel_path = file_path.relative_to(self.repo_root)
            rel_str = rel_path.as_posix()
            cluster_key = self._cluster_key(rel_path)

            stat = cluster_stats[cluster_key]
            stat.file_count += 1
            if not stat.sample_file:
                stat.sample_file = rel_str

            content = self._read_file_head(file_path)
            signal = self._parser_registry.parse(
                rel_path=rel_str,
                suffix=file_path.suffix.lower(),
                content=content,
            )
            for role, score in signal.role_scores.items():
                if score > 0:
                    stat.role_scores[role] += score

            for ref in signal.import_refs:
                protocol = self._infer_protocol_from_ref(ref)
                import_signals.append((cluster_key, ref, protocol))

            first_registration_line = signal.registration_line
            if first_registration_line:
                raw_snippets.append((cluster_key, first_registration_line, rel_str))

            for hint in signal.unresolved_hints:
                unresolved_hints.add(hint)

        components, cluster_to_component = self._build_components(cluster_stats)
        relations = self._build_relations(cluster_stats, cluster_to_component, import_signals)
        snippets = self._build_snippets(raw_snippets, cluster_to_component)

        self._components_cache = components
        self._relations_cache = relations
        self._snippets_cache = snippets
        self._unresolved_hints_cache = sorted(unresolved_hints)[:24]
        self._scanned = True

    def _collect_candidate_files(self) -> list[Path]:
        candidates: list[Path] = []

        for root, dirs, files in os.walk(self.repo_root):
            dirs[:] = [
                dirname
                for dirname in dirs
                if dirname not in self.SKIP_DIRS and not dirname.startswith(".")
            ]

            root_path = Path(root)
            for file_name in files:
                file_path = root_path / file_name
                if file_path.suffix.lower() not in self.ALLOWED_EXT:
                    continue

                try:
                    size = file_path.stat().st_size
                except OSError:
                    continue

                if size > 1_500_000:
                    continue

                candidates.append(file_path)

        if len(candidates) <= self.max_files:
            return sorted(candidates)

        def priority(path: Path) -> tuple[int, int, str]:
            path_lower = path.as_posix().lower()
            score = 0
            for hints in self.ROLE_HINTS.values():
                if any(hint in path_lower for hint in hints):
                    score += 1
            score += 2 if path.name.lower().startswith(("main", "index", "server", "app")) else 0
            return (score, -len(path_lower), path_lower)

        ranked = sorted(candidates, key=priority, reverse=True)
        return sorted(ranked[: self.max_files])

    def _cluster_key(self, rel_path: Path) -> str:
        parts = list(rel_path.parts)
        if not parts:
            return "root"

        first = parts[0].lower()
        if first in {"src", "lib", "app", "backend", "frontend", "services", "modules", "packages", "crates", "cmd", "internal"} and len(parts) >= 2:
            return f"{parts[0]}/{parts[1]}"

        return parts[0]

    def _read_file_head(self, file_path: Path) -> str:
        try:
            with file_path.open("r", encoding="utf-8", errors="ignore") as handle:
                return handle.read(12_000)
        except OSError:
            return ""

    def _infer_protocol_from_ref(self, ref: str) -> str:
        lower = ref.lower()
        if "mcp" in lower:
            return "mcp"
        if any(keyword in lower for keyword in ["http", "api", "rest", "client"]):
            return "http+json"
        if any(keyword in lower for keyword in ["ws", "websocket", "socket"]):
            return "ws"
        if any(keyword in lower for keyword in ["shell", "bash", "powershell", "cmd"]):
            return "shell"
        if any(keyword in lower for keyword in ["file", "fs", "path"]):
            return "fs"
        if "tool" in lower:
            return "tool-call"
        return "internal/module"

    def _build_components(
        self,
        cluster_stats: dict[str, ClusterStat],
    ) -> tuple[list[dict[str, Any]], dict[str, str]]:
        ranked_clusters: list[tuple[float, str, str, float]] = []

        for cluster, stat in cluster_stats.items():
            if not stat.role_scores:
                continue
            role, role_score = max(stat.role_scores.items(), key=lambda item: item[1])
            if role_score <= 0:
                continue

            quality = role_score + min(math.log2(stat.file_count + 1) * 0.8, 2.0)
            if quality < 1.8 and stat.file_count < 2:
                continue

            ranked_clusters.append((quality, cluster, role, role_score))

        ranked_clusters.sort(reverse=True)

        components: list[dict[str, Any]] = []
        cluster_to_component: dict[str, str] = {}
        used_ids: set[str] = set()

        for quality, cluster, role, role_score in ranked_clusters[:40]:
            component_id = self._ensure_unique_id(f"node.{self._slug(cluster)}", used_ids)
            name = f"{self._pretty_name(cluster)}"
            source_location = str(self.repo_root / cluster)

            components.append(
                {
                    "id": component_id,
                    "name": name,
                    "role": role,
                    "summary": self.SUMMARY_BY_ROLE.get(role, "Auto-discovered architecture component."),
                    "source_type": "intelligent_repo_scan",
                    "source_location": source_location,
                    "tags": ["intelligent", "auto", role],
                    "metadata": {
                        "weight": round(1.0 + min(quality / 5.0, 0.85), 2),
                        "status": self.STATUS_BY_ROLE.get(role, "healthy"),
                        "score": round(quality, 2),
                        "role_score": round(role_score, 2),
                        "file_count": cluster_stats[cluster].file_count,
                    },
                }
            )
            cluster_to_component[cluster] = component_id

        self._ensure_role_coverage(components, cluster_stats, cluster_to_component, used_ids)

        if not components:
            components.append(
                {
                    "id": "node.entry_runtime",
                    "name": "Entry Runtime",
                    "role": "runtime_node",
                    "summary": "Fallback runtime entry node.",
                    "source_type": "intelligent_repo_scan",
                    "source_location": str(self.repo_root),
                    "tags": ["intelligent", "fallback"],
                    "metadata": {"weight": 1.0, "status": "healthy", "file_count": 0},
                }
            )

        return components, cluster_to_component

    def _ensure_role_coverage(
        self,
        components: list[dict[str, Any]],
        cluster_stats: dict[str, ClusterStat],
        cluster_to_component: dict[str, str],
        used_ids: set[str],
    ) -> None:
        # Keep graceful degradation without overfitting:
        # only runtime is hard-required; other roles need concrete evidence.
        role_to_components: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for component in components:
            role_to_components[component["role"]].append(component)

        required_roles = ["runtime_node"]
        conditional_roles = ["planner", "tool", "llm", "memory", "retriever", "mcp", "guardrail", "prompt"]
        threshold_by_role = {
            "planner": 1.9,
            "tool": 2.1,
            "llm": 2.0,
            "memory": 2.2,
            "retriever": 2.2,
            "mcp": 2.1,
            "guardrail": 2.0,
            "prompt": 2.0,
        }

        for role in required_roles + conditional_roles:
            if role in role_to_components:
                continue

            cluster, score = self._best_cluster_for_role(cluster_stats, role)
            if not cluster and role in required_roles:
                cluster = "root"

            if not cluster:
                continue

            if role not in required_roles and score < threshold_by_role.get(role, 2.0):
                # Avoid forcing weakly-supported optional roles that cause false positives.
                continue

            source_location = str(self.repo_root / cluster) if cluster != "root" else str(self.repo_root)
            component_id = self._ensure_unique_id(
                f"node.{self._slug(cluster)}_{self._slug(role)}",
                used_ids,
            )

            component = {
                "id": component_id,
                "name": f"{self._pretty_name(cluster)} {role.replace('_', ' ').title()}",
                "role": role,
                "summary": self.SUMMARY_BY_ROLE.get(role, "Auto-discovered architecture component."),
                "source_type": "intelligent_repo_scan",
                "source_location": source_location,
                "tags": ["intelligent", "auto", role, "coverage", "provisional"],
                "metadata": {
                    "weight": 0.92 if role in required_roles else 0.98,
                    "status": "idle" if role not in required_roles else "healthy",
                    "file_count": cluster_stats.get(cluster, ClusterStat()).file_count,
                    "synthetic": True,
                    "provisional_reason": "coverage fallback due sparse static evidence",
                    "coverage_score": round(score, 2),
                },
            }
            components.append(component)
            role_to_components[role].append(component)

            if cluster != "root" and cluster not in cluster_to_component:
                cluster_to_component[cluster] = component_id

    def _best_cluster_for_role(self, cluster_stats: dict[str, ClusterStat], role: str) -> tuple[str | None, float]:
        best: tuple[float, str] | None = None
        for cluster, stat in cluster_stats.items():
            score = stat.role_scores.get(role, 0.0)
            if score <= 0:
                continue
            candidate = (score, cluster)
            if best is None or candidate > best:
                best = candidate
        if best is None:
            return (None, 0.0)
        return (best[1], best[0])

    def _build_relations(
        self,
        cluster_stats: dict[str, ClusterStat],
        cluster_to_component: dict[str, str],
        import_signals: list[tuple[str, str, str]],
    ) -> list[dict[str, Any]]:
        edges_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}

        known_clusters = list(cluster_to_component.keys())

        for source_cluster, import_ref, protocol in import_signals:
            source_component = cluster_to_component.get(source_cluster)
            if not source_component:
                continue

            target_cluster = self._resolve_target_cluster(import_ref, known_clusters)
            if not target_cluster:
                continue

            target_component = cluster_to_component.get(target_cluster)
            if not target_component or target_component == source_component:
                continue

            self._merge_edge(
                edges_by_key,
                source_component,
                target_component,
                relation_type="dependency",
                protocol=protocol,
                confidence=0.66,
                inferred_from=[f"import:{source_cluster}:{import_ref}"],
            )

        role_nodes = self._role_node_index()
        self._add_semantic_edges(edges_by_key, role_nodes)

        return list(edges_by_key.values())

    def _resolve_target_cluster(self, import_ref: str, known_clusters: list[str]) -> str | None:
        normalized = import_ref.lower().replace("\\", "/").replace("::", "/").replace(".", "/")
        generic_leaves = {"src", "lib", "app", "core", "services", "modules", "internal", "pkg", "cmd"}

        best_cluster: str | None = None
        best_score = 0.0

        for cluster in known_clusters:
            cluster_norm = cluster.lower().replace("\\", "/")
            leaf = cluster_norm.split("/")[-1]
            score = 0.0
            if cluster_norm in normalized:
                score += 3.0
            if leaf and len(leaf) >= 4 and leaf not in generic_leaves and leaf in normalized:
                score += 1.2
            if score > best_score:
                best_score = score
                best_cluster = cluster

        if best_score <= 0:
            return None

        return best_cluster

    def _role_node_index(self) -> dict[str, list[str]]:
        role_index: dict[str, list[str]] = defaultdict(list)

        for component in self._components_cache:
            role_index[component["role"]].append(component["id"])

        return role_index

    def _add_semantic_edges(
        self,
        edges_by_key: dict[tuple[str, str, str], dict[str, Any]],
        role_nodes: dict[str, list[str]],
    ) -> None:
        def first(role: str) -> str | None:
            nodes = role_nodes.get(role, [])
            return nodes[0] if nodes else None

        entry = first("runtime_node") or first("session") or first("event_bus")
        planner = first("planner") or first("agent")
        retriever = first("retriever")
        reranker = first("reranker")
        memory = first("memory")
        tool = first("tool")
        mcp = first("mcp")
        llm = first("llm") or first("prompt")
        guardrail = first("guardrail") or first("evaluator")
        final_node = first("runtime_node")

        self._add_semantic_edge(edges_by_key, entry, planner, "invocation", "internal/http+json", "semantic:entry->planner")
        self._add_semantic_edge(edges_by_key, planner, retriever, "dependency", "internal/http+json", "semantic:planner->retriever")
        self._add_semantic_edge(edges_by_key, retriever, reranker, "dataflow", "internal/http+json", "semantic:retriever->reranker")
        self._add_semantic_edge(edges_by_key, reranker or retriever, llm, "dataflow", "internal/http+json", "semantic:retrieval->llm")
        self._add_semantic_edge(edges_by_key, planner, memory, "dataflow", "internal/http+json", "semantic:planner->memory")
        self._add_semantic_edge(edges_by_key, memory, llm, "dataflow", "internal/http+json", "semantic:memory->llm")
        self._add_semantic_edge(edges_by_key, planner, tool, "invocation", "tool-call", "semantic:planner->tool")
        self._add_semantic_edge(edges_by_key, planner, mcp, "invocation", "mcp", "semantic:planner->mcp")
        self._add_semantic_edge(edges_by_key, mcp, tool, "invocation", "mcp", "semantic:mcp->tool")
        self._add_semantic_edge(edges_by_key, tool, llm, "dataflow", "internal/http+json", "semantic:tool->llm")
        self._add_semantic_edge(edges_by_key, planner, llm, "invocation", "internal/http+json", "semantic:planner->llm")
        self._add_semantic_edge(edges_by_key, llm, guardrail, "dataflow", "internal/http+json", "semantic:llm->guardrail")
        self._add_semantic_edge(edges_by_key, guardrail or llm, final_node, "invocation", "internal/http+json", "semantic:final")

    def _add_semantic_edge(
        self,
        edges_by_key: dict[tuple[str, str, str], dict[str, Any]],
        source: str | None,
        target: str | None,
        relation_type: str,
        protocol: str,
        inference: str,
    ) -> None:
        if not source or not target or source == target:
            return
        self._merge_edge(
            edges_by_key,
            source,
            target,
            relation_type=relation_type,
            protocol=protocol,
            confidence=0.79,
            inferred_from=[inference],
        )

    def _merge_edge(
        self,
        edges_by_key: dict[tuple[str, str, str], dict[str, Any]],
        source: str,
        target: str,
        relation_type: str,
        protocol: str,
        confidence: float,
        inferred_from: list[str],
    ) -> None:
        key = (source, target, relation_type)
        edge = edges_by_key.get(key)

        if edge is None:
            edge_id = f"edge.{source.replace('.', '_')}.{target.replace('.', '_')}.{relation_type}"
            edges_by_key[key] = {
                "id": edge_id,
                "source": source,
                "target": target,
                "relation_type": relation_type,
                "protocol": protocol,
                "confidence": confidence,
                "inferred_from": list(inferred_from),
                "metadata": {
                    "inference": "intelligent",
                },
            }
            return

        edge["confidence"] = max(edge["confidence"], confidence)
        for item in inferred_from:
            if item not in edge["inferred_from"]:
                edge["inferred_from"].append(item)

    def _build_snippets(
        self,
        raw_snippets: list[tuple[str, str, str]],
        cluster_to_component: dict[str, str],
    ) -> list[dict[str, Any]]:
        snippets: list[dict[str, Any]] = []

        for cluster, symbol, rel_file in raw_snippets[:28]:
            component_id = cluster_to_component.get(cluster)
            if component_id is None:
                component_id = self._components_cache[0]["id"] if self._components_cache else "node.entry_runtime"

            snippets.append(
                {
                    "symbol": symbol,
                    "component_id": component_id,
                    "source_location": str(self.repo_root / rel_file),
                }
            )

        return snippets

    def _ensure_unique_id(self, base_id: str, used_ids: set[str]) -> str:
        candidate = base_id
        suffix = 2
        while candidate in used_ids:
            candidate = f"{base_id}_{suffix}"
            suffix += 1
        used_ids.add(candidate)
        return candidate

    def _slug(self, value: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9]+", "_", value).strip("_").lower()
        return slug or "node"

    def _pretty_name(self, cluster: str) -> str:
        parts = re.split(r"[/_\-]+", cluster)
        title = " ".join(part.capitalize() for part in parts if part)
        return title or "Root"
