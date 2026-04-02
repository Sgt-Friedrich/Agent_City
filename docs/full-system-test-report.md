# Full System Test Report

Generated at (UTC): 2026-04-02T03:57:47.643151+00:00

## Summary
- Total checks: 7
- Passed: 7
- Failed: 0

## Results
### Backend compile
- Status: PASS
- Duration: 0.09s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe -m compileall backend/app`
- Output:
```text
Listing 'backend/app'...
Listing 'backend/app\\generators'...
Listing 'backend/app\\models'...
Listing 'backend/app\\parsers'...
Listing 'backend/app\\routers'...
Listing 'backend/app\\services'...
Listing 'backend/app\\sources'...
```

### Parser unit tests
- Status: PASS
- Duration: 0.70s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe -m unittest discover -s tests/parser -p test_*.py -v`
- Output:
```text
test_parser_analysis_edge_alias_fields (test_analysis_api.AnalysisApiTest) ... ok
test_higher_confidence_with_core_roles_and_relations (test_confidence_scoring.ConfidenceScoringServiceTest) ... ok
test_low_confidence_when_core_roles_missing (test_confidence_scoring.ConfidenceScoringServiceTest) ... ok
test_python_signals_outweigh_documentation_noise (test_intelligent_topology_source.IntelligentTopologySourceTest) ... ok
test_go_registry_signal (test_language_parsers.LanguageParsersTest) ... ok
test_java_annotation_signal (test_language_parsers.LanguageParsersTest) ... ok
test_typescript_workflow_signal (test_language_parsers.LanguageParsersTest) ... ok
test_reports_catalog_and_content (test_reports_api.ReportsApiTest) ... ok
test_alias_binding_hits_declared_edge (test_topology_binding.TopologyBindingServiceTest) ... ok
test_retry_and_fallback_inferred_edges_do_not_collapse (test_topology_binding.TopologyBindingServiceTest) ... ok
test_discovery_includes_confidence_and_unresolved (test_topology_discovery.TopologyDiscoveryTest) ... ok
test_creates_provisional_node_for_unresolved_relation_endpoint (test_topology_normalizer.TopologyNormalizerTest) ... ok

----------------------------------------------------------------------
Ran 12 tests in 0.128s

OK
```

### Parser representative retest
- Status: PASS
- Duration: 12.66s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe scripts/run_parser_retest.py`
- Output:
```text
{"targets": 8, "ok": 8}
```

### Frontend build
- Status: PASS
- Duration: 14.72s
- Command: `C:\Program Files\nodejs\npm.CMD --prefix frontend run build:clean`
- Output:
```text
> agent_city_frontend@0.1.0 build:clean
> node -e "const fs=require('fs'); if (fs.existsSync('.next')) fs.rmSync('.next',{recursive:true,force:true});" && next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/4) ...
   Generating static pages (1/4) 
   Generating static pages (2/4) 
   Generating static pages (3/4) 
 ✓ Generating static pages (4/4)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    11.1 kB         341 kB
├ ○ /_not-found                          873 B          88.2 kB
└ ƒ /replay/[traceId]                    2.78 kB         333 kB
+ First Load JS shared by all            87.4 kB
  ├ chunks/117-1d3c99a8c7ff6319.js       31.7 kB
  ├ chunks/fd9d1056-6952ca70748862da.js  53.6 kB
  └ other shared chunks (total)          1.98 kB


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

### App UI automation tests
- Status: PASS
- Duration: 34.36s
- Command: `C:\Program Files\nodejs\npm.CMD --prefix frontend run e2e`
- Output:
```text
> agent_city_frontend@0.1.0 e2e
> playwright test


Running 4 tests using 1 worker

  ok 1 [chromium] › tests\e2e\layout.spec.ts:13:5 › dashboard renders core zones and replay route is reachable (8.2s)
  ok 2 [chromium] › tests\e2e\responsive.spec.ts:11:9 › responsive layout › core dashboard zones stay visible at desktop (5.0s)
  ok 3 [chromium] › tests\e2e\responsive.spec.ts:11:9 › responsive layout › core dashboard zones stay visible at tablet (4.7s)
  ok 4 [chromium] › tests\e2e\responsive.spec.ts:11:9 › responsive layout › core dashboard zones stay visible at mobile (4.7s)

  4 passed (33.0s)
[2m[WebServer] [22mINFO:     Started server process [29912]
[2m[WebServer] [22mINFO:     Waiting for application startup.
[2m[WebServer] [22mINFO:     Application startup complete.
[2m[WebServer] [22mINFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
[2m[WebServer] [22m [33m[1m⚠[22m[39m Cross origin request detected from 127.0.0.1 to /_next/* resource. In a future major version of Next.js, you will need to explicitly configure "allowedDevOrigins" in next.config to allow this.
[2m[WebServer] [22mRead more: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
[2m[WebServer] [22mINFO:     127.0.0.1:4271 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
[2m[WebServer] [22mINFO:     127.0.0.1:13996 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
[2m[WebServer] [22mINFO:     127.0.0.1:10210 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
[2m[WebServer] [22mINFO:     127.0.0.1:2177 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
[2m[WebServer] [22mINFO:     127.0.0.1:3688 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
[2m[WebServer] [22mINFO:     127.0.0.1:14916 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
[2m[WebServer] [22mINFO:     127.0.0.1:6063 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
[2m[WebServer] [22mINFO:     127.0.0.1:6064 - "WebSocket /ws/live?target=mock" [accepted]
[2m[WebServer] [22mINFO:     connection open
[2m[WebServer] [22mINFO:     connection closed
```

### Desktop shell smoke
- Status: PASS
- Duration: 0.41s
- Command: `C:\Program Files\nodejs\npm.CMD --prefix desktop run test:smoke`
- Output:
```text
> agent_city_desktop@0.3.0 test:smoke
> node tests/smoke.js

[desktop-smoke] tauri shell files are present
```

### Reference cleanup dry-run
- Status: PASS
- Duration: 6.30s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run`
- Output:
```text
[cleanup_refs] root=D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp
[cleanup_refs] targets=['refs']
[cleanup_refs] threshold=200.0MB dry_run=True
[cleanup_refs] delete_unlisted=True keep_count=13
[KEEP]    172.49 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\mastra-ai__mastra
[KEEP]     85.48 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\microsoft__autogen
[KEEP]     68.88 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\microsoft__semantic-kernel
[KEEP]     47.16 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\elizaOS__eliza
[KEEP]     45.65 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\langchain-ai__langgraphjs
[KEEP]     25.81 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\OpenHands__OpenHands
[KEEP]     25.59 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\langchain4j__langchain4j
[KEEP]     13.61 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\langchain-ai__langgraph
[KEEP]     12.77 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\cloudwego__eino
[KEEP]     12.14 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\openai__openai-agents-python
[KEEP]     11.98 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\browser-use__browser-use
[KEEP]      6.58 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\liquidos-ai__autoagents
[KEEP]      0.00 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\agent_drop
[cleanup_refs] dry-run complete.
```
