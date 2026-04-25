# Step 0 - Audit Report

## Executive summary

Current implementation is materially beyond "20%" on data persistence and simulation, but still well short of the product defined in `plan.md`:

- Supabase and Neo4j are already partially populated.
- Qdrant is empty.
- Backend map/tank/incidents APIs are partially real.
- Backend AI/chat/source/DMA flows are mostly stubbed or keyword-based.
- Frontend has a usable scaffold, but the main requirements from plan section 18 are still missing: full-screen map shell, real `/app/source`, global state stores, websocket alerts, OmniSearch modal, production-grade AgentChat drawer, full detail pages and route coverage.

## 0.1 Frontend audit

### Mandatory checks

| Check | Observed state | Verdict |
|---|---|---|
| Map full-screen with overlays | `frontend/app/app/map/page.tsx` wraps `MapClient` inside a centered page container; `DeckMap` uses a boxed `h-[calc(100vh-7.5rem)] rounded-lg` panel | Fails |
| AgentChat floating drawer accessible from every page | Present in `AppShell` as a fixed right drawer; opens from TopBar | Partial |
| Tank navigation by clicking map | `DeckMap` tank markers are clickable and open local detail panel | Partial |
| `/app/source` real data page | Route file missing | Fails |

Notes:

- AgentChat exists globally, but lacks shared store persistence, slash commands, citation pills, action cards and robust SSE parsing.
- Tank navigation is map-clickable, but there is no adjacency-driven "Rete Locale" flow and no highlight/center-on-related-tank workflow.

### Pages and components

| File | Stato | Gap rispetto a `plan.md` §18 |
|---|---|---|
| `frontend/app/page.tsx` | parziale | Landing present, but no animated droplet hero, no 3-pillar section, no source chips strip, no compliance badges/footer story. |
| `frontend/app/login/page.tsx` | parziale | Route exists, but UX is basic; missing centered liquid card behavior from design brief. |
| `frontend/app/layout.tsx` | parziale | Fonts are correct, but metadata/theme shell is minimal. |
| `frontend/app/app/layout.tsx` | parziale | Wraps `AppShell`; no route-level state orchestration. |
| `frontend/app/app/page.tsx` | parziale | Mission Control page exists but is scaffold-grade and not aligned to the requested dashboard composition. |
| `frontend/app/app/map/page.tsx` | parziale | Map route exists, but not full-screen/fixed and missing overlay architecture. |
| `frontend/app/app/incidents/page.tsx` | parziale | Page exists with list/modal behavior, but not the full triage queue, WS flash-in and operator action flow. |
| `frontend/app/app/audit/page.tsx` | parziale | Reads real audit rows, but no pagination/export/operator actions/doc_ids/graph path collapse. |
| `frontend/app/app/settings/page.tsx` | parziale | Static settings card only; no threshold/config/session expiry/logout flow from plan. |
| `frontend/app/app/tank/page.tsx` | parziale | Tank list exists, but plan expects richer tank fleet + drilldown workflow. |
| `frontend/app/app/tank/[id]/page.tsx` | parziale | Detail route exists, but missing live WS chart, topology viz, downstream PHI table, control actions, map handoff. |
| `frontend/app/app/segment/[id]/page.tsx` | parziale | Detail route exists, but far from requested gauges/charts/imagery/graph/action set. |
| `frontend/app/app/dma/[id]/page.tsx` | parziale | Route exists, but only balance summary; missing waterfall, KPI cards, tank ensemble, segment table, MNF chart. |
| `frontend/app/app/source/page.tsx` | stub | Missing entirely. |
| `frontend/components/shell/AppShell.tsx` | parziale | Session guard + shell exist, but no stores, route context plumbing or overlay-first map shell. |
| `frontend/components/shell/TopBar.tsx` | parziale | Has brand, search button, alert bell, chat button, logout; missing true OmniSearch modal, user menu and richer alert/chat interactions. |
| `frontend/components/shell/SideNav.tsx` | parziale | 9 entries exist, but width is fixed icon rail only; no collapsible 240px->64px nav and labels/icons mismatch with plan. |
| `frontend/components/shell/AlertBell.tsx` | stub | Static bell with red dot; no `/ws/alerts` subscription or dropdown events list. |
| `frontend/components/shell/OmniSearch.tsx` | stub | Visual button only; no modal, no keyboard shortcuts, no streaming results. |
| `frontend/components/chat/AgentChat.tsx` | parziale | Fixed drawer exists and streams simplistic SSE, but no Zustand store, session history, slash commands, citations, action cards or page-context integration. |
| `frontend/components/control/ControlRecCard.tsx` | parziale | Exists but not integrated into live incident/chat flows. |
| `frontend/components/explain/ExplainStream.tsx` | parziale | Exists, but coupled to simplified SSE schema and static backend semantics. |
| `frontend/components/map/MapClient.tsx` | parziale | Client-only dynamic import works. |
| `frontend/components/map/DeckMap.tsx` | parziale | Real deck.gl + MapLibre map exists, but only `segments` and `tanks` layers are real; incidents/DMAs/sources are toggles without real layers, no fixed full-viewport shell, no selection store, no resizable drawer. |
| `frontend/components/map/LayerToggles.tsx` | parziale | UI exists; shortcuts/badges/integration depth missing. |
| `frontend/components/login/LoginForm.tsx` | parziale | Mock auth exists; no shake/toast/liquid interaction quality. |
| `frontend/components/ui/GlassCard.tsx` | parziale | Reusable card exists, but below required visual complexity. |
| `frontend/components/ui/Input.tsx` | parziale | Styled input exists. |
| `frontend/components/ui/DataBadge.tsx` | parziale | Utility exists. |
| `frontend/components/ui/PhiPill.tsx` | parziale | Utility exists. |
| `frontend/components/ui/Button.tsx` | parziale | Basic glass button only; no `LiquidButton` behavior. |

