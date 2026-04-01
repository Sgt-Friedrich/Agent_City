from __future__ import annotations

import re
from pathlib import Path
from typing import Any


class RepositoryTopologySource:
    """Static topology source from real repositories (Claude/Codex)."""

    def __init__(self, repo_root: Path, target_hint: str = "generic"):
        self.repo_root = repo_root
        self.target_hint = target_hint
        self.repo_kind = self._detect_repo_kind()

        self._components_cache: list[dict[str, Any]] | None = None
        self._relations_cache: list[dict[str, Any]] | None = None

    def config_components(self) -> list[dict[str, Any]]:
        if self._components_cache is None:
            if self.repo_kind == "claude":
                self._components_cache = self._build_claude_components()
            elif self.repo_kind == "codex":
                self._components_cache = self._build_codex_components()
            else:
                self._components_cache = self._build_generic_components()
        return self._components_cache

    def workflow_relations(self) -> list[dict[str, Any]]:
        if self._relations_cache is None:
            components = self.config_components()
            if self.repo_kind == "claude":
                self._relations_cache = self._build_claude_relations(components)
            elif self.repo_kind == "codex":
                self._relations_cache = self._build_codex_relations(components)
            else:
                self._relations_cache = self._build_generic_relations(components)
        return self._relations_cache

    def python_registration_snippets(self) -> list[dict[str, Any]]:
        if self.repo_kind == "claude":
            candidates = [
                self.repo_root / "src" / "tools.ts",
                self.repo_root / "src" / "commands" / "plan" / "plan.tsx",
                self.repo_root / "src" / "commands" / "mcp" / "mcp.tsx",
                self.repo_root / "src" / "commands" / "memory" / "memory.tsx",
                self.repo_root / "src" / "commands" / "model" / "model.tsx",
                self.repo_root / "src" / "components" / "permissions" / "PermissionPrompt.tsx",
            ]
            return self._scan_registration_snippets(candidates)

        if self.repo_kind == "codex":
            candidates = [
                self.repo_root / "codex-rs" / "cli" / "src" / "main.rs",
                self.repo_root / "codex-rs" / "core" / "src" / "lib.rs",
                self.repo_root / "codex-rs" / "core" / "src" / "mcp_connection_manager.rs",
                self.repo_root / "codex-rs" / "tools" / "src" / "lib.rs",
                self.repo_root / "codex-rs" / "execpolicy" / "src" / "lib.rs",
            ]
            return self._scan_registration_snippets(candidates)

        candidates = [
            self.repo_root / "README.md",
        ]
        return self._scan_registration_snippets(candidates)

    def _detect_repo_kind(self) -> str:
        if (self.repo_root / "codex-rs" / "Cargo.toml").exists():
            return "codex"
        if (self.repo_root / "src" / "commands").exists() and (self.repo_root / "src" / "tools").exists():
            return "claude"
        return "generic"

    def _build_claude_components(self) -> list[dict[str, Any]]:
        defs = [
            ("node.chat_gateway", "Chat Gateway", "runtime_node", "Interactive CLI and request ingress.", "src/cli", ["entry", "cli"], 1.3),
            ("node.planner_core", "Planner Core", "planner", "Plan mode and orchestration command layer.", "src/commands/plan", ["planner", "orchestrator"], 1.45),
            ("node.retriever_context", "Context Retriever", "retriever", "Context and query retrieval processing.", "src/context", ["retrieval"], 1.2),
            ("node.reranker_context", "Context Reranker", "reranker", "Ranks retrieved context before generation.", "src/query", ["retrieval", "ranking"], 1.05),
            ("node.memory_layer", "Session Memory", "memory", "Session memory and memdir persistence.", "src/services/SessionMemory", ["memory"], 1.2),
            ("node.tool_registry", "Tool Registry", "tool", "Tool definitions and routing entrypoint.", "src/tools.ts", ["tooling", "registry"], 1.35),
            ("node.shell_tool", "Shell Tool", "tool", "Bash and powershell execution toolchain.", "src/tools/BashTool", ["tool", "shell"], 1.1),
            ("node.web_tool", "Web Tool", "tool", "Web search/fetch tool integration.", "src/tools/WebSearchTool", ["tool", "web"], 1.1),
            ("node.mcp_gateway", "MCP Gateway", "mcp", "MCP command and service integration.", "src/services/mcp", ["mcp"], 1.2),
            ("node.mcp_result_adapter", "MCP Result Adapter", "runtime_node", "Transforms MCP output into model-ready context.", "src/services/mcp", ["mcp", "adapter"], 0.95),
            ("node.prompt_registry", "Prompt Registry", "prompt", "Prompt assets and templates.", "prompts", ["prompt"], 0.9),
            ("node.llm_router", "Model Gateway", "llm", "Model selection and request routing.", "src/commands/model", ["llm", "model"], 1.35),
            ("node.guardrail_policy", "Permission Guardrail", "guardrail", "Permission and policy gatekeeping.", "src/components/permissions", ["safety", "policy"], 1.1),
            ("node.fallback_router", "Fallback Router", "runtime_node", "Fallback handlers for tool failures.", "src/components/FallbackToolUseErrorMessage.tsx", ["fallback"], 0.95),
            ("node.final_renderer", "Final Renderer", "runtime_node", "Final response and message rendering.", "src/components/messages", ["output"], 1.0),
            ("node.external_web", "External Web Boundary", "external", "External web boundary for web tool calls.", "src/tools/WebFetchTool", ["external", "http"], 0.9),
        ]

        components: list[dict[str, Any]] = []
        for component_id, name, role, summary, rel_path, tags, weight in defs:
            location = self.repo_root / rel_path
            if not location.exists():
                continue
            components.append(
                {
                    "id": component_id,
                    "name": name,
                    "role": role,
                    "summary": summary,
                    "source_type": "repo_scan",
                    "source_location": str(location),
                    "tags": [*tags, "claude"],
                    "metadata": {
                        "weight": weight,
                        "status": self._status_from_role(role),
                    },
                }
            )

        return components

    def _build_codex_components(self) -> list[dict[str, Any]]:
        codex_rs = self.repo_root / "codex-rs"
        workspace_cargo = codex_rs / "Cargo.toml"
        text = workspace_cargo.read_text(encoding="utf-8", errors="ignore") if workspace_cargo.exists() else ""

        members = self._parse_workspace_members(text)
        components: list[dict[str, Any]] = []

        for member in members:
            member_path = codex_rs / member
            cargo_toml = member_path / "Cargo.toml"
            package_name = self._parse_package_name(cargo_toml)
            normalized = package_name.removeprefix("codex-") if package_name else member.replace("/", "-")
            component_id = f"node.{normalized.replace('-', '_')}"

            role = self._codex_role_for_member(member, normalized)
            tags = ["codex", "crate", member]
            summary = self._summary_for_role(role)
            weight = self._weight_for_role(role)

            components.append(
                {
                    "id": component_id,
                    "name": package_name or member,
                    "role": role,
                    "summary": summary,
                    "source_type": "cargo_workspace",
                    "source_location": str(member_path),
                    "tags": tags,
                    "metadata": {
                        "member": member,
                        "crate": package_name,
                        "weight": weight,
                        "status": self._status_from_role(role),
                    },
                }
            )

        return components

    def _build_generic_components(self) -> list[dict[str, Any]]:
        return [
            {
                "id": "node.entry",
                "name": "Entry Runtime",
                "role": "runtime_node",
                "summary": "Generic runtime entrypoint.",
                "source_type": "repo_scan",
                "source_location": str(self.repo_root),
                "tags": ["generic"],
                "metadata": {"weight": 1.0, "status": "healthy"},
            },
            {
                "id": "node.planner",
                "name": "Planner",
                "role": "planner",
                "summary": "Generic orchestration planner.",
                "source_type": "repo_scan",
                "source_location": str(self.repo_root),
                "tags": ["generic"],
                "metadata": {"weight": 1.2, "status": "healthy"},
            },
            {
                "id": "node.tooling",
                "name": "Tooling",
                "role": "tool",
                "summary": "Generic tool subsystem.",
                "source_type": "repo_scan",
                "source_location": str(self.repo_root),
                "tags": ["generic"],
                "metadata": {"weight": 1.0, "status": "warning"},
            },
        ]

    def _build_claude_relations(self, components: list[dict[str, Any]]) -> list[dict[str, Any]]:
        available = {item["id"] for item in components}
        relations: list[dict[str, Any]] = []

        def maybe_add(edge_id: str, source: str, target: str, relation_type: str, protocol: str, confidence: float):
            if source not in available or target not in available:
                return
            relations.append(
                {
                    "id": edge_id,
                    "source": source,
                    "target": target,
                    "relation_type": relation_type,
                    "protocol": protocol,
                    "confidence": confidence,
                    "inferred_from": ["claude_repository_scan"],
                    "metadata": {},
                }
            )

        maybe_add("edge.chat_planner", "node.chat_gateway", "node.planner_core", "invocation", "internal/http+json", 0.94)
        maybe_add("edge.plan_retriever", "node.planner_core", "node.retriever_context", "dependency", "internal/http+json", 0.88)
        maybe_add("edge.retriever_reranker", "node.retriever_context", "node.reranker_context", "dataflow", "internal/http+json", 0.86)
        maybe_add("edge.reranker_llm", "node.reranker_context", "node.llm_router", "dataflow", "internal/http+json", 0.84)
        maybe_add("edge.plan_memory", "node.planner_core", "node.memory_layer", "dataflow", "internal/http+json", 0.87)
        maybe_add("edge.memory_llm", "node.memory_layer", "node.llm_router", "dataflow", "internal/http+json", 0.82)
        maybe_add("edge.plan_tools", "node.planner_core", "node.tool_registry", "invocation", "tool-call", 0.93)
        maybe_add("edge.tools_shell", "node.tool_registry", "node.shell_tool", "invocation", "shell", 0.9)
        maybe_add("edge.tools_web", "node.tool_registry", "node.web_tool", "invocation", "ws", 0.9)
        maybe_add("edge.web_external", "node.web_tool", "node.external_web", "invocation", "http+json", 0.8)
        maybe_add("edge.plan_mcp", "node.planner_core", "node.mcp_gateway", "invocation", "mcp", 0.91)
        maybe_add("edge.mcp_tool", "node.mcp_gateway", "node.tool_registry", "invocation", "mcp", 0.86)
        maybe_add("edge.mcp_adapter", "node.mcp_gateway", "node.mcp_result_adapter", "dataflow", "mcp", 0.84)
        maybe_add("edge.adapter_llm", "node.mcp_result_adapter", "node.llm_router", "dataflow", "internal/http+json", 0.82)
        maybe_add("edge.plan_llm", "node.planner_core", "node.llm_router", "invocation", "internal/http+json", 0.93)
        maybe_add("edge.llm_guardrail", "node.llm_router", "node.guardrail_policy", "dataflow", "internal/http+json", 0.88)
        maybe_add("edge.guardrail_final", "node.guardrail_policy", "node.final_renderer", "invocation", "internal/http+json", 0.89)
        maybe_add("edge.llm_final", "node.llm_router", "node.final_renderer", "invocation", "internal/http+json", 0.89)
        maybe_add("edge.plan_fallback", "node.planner_core", "node.fallback_router", "fallback", "internal/http+json", 0.81)
        maybe_add("edge.fallback_final", "node.fallback_router", "node.final_renderer", "invocation", "internal/http+json", 0.83)

        return relations

    def _build_codex_relations(self, components: list[dict[str, Any]]) -> list[dict[str, Any]]:
        codex_rs = self.repo_root / "codex-rs"
        id_by_crate: dict[str, str] = {}
        id_by_member: dict[str, str] = {}

        for component in components:
            metadata = component.get("metadata", {})
            crate = metadata.get("crate")
            member = metadata.get("member")
            component_id = component["id"]
            if isinstance(crate, str) and crate:
                id_by_crate[crate] = component_id
            if isinstance(member, str) and member:
                id_by_member[member] = component_id
                id_by_member[member.replace("/", "-")] = component_id

        relations: dict[str, dict[str, Any]] = {}

        for component in components:
            metadata = component.get("metadata", {})
            member = metadata.get("member")
            if not isinstance(member, str):
                continue

            cargo_toml = codex_rs / member / "Cargo.toml"
            if not cargo_toml.exists():
                continue

            dependencies = self._parse_internal_dependencies(cargo_toml.read_text(encoding="utf-8", errors="ignore"))
            for dep in dependencies:
                dep_id = id_by_crate.get(dep)
                if dep_id is None:
                    dep_id = id_by_member.get(dep.removeprefix("codex-"))
                if dep_id is None or dep_id == component["id"]:
                    continue

                edge_id = f"edge.{component['id'].replace('.', '_')}.{dep_id.replace('.', '_')}"
                relations[edge_id] = {
                    "id": edge_id,
                    "source": component["id"],
                    "target": dep_id,
                    "relation_type": "dependency",
                    "protocol": "internal/rust-crate",
                    "confidence": 0.94,
                    "inferred_from": [str(cargo_toml)],
                    "metadata": {"dependency": dep},
                }

        return list(relations.values())

    def _build_generic_relations(self, components: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ids = {item["id"] for item in components}
        base = []
        if {"node.entry", "node.planner"}.issubset(ids):
            base.append(
                {
                    "id": "edge.generic.entry_planner",
                    "source": "node.entry",
                    "target": "node.planner",
                    "relation_type": "invocation",
                    "protocol": "internal/http+json",
                    "confidence": 0.8,
                    "inferred_from": ["generic_default"],
                    "metadata": {},
                }
            )
        if {"node.planner", "node.tooling"}.issubset(ids):
            base.append(
                {
                    "id": "edge.generic.planner_tool",
                    "source": "node.planner",
                    "target": "node.tooling",
                    "relation_type": "dependency",
                    "protocol": "tool-call",
                    "confidence": 0.8,
                    "inferred_from": ["generic_default"],
                    "metadata": {},
                }
            )
        return base

    def _parse_workspace_members(self, text: str) -> list[str]:
        match = re.search(r"members\s*=\s*\[(.*?)\]", text, re.DOTALL)
        if not match:
            return []
        return re.findall(r'"([^"]+)"', match.group(1))

    def _parse_package_name(self, cargo_toml: Path) -> str:
        if not cargo_toml.exists():
            return cargo_toml.parent.name
        text = cargo_toml.read_text(encoding="utf-8", errors="ignore")
        package_match = re.search(r"\[package\](.*?)\n\[", text + "\n[", re.DOTALL)
        package_block = package_match.group(1) if package_match else text
        name_match = re.search(r'^\s*name\s*=\s*"([^"]+)"', package_block, re.MULTILINE)
        return name_match.group(1) if name_match else cargo_toml.parent.name

    def _parse_internal_dependencies(self, text: str) -> list[str]:
        deps: set[str] = set()

        for match in re.finditer(r"(?m)^\s*([A-Za-z0-9_-]+)\s*=\s*\{([^}]*)\}", text):
            key = match.group(1)
            body = match.group(2)
            package_match = re.search(r'package\s*=\s*"([^"]+)"', body)
            name = package_match.group(1) if package_match else key.replace("_", "-")
            if name.startswith("codex-"):
                deps.add(name)

        for match in re.finditer(r'(?m)^\s*([A-Za-z0-9_-]+)\s*=\s*"[^"]+"', text):
            key = match.group(1).replace("_", "-")
            if key.startswith("codex-"):
                deps.add(key)

        return sorted(deps)

    def _scan_registration_snippets(self, candidates: list[Path]) -> list[dict[str, Any]]:
        snippets: list[dict[str, Any]] = []
        patterns = re.compile(r"register|registry|planner|mcp|tool|memory|model|policy|guard|fallback", re.IGNORECASE)

        for file_path in candidates:
            if not file_path.exists() or file_path.is_dir():
                continue

            try:
                text = file_path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue

            for line in text.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                if not patterns.search(stripped):
                    continue

                component_id = self._map_path_to_component(file_path)
                snippets.append(
                    {
                        "symbol": stripped[:180],
                        "component_id": component_id,
                        "source_location": str(file_path),
                    }
                )
                break

            if len(snippets) >= 20:
                break

        return snippets

    def _map_path_to_component(self, file_path: Path) -> str:
        path_str = str(file_path).replace("\\", "/").lower()
        candidates = [component["id"] for component in self.config_components()]

        def choose(preferred: str, fallback: str = "") -> str:
            if preferred in candidates:
                return preferred
            if fallback and fallback in candidates:
                return fallback
            return candidates[0] if candidates else "node.entry"

        if "mcp" in path_str:
            return choose("node.mcp_gateway", "node.mcp_server")
        if "tool" in path_str:
            return choose("node.tool_registry", "node.tools")
        if "memory" in path_str or "state" in path_str:
            return choose("node.memory_layer", "node.state")
        if "plan" in path_str or "core" in path_str:
            return choose("node.planner_core", "node.core")
        if "model" in path_str or "api" in path_str or "chatgpt" in path_str:
            return choose("node.llm_router", "node.codex_api")
        if "guard" in path_str or "policy" in path_str or "execpolicy" in path_str:
            return choose("node.guardrail_policy", "node.execpolicy")
        if "cli" in path_str or "tui" in path_str:
            return choose("node.chat_gateway", "node.cli")
        return candidates[0] if candidates else "node.entry"

    def _codex_role_for_member(self, member: str, normalized: str) -> str:
        key = f"{member} {normalized}".lower()
        if any(word in key for word in ["core", "rollout", "code-mode"]):
            return "planner"
        if any(word in key for word in ["file-search", "search"]):
            return "retriever"
        if "rerank" in key:
            return "reranker"
        if any(word in key for word in ["state", "secrets"]):
            return "memory"
        if any(word in key for word in ["tools", "shell-command", "exec", "apply-patch", "hooks", "plugin", "skills"]):
            return "tool"
        if any(word in key for word in ["mcp", "rmcp"]):
            return "mcp"
        if any(word in key for word in ["chatgpt", "codex-api", "responses-api-proxy", "ollama", "lmstudio"]):
            return "llm"
        if any(word in key for word in ["execpolicy", "hardening", "sandbox"]):
            return "guardrail"
        if any(word in key for word in ["cli", "tui", "protocol", "app-server", "terminal", "backend-client"]):
            return "runtime_node"
        if any(word in key for word in ["feedback", "features"]):
            return "evaluator"
        if any(word in key for word in ["connectors", "network-proxy"]):
            return "external"
        return "runtime_node"

    def _summary_for_role(self, role: str) -> str:
        summaries = {
            "planner": "Planner/orchestrator crate coordinating agent execution.",
            "retriever": "Retrieval-oriented crate for context and file search.",
            "reranker": "Reranking subsystem for retrieval results.",
            "memory": "State and memory persistence subsystem.",
            "tool": "Tool execution and integration subsystem.",
            "mcp": "MCP protocol server/client integration module.",
            "llm": "Model and inference API integration module.",
            "guardrail": "Policy/sandbox/guardrail enforcement subsystem.",
            "evaluator": "Evaluation and feedback subsystem.",
            "external": "External connectivity boundary module.",
            "runtime_node": "Runtime transport and app execution subsystem.",
        }
        return summaries.get(role, "Runtime component discovered from repository structure.")

    def _weight_for_role(self, role: str) -> float:
        weights = {
            "planner": 1.45,
            "llm": 1.35,
            "tool": 1.25,
            "mcp": 1.2,
            "retriever": 1.15,
            "memory": 1.1,
            "guardrail": 1.1,
            "runtime_node": 1.0,
            "evaluator": 0.95,
            "external": 0.9,
            "reranker": 1.0,
        }
        return weights.get(role, 1.0)

    def _status_from_role(self, role: str) -> str:
        if role in {"planner", "llm", "runtime_node"}:
            return "healthy"
        if role in {"tool", "mcp"}:
            return "warning"
        if role in {"guardrail", "evaluator"}:
            return "healthy"
        if role == "external":
            return "warning"
        return "idle"
