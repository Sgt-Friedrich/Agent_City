# Full System Test Report

Generated at (UTC): 2026-04-02T07:44:23.352139+00:00

## Summary
- Total checks: 9
- Passed: 9
- Failed: 0

## Results
### Backend compile
- Status: PASS
- Duration: 0.08s
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
- Duration: 3.26s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe -m unittest discover -s tests/parser -p test_*.py -v`
- Output:
```text
test_parser_analysis_edge_alias_fields (test_analysis_api.AnalysisApiTest) ... ok
test_higher_confidence_with_core_roles_and_relations (test_confidence_scoring.ConfidenceScoringServiceTest) ... ok
test_low_confidence_when_core_roles_missing (test_confidence_scoring.ConfidenceScoringServiceTest) ... ok
test_repositories_runtime_and_settings (test_control_plane_api.ControlPlaneApiTest) ... ok
test_run_control_job (test_control_plane_api.ControlPlaneApiTest) ... ok
test_python_signals_outweigh_documentation_noise (test_intelligent_topology_source.IntelligentTopologySourceTest) ... ok
test_go_registry_signal (test_language_parsers.LanguageParsersTest) ... ok
test_java_annotation_signal (test_language_parsers.LanguageParsersTest) ... ok
test_typescript_workflow_signal (test_language_parsers.LanguageParsersTest) ... ok
test_reports_catalog_and_content (test_reports_api.ReportsApiTest) ... ok
test_target_preview_returns_parse_summary (test_topology_api_preview.TopologyPreviewApiTest) ... ok
test_alias_binding_hits_declared_edge (test_topology_binding.TopologyBindingServiceTest) ... ok
test_retry_and_fallback_inferred_edges_do_not_collapse (test_topology_binding.TopologyBindingServiceTest) ... ok
test_discovery_includes_confidence_and_unresolved (test_topology_discovery.TopologyDiscoveryTest) ... ok
test_creates_provisional_node_for_unresolved_relation_endpoint (test_topology_normalizer.TopologyNormalizerTest) ... ok

----------------------------------------------------------------------
Ran 15 tests in 2.673s

OK
```

### Parser multi-language regression
- Status: PASS
- Duration: 603.78s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe scripts/run_parser_regression.py`
- Output:
```text
{
  "requested_projects": 15,
  "tested_projects": 14,
  "successful_projects": 13,
  "skipped_projects": 1
}
```

### Parser representative retest
- Status: PASS
- Duration: 11.72s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe scripts/run_parser_retest.py`
- Output:
```text
{"targets": 8, "ok": 8}
```

### Frontend static build
- Status: PASS
- Duration: 17.68s
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
   Generating static pages (0/5) ...
   Generating static pages (1/5) 
   Generating static pages (2/5) 
   Generating static pages (3/5) 
 ✓ Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    23.9 kB         355 kB
├ ○ /_not-found                          873 B          88.4 kB
└ ○ /replay                              3.03 kB         334 kB
+ First Load JS shared by all            87.5 kB
  ├ chunks/117-494c32d987e3adcd.js       31.9 kB
  ├ chunks/fd9d1056-6952ca70748862da.js  53.6 kB
  └ other shared chunks (total)          1.98 kB


○  (Static)  prerendered as static content
```