### Missing frontend building blocks explicitly required by the plan

| Expected file/capability | State |
|---|---|
| `frontend/lib/ws.ts` | missing |
| `frontend/lib/sse.ts` | missing |
| `frontend/store/sessionStore.ts` | missing |
| `frontend/store/selectionStore.ts` | missing |
| `frontend/store/chatStore.ts` | missing |
| `frontend/store/alertsStore.ts` | missing |
| `frontend/components/ui/Gauge.tsx` | missing |
| `frontend/components/ui/LiquidButton.tsx` | missing |
| `frontend/app/app/source/page.tsx` | missing |

## 0.2 Backend audit

### Critical AI checks

| Check | Observed state | Verdict |
|---|---|---|
| `services/agent.py` calls Regolo API | No `httpx`/OpenAI-compatible client call; builds text locally from tool outputs | Fails |
| `services/chat.py` calls Regolo API | No. Returns fixed answer after keyword router | Fails |
| `services/router/brick_router.py` classifies with model | No. Pure local keyword rules | Fails |

### Routers and services

| Endpoint / servizio | Implementato | Dati reali o hardcoded |
|---|---|---|
| `backend/routers/healthz.py` | yes | real trivial status dict |
| `backend/routers/segments.py` | partial | list uses DB-backed `fetch_segments`; detail endpoint synthesizes static summary from collection in memory |
| `backend/routers/tanks.py` | partial | list uses DB-backed `fetch_tanks`; detail mixes DB list with hardcoded anomalies/related segments/tool stubs |
| `backend/routers/incidents.py` | yes | real Supabase reads/writes |
| `backend/routers/audit.py` | yes | real Supabase reads |
| `backend/routers/control.py` | partial | works, but uses in-memory `CONTROL_RECOMMENDATIONS` sample list |
| `backend/routers/dmas.py` | stub | returns `services.sample_data.DMAS` and hardcoded balance |
| `backend/routers/source.py` | stub | fully hardcoded availability + forecast dicts |
| `backend/routers/daily_digest.py` | stub | fixed scaffold digest |
| `backend/routers/chat.py` | stub | SSE wrapper over static `build_chat_response`; `search-omni` is hardcoded |
| `backend/routers/explain.py` | partial | SSE route exists, but streams local `explain_entity` text, not Regolo output |
| `backend/routers/alerts.py` | partial | real websocket endpoint; depends on synthetic sim stream |
| `backend/services/db.py` | partial | real Supabase queries with sample-data fallback; no bbox filtering in `fetch_segments`, tank headroom mapping is simplistic |
| `backend/services/sample_data.py` | stub | all sample fixtures are hardcoded |
| `backend/services/detectors.py` | partial | real synthetic scoring logic |
| `backend/services/rule_engine.py` | partial | real correlation/upsert scaffolding, synthetic semantics |
| `backend/services/epanet_sim.py` | partial | substantial synthetic telemetry writer/broadcaster; not yet tied to full operational API contract |
| `backend/services/alert_stream.py` | yes | real async pub/sub |
| `backend/services/audit.py` | yes | real audit log writer to Supabase |
| `backend/services/control_rec.py` | stub | in-memory recommendation state, audit writes real |
| `backend/services/daily_digest.py` | stub | fixed digest row payload |
| `backend/services/explainer.py` | partial | SSE stream exists but wraps local `explain_entity` output with fake pacing |
| `backend/services/agent_prompts.py` | partial | prompt constant exists |
| `backend/services/agent.py` | stub | tool orchestration exists locally, but no actual LLM call; text assembled deterministically |
| `backend/services/chat.py` | stub | static answer plus audit row |
| `backend/services/router/brick_router.py` | stub | keyword routing only, no model call |
| `backend/services/tools/*` | mixed | several tools exist, many still return fixed/demo outputs rather than live DB/Qdrant/Neo4j data |

## Additional audit findings

### Data/backend alignment

- Supabase already contains `pipe_segments=4766`, `pipe_nodes=2281`, `tank nodes=60`, `incidents=1081`, `anomaly_scores=493820`.
- Neo4j already contains `PipeSegment=4766`, `PipeNode=2281`, `DMA=4`.
- Qdrant collections exist but all have `0` points.
- `municipality_kpis` is still empty.

### Key mismatches vs plan

1. The repo is not a cold start. Step 1 should be treated as completion/repair, not first bootstrap.
2. The map experience is the main frontend gap: it is currently a page widget, not the application frame.
3. AI is the main backend gap: all operationally critical LLM paths are still local stubs.
4. `plan.md` expectations around ISTAT Tav. 23 and Tav. 29 do not exactly match the workbook currently stored in `data/raw/istat`.

## Conclusion

The platform has a real scaffold and real cloud persistence, but not yet the production-grade feature completeness required by `plan.md`. The highest-risk gaps are:

1. Real Regolo agent/chat/explain integration.
2. Qdrant population and regulatory retrieval.
3. `/app/map` redesign as full-screen operational shell.
4. Missing `/app/source` route and missing frontend state/support libraries.
