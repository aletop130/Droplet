# Step 0.4 - Cloud DB State

Snapshot date: 2026-04-25

## Supabase public tables

Query executed:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Table counts

| Table | Count |
|---|---:|
| ai_audit_log | 6 |
| anomaly_scores | 493820 |
| control_recommendations | 0 |
| daily_digest | 0 |
| dmas | 4 |
| geography_columns | 0 |
| geometry_columns | 4 |
| incidents | 1081 |
| interventions | 0 |
| municipality_kpis | 0 |
| observations | 1219680 |
| observations_2026_04 | 1219680 |
| observations_2026_05 | 0 |
| observations_2026_06 | 0 |
| observations_hourly | 0 |
| ops_log | 0 |
| pipe_nodes | 2281 |
| pipe_segments | 4766 |
| sensors | 0 |
| spatial_ref_sys | 8500 |
| tank_anomalies | 18021 |
| tank_balance | 60 |
| tank_state | 18000 |
| tank_state_2026_04 | 18000 |
| tank_state_2026_05 | 0 |
| tank_state_2026_06 | 0 |
| tank_state_hourly | 0 |

### Additional checks

| Query | Result |
|---|---:|
| `SELECT COUNT(*) FROM pipe_nodes WHERE node_type='tank'` | 60 |
| `SELECT node_type, COUNT(*) FROM pipe_nodes GROUP BY node_type` | `junction=2221`, `tank=60` |
| `SELECT COUNT(*) FROM anomaly_scores WHERE phi >= 2` | 359607 |

Assessment:

- Supabase is **not empty**. The network bootstrap is already partially done.
- `pipe_segments=4766` and `tank nodes=60` are already close to Step 1 targets.
- Gaps still visible: `municipality_kpis`, `control_recommendations`, `daily_digest`, `interventions`, `sensors`, hourly rollups all empty.

## Qdrant

Collections checked:

- `regulations`
- `incident_cases`
- `ai_decisions`

| Collection | Status | Points | Indexed vectors |
|---|---|---:|---:|
| regulations | green | 0 | 0 |
| incident_cases | green | 0 | 0 |
| ai_decisions | green | 0 | 0 |

Assessment:

- Collections exist, but **all are empty**.
- GraphRAG/regulatory lookup is therefore not bootstrapped yet.

## Neo4j

Query executed:

```cypher
MATCH (n)
RETURN labels(n)[0], count(n)
ORDER BY count(n) DESC;
```

### Node labels

| Label | Count |
|---|---:|
| PipeSegment | 4766 |
| PipeNode | 2281 |
| DMA | 4 |

### Relationship types

| Type | Count |
|---|---:|
| CONNECTS_TO | 30196 |
| STARTS_AT | 4766 |
| ENDS_AT | 4766 |
| IN_DMA | 4766 |
| UPSTREAM_OF | 180 |
| DOWNSTREAM_OF | 120 |
| SUPPLIES | 60 |

Assessment:

- Neo4j is also already partially synchronized.
- Labeling is incomplete relative to the target ontology in the plan: no dedicated `Tank` or `Reservoir` labels are present in the current snapshot.

## Overall status

The current cloud state is mixed:

- Supabase: partially seeded and actively storing simulated telemetry.
- Neo4j: partially synced topology present.
- Qdrant: structurally ready but still empty.

This means Step 1 is not a cold bootstrap anymore; it is a **repair/completion** step.