### App UI automation tests (static bundle)
- Status: PASS
- Duration: 51.24s
- Command: `C:\Program Files\nodejs\npm.CMD --prefix frontend run e2e:app`
- Output:
```text
> agent_city_frontend@0.1.0 e2e:app
> npm run build && playwright test -c playwright.app.config.ts


> agent_city_frontend@0.1.0 build
> next build

  ▲ Next.js 14.2.35

   Creating an optimized production build ...
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
   Generating static pages (0/5) ...
   Generating static pages (1/5) 
   Generating static pages (2/5) 
   Generating static pages (3/5) 
 ✓ Generating static pages (5/5)
   Finalizing page optimization ...
   Collecting build traces ...

Route (app)                              Size     First Load JS
┌ ○ /                                    23.9 kB         355 kB
├ ○ /_not-found                          873 B          88.4 kB
└ ○ /replay                              3.03 kB         334 kB
+ First Load JS shared by all            87.5 kB
  ├ chunks/117-494c32d987e3adcd.js       31.9 kB
  ├ chunks/fd9d1056-6952ca70748862da.js  53.6 kB
  └ other shared chunks (total)          1.98 kB


○  (Static)  prerendered as static content


Running 4 tests using 1 worker

  ok 1 [chromium] › tests\e2e\layout.spec.ts:13:5 › dashboard renders core zones and replay route is reachable (10.6s)
  ok 2 [chromium] › tests\e2e\responsive.spec.ts:11:9 › responsive layout › core dashboard zones stay visible at desktop (9.1s)
  ok 3 [chromium] › tests\e2e\responsive.spec.ts:11:9 › responsive layout › core dashboard zones stay visible at tablet (4.9s)
  ok 4 [chromium] › tests\e2e\responsive.spec.ts:11:9 › responsive layout › core dashboard zones stay visible at mobile (5.9s)

  4 passed (32.6s)
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:34] "GET / HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /?target=mock HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/css/706583a2e65622a7.css HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/webpack-2bebd9ab0eb10bc4.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/fd9d1056-6952ca70748862da.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/117-494c32d987e3adcd.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/main-app-001101f18a0b500f.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/b536a0f1-9ee525c7a34dc84a.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/752-a47129c8645ac893.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/394-0a64329cfcb04538.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:35] "GET /_next/static/chunks/app/page-b260520c7aba351c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:37] "GET /_next/static/chunks/712.7a1a1d431083188c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:37] "GET /replay/index.txt?traceId=trace_88f4d7008f&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:37] "GET /_next/static/chunks/app/replay/page-46613aa4957feb3b.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:39] "GET /replay/index.txt?traceId=trace_6fecd11a4d&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:40] "GET /replay/index.txt?traceId=trace_2ba916776e&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:43] "GET /replay/index.txt?traceId=trace_11e9cc8f85&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /?target=mock HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/css/706583a2e65622a7.css HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/webpack-2bebd9ab0eb10bc4.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/fd9d1056-6952ca70748862da.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/117-494c32d987e3adcd.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/main-app-001101f18a0b500f.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/b536a0f1-9ee525c7a34dc84a.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/394-0a64329cfcb04538.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/752-a47129c8645ac893.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:46] "GET /_next/static/chunks/app/page-b260520c7aba351c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:49] "GET /_next/static/chunks/712.7a1a1d431083188c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:49] "GET /replay/index.txt?traceId=trace_3392888a53&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:49] "GET /_next/static/chunks/app/replay/page-46613aa4957feb3b.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:53] "GET /replay/index.txt?traceId=trace_dc0db58f68&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /?target=mock HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/css/706583a2e65622a7.css HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/webpack-2bebd9ab0eb10bc4.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/fd9d1056-6952ca70748862da.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/117-494c32d987e3adcd.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/b536a0f1-9ee525c7a34dc84a.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/394-0a64329cfcb04538.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/752-a47129c8645ac893.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/main-app-001101f18a0b500f.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:55] "GET /_next/static/chunks/app/page-b260520c7aba351c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:56] "GET /_next/static/chunks/712.7a1a1d431083188c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:56] "GET /replay/index.txt?traceId=trace_b293c0e577&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:56] "GET /_next/static/chunks/app/replay/page-46613aa4957feb3b.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:43:59] "GET /replay/index.txt?traceId=trace_ec03333c41&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /?target=mock HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/css/706583a2e65622a7.css HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/webpack-2bebd9ab0eb10bc4.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/fd9d1056-6952ca70748862da.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/117-494c32d987e3adcd.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/main-app-001101f18a0b500f.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/b536a0f1-9ee525c7a34dc84a.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/394-0a64329cfcb04538.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/752-a47129c8645ac893.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:00] "GET /_next/static/chunks/app/page-b260520c7aba351c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:01] "GET /_next/static/chunks/712.7a1a1d431083188c.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:01] "GET /replay/index.txt?traceId=trace_45b242d00c&target=mock&_rsc=19zvn HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:01] "GET /_next/static/chunks/app/replay/page-46613aa4957feb3b.js HTTP/1.1" 200 -
[2m[WebServer] [22m::ffff:127.0.0.1 - - [02/Apr/2026 15:44:05] "GET /replay/index.txt?traceId=trace_598c454e47&target=mock&_rsc=19zvn HTTP/1.1" 200 -
```

