CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS pipe_nodes (
  id          SERIAL PRIMARY KEY,
  geom        GEOMETRY(POINT, 4326) NOT NULL,
  elevation_m FLOAT,
  node_type   TEXT NOT NULL CHECK (node_type IN
              ('junction','tank','reservoir',
               'source_spring','source_well','source_surface')),
  name        TEXT,
  attrs       JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_nodes_geom ON pipe_nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON pipe_nodes (node_type);

CREATE TABLE IF NOT EXISTS dmas (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  geom        GEOMETRY(POLYGON, 4326) NOT NULL,
  population  INT,
  operator    TEXT,
  attrs       JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_dmas_geom ON dmas USING GIST (geom);

CREATE TABLE IF NOT EXISTS pipe_segments (
  id                SERIAL PRIMARY KEY,
  geom              GEOMETRY(LINESTRING, 4326) NOT NULL,
  length_m          FLOAT NOT NULL,
  diameter_mm       INT,
  material          TEXT,
  install_year      INT,
  dma_id            INT REFERENCES dmas(id),
  from_node         INT REFERENCES pipe_nodes(id),
  to_node           INT REFERENCES pipe_nodes(id),
  subsidence_score  FLOAT,
  attrs             JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_segments_geom ON pipe_segments USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_segments_dma ON pipe_segments (dma_id);

CREATE TABLE IF NOT EXISTS sensors (
  id           SERIAL PRIMARY KEY,
  geom         GEOMETRY(POINT, 4326),
  kind         TEXT NOT NULL CHECK (kind IN
               ('pressure','flow','tank_level','tank_inflow','tank_outflow',
                'turbidity','temperature','pump_state','valve_state')),
  segment_id   INT REFERENCES pipe_segments(id),
  node_id      INT REFERENCES pipe_nodes(id),
  galileo_has  BOOL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS observations (
  id          BIGSERIAL,
  ts          TIMESTAMPTZ NOT NULL,
  segment_id  INT,
  node_id     INT,
  dma_id      INT,
  sensor_id   INT,
  metric      TEXT NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  confidence  FLOAT,
  source      TEXT NOT NULL CHECK (source IN
              ('s2','s3','ecostress','era5','egms','grace','gsw',
               'scada','epanet_sim','telecontrol_sim')),
  provenance  JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (id, ts)
) PARTITION BY RANGE (ts);
CREATE INDEX IF NOT EXISTS idx_obs_seg_ts  ON observations (segment_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_obs_node_ts ON observations (node_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_obs_dma_ts  ON observations (dma_id, ts DESC);

CREATE TABLE IF NOT EXISTS anomaly_scores (
  segment_id      INT NOT NULL,
  ts              TIMESTAMPTZ NOT NULL,
  subsidence      FLOAT,
  ndvi            FLOAT,
  thermal         FLOAT,
  hydraulic       FLOAT,
  tank_signal     FLOAT,
  phi             INT NOT NULL CHECK (phi BETWEEN 0 AND 3),
  phi_confidence  FLOAT,
  explanation     TEXT,
  PRIMARY KEY (segment_id, ts)
);

CREATE TABLE IF NOT EXISTS tank_state (
  tank_id                 INT REFERENCES pipe_nodes(id),
  ts                      TIMESTAMPTZ NOT NULL,
  level_m                 FLOAT,
  volume_m3               FLOAT,
  inflow_lps              FLOAT,
  outflow_lps             FLOAT,
  pump_on                 BOOL,
  pump_speed_pct          FLOAT,
  valve_state             JSONB,
  downstream_pressure_bar FLOAT,
  temp_c                  FLOAT,
  turbidity_ntu           FLOAT,
  PRIMARY KEY (tank_id, ts)
) PARTITION BY RANGE (ts);

CREATE TABLE IF NOT EXISTS tank_balance (
  tank_id             INT,
  day                 DATE,
  inflow_m3           FLOAT,
  outflow_m3          FLOAT,
  demand_m3           FLOAT,
  delta_volume_m3     FLOAT,
  residual_m3         FLOAT,
  residual_pct        FLOAT,
  flag                TEXT,
  PRIMARY KEY (tank_id, day)
);

CREATE TABLE IF NOT EXISTS tank_anomalies (
  id                BIGSERIAL PRIMARY KEY,
  tank_id           INT NOT NULL,
  ts                TIMESTAMPTZ NOT NULL,
  detector          TEXT NOT NULL CHECK (detector IN
                    ('mass_balance','zscore','iforest','lstm')),
  score             FLOAT NOT NULL,
  severity          INT NOT NULL CHECK (severity BETWEEN 0 AND 3),
  features          JSONB,
  explanation       TEXT,
  linked_segments   INT[]
);

CREATE TABLE IF NOT EXISTS municipality_kpis (
  comune                TEXT,
  year                  INT,
  nrw_pct               FLOAT,
  volume_input_m3       BIGINT,
  volume_distributed_m3 BIGINT,
  losses_m3             BIGINT,
  ili                   FLOAT,
  uarl_m3               FLOAT,
  PRIMARY KEY (comune, year)
);

CREATE TABLE IF NOT EXISTS interventions (
  id                         SERIAL PRIMARY KEY,
  segment_id                 INT REFERENCES pipe_segments(id),
  priority                   FLOAT,
  action                     TEXT CHECK (action IN
                             ('replace','repair','monitor','inspect')),
  cost_eur                   FLOAT,
  expected_nrw_reduction_pct FLOAT,
  status                     TEXT DEFAULT 'proposed' CHECK (status IN
                             ('proposed','approved','done','rejected')),
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  approved_by                TEXT,
  approved_at                TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hydrogeology_zones (
  id              SERIAL PRIMARY KEY,
  zone_id         INT,
  falde_id        TEXT NOT NULL,
  geom            GEOMETRY(POLYGON, 4326),
  profondita_m    FLOAT NOT NULL,
  tipo_acqua      TEXT NOT NULL,
  attrs           JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_hydrogeology_geom ON hydrogeology_zones USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_hydrogeology_zone ON hydrogeology_zones (zone_id);

CREATE TABLE IF NOT EXISTS investment_calculations (
  id                         BIGSERIAL PRIMARY KEY,
  created_at                 TIMESTAMPTZ DEFAULT NOW(),
  node_id                    INT,
  segment_id                 INT REFERENCES pipe_segments(id),
  capital_cost_eur           FLOAT NOT NULL,
  saved_consumption_m3_year  FLOAT NOT NULL,
  avoided_losses_m3_year     FLOAT NOT NULL,
  roi_pct                    FLOAT NOT NULL,
  payback_years              FLOAT,
  arera_indicator_payload    JSONB DEFAULT '{}'::jsonb,
  status                     TEXT DEFAULT 'draft' CHECK (status IN ('draft','proposed','approved','rejected'))
);

CREATE TABLE IF NOT EXISTS copernicus_products (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('s2', 's3')),
  product_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  bbox JSONB NOT NULL,
  cloud_cover_pct FLOAT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ingested', 'failed')),
  file_url TEXT,
  metrics JSONB DEFAULT '{}'::jsonb,
  provenance JSONB DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_copernicus_source_ts ON copernicus_products (source, ts DESC);

CREATE OR REPLACE VIEW investment_opportunities AS
WITH latest_anomaly AS (
  SELECT DISTINCT ON (segment_id)
    segment_id,
    hydraulic,
    phi
  FROM anomaly_scores
  ORDER BY segment_id, ts DESC
)
SELECT
  ps.id AS segment_id,
  ps.from_node AS node_id,
  ST_Y(ST_LineInterpolatePoint(ps.geom, 0.5)) AS lat,
  ST_X(ST_LineInterpolatePoint(ps.geom, 0.5)) AS lon,
  hz.falde_id,
  COALESCE(hz.profondita_m, 18 + COALESCE(la.phi, 0) * 14) AS profondita_m,
  COALESCE(hz.tipo_acqua, 'synthetic aquifer') AS tipo_acqua,
  ROUND((480000 + COALESCE(la.hydraulic, 0.52) * 520000 + COALESCE(la.phi, 0) * 60000)::numeric, 2) AS consumo_storico,
  ROUND(GREATEST(0.35, 0.74 - COALESCE(la.hydraulic, 0.52) * 0.16 - COALESCE(la.phi, 0) * 0.035)::numeric, 3) AS rendimento_attuale,
  CASE
    WHEN COALESCE(hz.profondita_m, 18 + COALESCE(la.phi, 0) * 14) > 50 OR COALESCE(la.phi, 0) >= 3 THEN 'critical'
    WHEN COALESCE(hz.profondita_m, 18 + COALESCE(la.phi, 0) * 14) BETWEEN 25 AND 50 OR COALESCE(la.phi, 0) = 2 THEN 'warning'
    ELSE 'ok'
  END AS intervento_priorita
FROM pipe_segments ps
LEFT JOIN latest_anomaly la ON la.segment_id = ps.id
LEFT JOIN hydrogeology_zones hz ON hz.zone_id = ps.dma_id
ORDER BY intervento_priorita, consumo_storico DESC;

CREATE TABLE IF NOT EXISTS incidents (
  id                BIGSERIAL PRIMARY KEY,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  entity_type       TEXT CHECK (entity_type IN ('segment','tank','dma','source')),
  entity_id         INT,
  severity          INT NOT NULL CHECK (severity BETWEEN 0 AND 3),
  detector_events   JSONB,
  tags              TEXT[],
  title             TEXT,
  pre_explanation   TEXT,
  status            TEXT DEFAULT 'open' CHECK (status IN
                    ('open','in_progress','resolved','dismissed')),
  assigned_to       TEXT,
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_incidents_sev ON incidents (severity DESC, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS control_recommendations (
  id               BIGSERIAL PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  incident_id      BIGINT REFERENCES incidents(id),
  entity_type      TEXT CHECK (entity_type IN ('tank','pump','valve','prv','dma','segment')),
  entity_id        INT,
  parameter        TEXT NOT NULL,
  current_value    DOUBLE PRECISION,
  proposed_value   DOUBLE PRECISION,
  rationale        TEXT NOT NULL,
  expected_impact  JSONB,
  confidence       FLOAT,
  risk_flags       TEXT[],
  status           TEXT DEFAULT 'proposed' CHECK (status IN
                   ('proposed','approved','rejected','expired','applied_in_sim')),
  approved_by      TEXT,
  approved_at      TIMESTAMPTZ,
  audit_log_id     BIGINT
);

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id                  BIGSERIAL PRIMARY KEY,
  ts                  TIMESTAMPTZ DEFAULT NOW(),
  model               TEXT NOT NULL,
  purpose             TEXT NOT NULL,
  entity_type         TEXT,
  entity_id           INT,
  incident_id         BIGINT REFERENCES incidents(id),
  request_payload     JSONB NOT NULL,
  response_text       TEXT NOT NULL,
  confidence          FLOAT,
  tool_calls          JSONB,
  retrieved_doc_ids   TEXT[],
  graph_path          JSONB,
  explanation_chain   JSONB,
  operator_action     TEXT,
  operator_id         TEXT,
  operator_note       TEXT,
  latency_ms          INT,
  token_usage         JSONB
);
CREATE INDEX IF NOT EXISTS idx_audit_purpose_ts ON ai_audit_log (purpose, ts DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'control_recommendations_audit_log_id_fkey'
  ) THEN
    ALTER TABLE control_recommendations
      ADD CONSTRAINT control_recommendations_audit_log_id_fkey
      FOREIGN KEY (audit_log_id) REFERENCES ai_audit_log(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS daily_digest (
  day               DATE PRIMARY KEY,
  generated_at      TIMESTAMPTZ DEFAULT NOW(),
  top_incidents     JSONB,
  trend_summary     TEXT,
  intervention_recs JSONB,
  audit_log_id      BIGINT REFERENCES ai_audit_log(id)
);

CREATE TABLE IF NOT EXISTS observations_hourly (
  hour        TIMESTAMPTZ,
  segment_id  INT,
  node_id     INT,
  dma_id      INT,
  metric      TEXT,
  source      TEXT,
  v_mean      DOUBLE PRECISION,
  v_min       DOUBLE PRECISION,
  v_max       DOUBLE PRECISION,
  v_count     INT,
  PRIMARY KEY (hour, segment_id, node_id, dma_id, metric, source)
);
CREATE INDEX IF NOT EXISTS idx_obsh_seg ON observations_hourly (segment_id, hour DESC);
CREATE INDEX IF NOT EXISTS idx_obsh_dma ON observations_hourly (dma_id, hour DESC);

CREATE TABLE IF NOT EXISTS tank_state_hourly (
  hour                       TIMESTAMPTZ,
  tank_id                    INT,
  level_m_mean               FLOAT,
  level_m_min                FLOAT,
  level_m_max                FLOAT,
  inflow_lps_mean            FLOAT,
  outflow_lps_mean           FLOAT,
  pump_on_frac               FLOAT,
  downstream_pressure_bar_m  FLOAT,
  PRIMARY KEY (hour, tank_id)
);

CREATE TABLE IF NOT EXISTS ops_log (
  id             BIGSERIAL PRIMARY KEY,
  ts             TIMESTAMPTZ DEFAULT NOW(),
  job            TEXT NOT NULL,
  status         TEXT NOT NULL,
  rows_rolled_up BIGINT DEFAULT 0,
  rows_deleted   BIGINT DEFAULT 0,
  details        JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS observations_2026_04 PARTITION OF observations
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS observations_2026_05 PARTITION OF observations
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS observations_2026_06 PARTITION OF observations
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS tank_state_2026_04 PARTITION OF tank_state
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE IF NOT EXISTS tank_state_2026_05 PARTITION OF tank_state
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS tank_state_2026_06 PARTITION OF tank_state
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