### Desktop app smoke
- Status: PASS
- Duration: 8.60s
- Command: `C:\Program Files\nodejs\npm.CMD run app:smoke`
- Output:
```text
> agent_city_workspace@0.2.0 app:smoke
> node scripts/start-app.js smoke

[Agent_City bootstrap] bootstrapping one-click startup...
[Agent_City bootstrap] frontend dependencies already present.
[Agent_City bootstrap] desktop dependencies already present.
[Agent_City bootstrap] frontend static bundle already present.
[Agent_City bootstrap] backend virtual environment already present.
[Agent_City bootstrap] backend Python dependencies already present.
[Agent_City bootstrap] backend service already healthy.
[Agent_City bootstrap] starting desktop shell (mode=smoke)...
[Agent_City bootstrap] link.exe detected on disk; injected linker directory into PATH: C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64
[desktop-smoke] {"shellMode":"desktop","backend":{"url":"http://127.0.0.1:8000","ready":true,"managed":false,"pid":null,"message":"external_service_detected"},"frontend":{"url":"app://agent_city","ready":true,"managed":false,"pid":null,"message":"static_bundle_ready"},"lastError":null,"updatedAt":"2026-04-02T07:44:15.171028600+00:00"}
[1m[92m   Compiling[0m agent_city_desktop v0.3.0 (D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\desktop\src-tauri)
[1m[96m    Building[0m [=======================> ] 363/364: agent_c…                                                            [1m[92m    Finished[0m `dev` profile [unoptimized + debuginfo] target(s) in 4.53s
```

### Desktop shell smoke
- Status: PASS
- Duration: 0.43s
- Command: `C:\Program Files\nodejs\npm.CMD --prefix desktop run test:smoke`
- Output:
```text
> agent_city_desktop@0.3.0 test:smoke
> node tests/smoke.js

[desktop-smoke] tauri shell files are present
```

### Reference cleanup dry-run
- Status: PASS
- Duration: 7.69s
- Command: `C:\Users\ASUS\AppData\Local\Programs\Python\Python310\python.exe scripts/cleanup_refs.py --root . --targets refs --threshold-mb 200 --keep-list-file docs/parser-tested-keep.txt --delete-unlisted --dry-run`
- Output:
```text
[cleanup_refs] root=D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp
[cleanup_refs] targets=['refs']
[cleanup_refs] threshold=200.0MB dry_run=True
[cleanup_refs] delete_unlisted=True keep_count=13
[DELETE(size)]    331.67 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\crewAIInc__crewAI
[KEEP]    172.49 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\mastra-ai__mastra
[DELETE(unlisted)]     96.93 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\pydantic__pydantic-ai
[KEEP]     85.48 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\microsoft__autogen
[KEEP]     68.88 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\microsoft__semantic-kernel
[KEEP]     47.16 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\elizaOS__eliza
[KEEP]     45.65 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\langchain-ai__langgraphjs
[DELETE(unlisted)]     29.59 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\swe-agent__swe-agent
[KEEP]     25.81 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\OpenHands__OpenHands
[KEEP]     25.59 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\langchain4j__langchain4j
[KEEP]     13.61 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\langchain-ai__langgraph
[KEEP]     12.77 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\cloudwego__eino
[KEEP]     12.14 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\openai__openai-agents-python
[KEEP]     11.98 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\browser-use__browser-use
[KEEP]      6.58 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\liquidos-ai__autoagents
[DELETE(unlisted)]      0.00 MB  D:\others\OD\OneDrive - University of Glasgow\桌面\claude code\agent-city-mvp\refs\agent_drop
[cleanup_refs] dry-run complete.
```
