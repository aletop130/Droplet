"use client"

import { useEffect, useMemo, useState } from "react"
import { GeoJsonLayer, IconLayer, ScatterplotLayer } from "@deck.gl/layers"
import DeckGL from "@deck.gl/react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, MapPinned, Radio, Waves, X } from "lucide-react"
import { Map } from "react-map-gl/maplibre"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { LayerToggles, type MapLayerKey } from "@/components/map/LayerToggles"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { PhiPill } from "@/components/ui/PhiPill"
import { getDMAs, getIncidents, getSegment, getSegments, getSourceAvailability, getTank, getTanks } from "@/lib/api"
import { phiColor } from "@/lib/phi"
import { useAlertsStore } from "@/store/alertsStore"
import { useSelectionStore } from "@/store/selectionStore"
import type { DMAFeature, Incident, SegmentDetail, SegmentFeature, SourceNode, TankDetail, TankFeature } from "@/types/domain"

const ciociariaBbox = "13.2,41.4,13.8,41.9"

const initialViewState = {
  longitude: 13.53,
  latitude: 41.64,
  zoom: 9.3,
  pitch: 42,
  bearing: -12
}

const defaultLayers: Record<MapLayerKey, boolean> = {
  pipes: true,
  tanks: true,
  incidents: true,
  dmas: true,
  sources: true
}

export function DeckMap() {
  const [enabled, setEnabled] = useState<Record<MapLayerKey, boolean>>(defaultLayers)
  const [viewState, setViewState] = useState(initialViewState)
  const [segments, setSegments] = useState<SegmentFeature[]>([])
  const [tanks, setTanks] = useState<TankFeature[]>([])
  const [dmas, setDmas] = useState<DMAFeature[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [sources, setSources] = useState<SourceNode[]>([])
  const [activeSegmentDetail, setActiveSegmentDetail] = useState<SegmentDetail | null>(null)
  const [activeTankDetail, setActiveTankDetail] = useState<TankDetail | null>(null)
  const [drawerWidth, setDrawerWidth] = useState(480)
  const [dmaFilter, setDmaFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [metric, setMetric] = useState<"phi" | "headroom">("phi")
  const [dateRange, setDateRange] = useState("24h")
  const [isResizing, setIsResizing] = useState(false)
  const activeSegment = useSelectionStore((state) => state.activeSegment)
  const activeTank = useSelectionStore((state) => state.activeTank)
  const activeDMA = useSelectionStore((state) => state.activeDMA)
  const setActiveSegment = useSelectionStore((state) => state.setActiveSegment)
  const setActiveTank = useSelectionStore((state) => state.setActiveTank)
  const setActiveDMA = useSelectionStore((state) => state.setActiveDMA)
  const mapFocus = useSelectionStore((state) => state.mapFocus)
  const setMapFocus = useSelectionStore((state) => state.setMapFocus)
  const wsStatus = useAlertsStore((state) => state.wsStatus)
  const lastEvent = useAlertsStore((state) => state.events[0] ?? null)

  useEffect(() => {
    Promise.all([
      getSegments(ciociariaBbox),
      getTanks(),
      getDMAs(),
      getIncidents(),
      getSourceAvailability()
    ]).then(([segmentCollection, tankCollection, dmaList, incidentList, availability]) => {
      setSegments(segmentCollection.features)
      setTanks(tankCollection.features)
      setDmas(dmaList)
      setIncidents(incidentList.items.slice(0, 80))
      setSources(availability.sources)
    })
  }, [])

  useEffect(() => {
    if (!activeSegment) {
      setActiveSegmentDetail(null)
      return
    }
    getSegment(activeSegment).then(setActiveSegmentDetail).catch(() => setActiveSegmentDetail(null))
  }, [activeSegment])

  useEffect(() => {
    if (!activeTank) {
      setActiveTankDetail(null)
      return
    }
    getTank(activeTank).then(setActiveTankDetail).catch(() => setActiveTankDetail(null))
  }, [activeTank])

  useEffect(() => {
    function onMove(event: MouseEvent) {
      if (!isResizing) return
      setDrawerWidth((width) => Math.max(360, Math.min(680, window.innerWidth - event.clientX)))
    }
    function stop() {
      setIsResizing(false)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", stop)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", stop)
    }
  }, [isResizing])

  useEffect(() => {
    if (mapFocus) {
      setViewState((state) => ({
        ...state,
        longitude: mapFocus.longitude,
        latitude: mapFocus.latitude,
        zoom: mapFocus.zoom ?? 12.4
      }))
      setMapFocus(null)
    }
  }, [mapFocus, setMapFocus])

  const filteredSegments = useMemo(() => {
    return segments.filter((segment) => {
      if (dmaFilter !== "all" && String(segment.properties.dma_id) !== dmaFilter) return false
      if (severityFilter !== "all" && segment.properties.phi < Number(severityFilter)) return false
      return true
    })
  }, [dmaFilter, segments, severityFilter])

  const filteredTanks = useMemo(() => {
    return tanks.filter((tank) => {
      if (dmaFilter !== "all" && String(tank.properties.dma_id ?? "") !== dmaFilter) return false
      if (severityFilter !== "all" && (tank.properties.phi_signal ?? tank.properties.severity ?? 0) < Number(severityFilter)) return false
      return true
    })
  }, [dmaFilter, severityFilter, tanks])

  const highlightedAdjacentTankIds = useMemo(() => {
    if (!activeTankDetail) return new Set<number>()
    const sameDma = tanks.filter(
      (tank) =>
        tank.properties.dma_id === activeTankDetail.tank.properties.dma_id &&
        tank.properties.id !== activeTankDetail.tank.properties.id
    )
    return new Set(sameDma.slice(0, 4).map((tank) => tank.properties.id))
  }, [activeTankDetail, tanks])

  const layers = useMemo(() => {
    const built = []

    if (enabled.dmas) {
      built.push(
        new GeoJsonLayer<any>({
          id: "dmas",
          data: dmas.map((dma) => ({
            type: "Feature",
            geometry: dma.geometry,
            properties: dma
          })),
          pickable: true,
          stroked: true,
          filled: true,
          getFillColor: [75, 214, 255, 25],
          getLineColor: [75, 214, 255, 90],
          getLineWidth: 1.5,
          onClick: ({ object }) => object && setActiveDMA((object as { properties: DMAFeature }).properties.id)
        })
      )
    }

    if (enabled.pipes) {
      built.push(
        new GeoJsonLayer<any>({
          id: "pipes",
          data: {
            type: "FeatureCollection",
            features: filteredSegments
          },
          pickable: true,
          stroked: true,
          filled: false,
          lineWidthMinPixels: 2.5,
          getLineColor: (feature: any) => phiColor(feature.properties.phi) as [number, number, number, number],
          getLineWidth: (feature: any) => 2.5 + feature.properties.phi * 0.45,
          onClick: ({ object }) => object && setActiveSegment((object as SegmentFeature).properties.id)
        })
      )
    }

    if (enabled.tanks) {
      built.push(
        new ScatterplotLayer<TankFeature>({
          id: "tanks",
          data: filteredTanks,
          pickable: true,
          radiusUnits: "pixels",
          getPosition: (feature: TankFeature) => feature.geometry.coordinates,
          getRadius: (feature: TankFeature) => 12 + Math.max(0, 36 - (feature.properties.headroom_pct ?? 0)) / 5,
          getLineWidth: (feature: TankFeature) =>
            highlightedAdjacentTankIds.has(feature.properties.id) ? 5 : 2,
          filled: true,
          stroked: true,
          getFillColor: (feature: TankFeature) => {
            const alpha = Math.max(40, 140 - Math.round(feature.properties.headroom_pct ?? 0))
            return [75, 214, 255, alpha]
          },
          getLineColor: (feature: TankFeature) =>
            highlightedAdjacentTankIds.has(feature.properties.id)
              ? [251, 191, 36, 255]
              : phiColor(feature.properties.phi_signal ?? feature.properties.severity ?? 1),
          onClick: ({ object }) => object && setActiveTank((object as TankFeature).properties.id)
        })
      )
    }

    if (enabled.incidents) {
      built.push(
        new ScatterplotLayer<any>({
          id: "incidents",
          data: incidents
            .map((incident) => {
              const tank = tanks.find((item) => item.properties.id === incident.entity_id)
              const segment = segments.find((item) => item.properties.id === incident.entity_id)
              if (tank) {
                return {
                  ...incident,
                  coordinates: tank.geometry.coordinates
                }
              }
              if (segment) {
                return {
                  ...incident,
                  coordinates: segment.geometry.coordinates[Math.floor(segment.geometry.coordinates.length / 2)]
                }
              }
              return null
            })
            .filter(Boolean),
          pickable: true,
          radiusUnits: "pixels",
          getPosition: (incident: Incident & { coordinates: [number, number] }) => incident.coordinates,
          getRadius: (incident: Incident) => 10 + incident.severity * 2,
          stroked: true,
          filled: true,
          getFillColor: (incident: Incident) => phiColor(Math.min(3, incident.severity) as 0 | 1 | 2 | 3),
          getLineColor: [255, 255, 255, 180],
          onClick: ({ object }) => {
            const incident = object as Incident | undefined
            if (!incident) return
            if (incident.entity_type === "tank") setActiveTank(incident.entity_id)
            if (incident.entity_type === "segment") setActiveSegment(incident.entity_id)
          }
        })
      )
    }

    if (enabled.sources) {
      built.push(
        new ScatterplotLayer<SourceNode>({
          id: "sources",
          data: sources,
          pickable: true,
          radiusUnits: "pixels",
          getPosition: (source: SourceNode) => source.geometry.coordinates,
          getRadius: 9,
          stroked: true,
          filled: true,
          getFillColor: [186, 230, 253, 190],
          getLineColor: [216, 244, 255, 255]
        })
      )
    }

    return built
  }, [
    dmas,
    enabled,
    filteredSegments,
    filteredTanks,
    highlightedAdjacentTankIds,
    incidents,
    segments,
    setActiveDMA,
    setActiveSegment,
    setActiveTank,
    sources,
    tanks
  ])

  const drawerOpen = !!(activeSegmentDetail || activeTankDetail || activeDMA)
  const selectedDma = activeDMA ? dmas.find((dma) => dma.id === activeDMA) ?? null : null

  return (
    <div className="fixed inset-0 z-0">
      <DeckGL
        controller
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) => setViewState(nextViewState as typeof initialViewState)}
        layers={layers}
      >
        <Map mapStyle="https://tiles.openfreemap.org/styles/dark" />
      </DeckGL>

      <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4">
        <GlassCard className="pointer-events-auto w-full max-w-4xl rounded-[1.6rem] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dmaFilter}
              onChange={(event) => setDmaFilter(event.target.value)}
              className="rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(4,10,20,0.66)] px-3 py-2 text-sm text-[var(--text-hi)]"
            >
              <option value="all">Tutti i DMA</option>
              {dmas.map((dma) => (
                <option key={dma.id} value={dma.id}>
                  {dma.name}
                </option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(4,10,20,0.66)] px-3 py-2 text-sm text-[var(--text-hi)]"
            >
              <option value="all">Severity</option>
              <option value="1">≥ 1</option>
              <option value="2">≥ 2</option>
              <option value="3">≥ 3</option>
            </select>
            <select
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value)}
              className="rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(4,10,20,0.66)] px-3 py-2 text-sm text-[var(--text-hi)]"
            >
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </select>
            <select
              value={metric}
              onChange={(event) => setMetric(event.target.value as "phi" | "headroom")}
              className="rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(4,10,20,0.66)] px-3 py-2 text-sm text-[var(--text-hi)]"
            >
              <option value="phi">PHI</option>
              <option value="headroom">Headroom</option>
            </select>
          </div>
        </GlassCard>
      </div>

      <div className="pointer-events-none fixed left-4 top-32 z-20 w-[240px]">
        <GlassCard className="pointer-events-auto rounded-[1.6rem] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-[var(--text-hi)]">Layer toggles</div>
            <DataBadge label="view" value={metric} tone="neutral" />
          </div>
          <LayerToggles enabled={enabled} onToggle={(key) => setEnabled((current) => ({ ...current, [key]: !current[key] }))} />
        </GlassCard>
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-20 w-[260px]">
        <GlassCard className="pointer-events-auto rounded-[1.6rem] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-[var(--text-hi)]">Digital Twin Live</div>
              <div className="text-data text-[var(--text-lo)]">{new Date().toLocaleTimeString("it-IT")}</div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Radio className={`h-4 w-4 ${wsStatus === "open" ? "text-[var(--phi-green)]" : "text-[var(--phi-red)]"}`} />
              <span className="text-data text-[var(--text-lo)]">{wsStatus}</span>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3 text-sm text-[var(--text-md)]">
            {lastEvent ? (
              <>
                <div className="text-[var(--text-hi)]">{lastEvent.title ?? lastEvent.type}</div>
                <div className="mt-1 text-data text-[var(--text-lo)]">{lastEvent.ts ?? "live"}</div>
              </>
            ) : (
              "In attesa del prossimo evento."
            )}
          </div>
        </GlassCard>
      </div>

      <AnimatePresence>
        {drawerOpen ? (
          <motion.aside
            initial={{ x: drawerWidth + 40 }}
            animate={{ x: 0 }}
            exit={{ x: drawerWidth + 40 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            style={{ width: drawerWidth }}
            className="fixed inset-y-0 right-0 z-30 border-l border-[rgba(173,218,255,0.12)] bg-[rgba(4,10,20,0.92)] pt-20 backdrop-blur-[24px]"
          >
            <button
              type="button"
              onMouseDown={() => setIsResizing(true)}
              className="absolute left-0 top-1/2 h-20 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(75,214,255,0.26)]"
            />
            <div className="app-scroll h-full overflow-y-auto px-5 pb-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-h2 text-[var(--text-hi)]">
                  {activeSegmentDetail ? "Segment detail" : activeTankDetail ? "Tank detail" : "DMA detail"}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSegment(null)
                    setActiveTank(null)
                    setActiveDMA(null)
                  }}
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-[rgba(173,218,255,0.12)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {activeSegmentDetail ? (
                <SegmentDrawer detail={activeSegmentDetail} onOpenMap={() => setMapFocus({
                  longitude: activeSegmentDetail.segment.geometry.coordinates[0][0],
                  latitude: activeSegmentDetail.segment.geometry.coordinates[0][1],
                  zoom: 12.8
                })} />
              ) : null}

              {activeTankDetail ? (
                <TankDrawer
                  detail={activeTankDetail}
                  adjacentTanks={tanks.filter((tank) => highlightedAdjacentTankIds.has(tank.properties.id))}
                  onFocusTank={(tank) => {
                    setActiveTank(tank.properties.id)
                    setMapFocus({
                      longitude: tank.geometry.coordinates[0],
                      latitude: tank.geometry.coordinates[1],
                      zoom: 12.6
                    })
                  }}
                />
              ) : null}

              {selectedDma ? (
                <GlassCard className="rounded-[1.6rem] p-4">
                  <div className="text-sm text-[var(--text-hi)]">{selectedDma.name}</div>
                  <div className="mt-1 text-sm text-[var(--text-md)]">Popolazione servita {selectedDma.population.toLocaleString()}</div>
                </GlassCard>
              ) : null}
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SegmentDrawer({ detail, onOpenMap }: { detail: SegmentDetail; onOpenMap: () => void }) {
  const chartData = detail.history.slice(-48).map((point) => ({
    ts: new Date(point.ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    phi: point.phi,
    hydraulic: point.hydraulic,
    thermal: point.thermal
  }))

  return (
    <div className="grid gap-4">
      <GlassCard className="rounded-[1.6rem] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <PhiPill value={detail.segment.properties.phi} />
          <DataBadge label="materiale" value={detail.segment.properties.material} tone="neutral" />
          <DataBadge label="diametro" value={`${detail.segment.properties.diameter_mm} mm`} tone="neutral" />
        </div>
        <div className="mt-3 text-sm text-[var(--text-md)]">{detail.segment.properties.dma_name}</div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {Object.entries(detail.scores).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
              <div className="text-data text-[var(--text-lo)]">{key}</div>
              <div className="mt-1 text-lg text-[var(--text-hi)]">{value}</div>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="rounded-[1.6rem] p-4">
        <div className="mb-3 text-sm font-medium text-[var(--text-hi)]">Serie 90d</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
              <XAxis dataKey="ts" tick={{ fill: "#6983A3", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="phi" stroke="#4bd6ff" fill="rgba(75,214,255,0.18)" />
              <Area type="monotone" dataKey="hydraulic" stroke="#44d7c0" fill="rgba(68,215,192,0.12)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
      <div className="grid gap-2">
        {detail.incidents.slice(0, 3).map((incident) => (
          <GlassCard key={incident.id} className="rounded-[1.4rem] p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-[var(--text-hi)]">{incident.title}</div>
              <DataBadge label="sev" value={String(incident.severity)} tone="red" />
            </div>
            <div className="mt-2 text-sm text-[var(--text-md)]">{incident.pre_explanation ?? "Correlated anomaly."}</div>
          </GlassCard>
        ))}
      </div>
      <button
        type="button"
        onClick={onOpenMap}
        className="rounded-2xl border border-[rgba(75,214,255,0.24)] px-4 py-3 text-left text-sm text-[var(--acea-cyan)]"
      >
        Apri in mappa
      </button>
    </div>
  )
}

function TankDrawer({
  detail,
  adjacentTanks,
  onFocusTank
}: {
  detail: TankDetail
  adjacentTanks: TankFeature[]
  onFocusTank: (tank: TankFeature) => void
}) {
  const liveData = detail.state_24h.slice(-36).map((point) => ({
    ts: new Date(point.ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    level: point.level_m,
    inflow: point.inflow_lps
  }))

  return (
    <div className="grid gap-4">
      <GlassCard className="rounded-[1.6rem] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DataBadge label="source" value={detail.tank.properties.data_source ?? "osm"} />
          <DataBadge label="capacity" value={`${Math.round(detail.tank.properties.capacity_m3 ?? 0)} m³`} tone="neutral" />
        </div>
        <div className="mt-3 text-h2 text-[var(--text-hi)]">{detail.tank.properties.name}</div>
        <div className="mt-1 text-sm text-[var(--text-md)]">{detail.tank.properties.dma_name}</div>
      </GlassCard>
      <GlassCard className="rounded-[1.6rem] p-4">
        <div className="mb-3 text-sm font-medium text-[var(--text-hi)]">Live level 24h</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={liveData}>
              <CartesianGrid stroke="rgba(173,218,255,0.08)" vertical={false} />
              <XAxis dataKey="ts" tick={{ fill: "#6983A3", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6983A3", fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="level" stroke="#4bd6ff" fill="rgba(75,214,255,0.18)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
      <GlassCard className="rounded-[1.6rem] p-4">
        <div className="mb-3 text-sm font-medium text-[var(--text-hi)]">Rete locale</div>
        <div className="grid gap-2">
          {adjacentTanks.map((tank) => (
            <button
              key={tank.properties.id}
              type="button"
              onClick={() => onFocusTank(tank)}
              className="flex items-center justify-between rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-3 text-left"
            >
              <div>
                <div className="text-sm text-[var(--text-hi)]">{tank.properties.name}</div>
                <div className="text-data text-[var(--text-lo)]">headroom {tank.properties.headroom_pct}%</div>
              </div>
              <span className="text-sm text-[var(--phi-yellow)]">Vai a {tank.properties.name}</span>
            </button>
          ))}
        </div>
      </GlassCard>
      <GlassCard className="rounded-[1.6rem] p-4">
        <div className="mb-3 text-sm font-medium text-[var(--text-hi)]">Segmenti downstream PHI ≥ 2</div>
        <div className="grid gap-2">
          {detail.downstream_segments.slice(0, 5).map((segment) => (
            <div key={segment.properties.id} className="rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-[var(--text-hi)]">Segment {segment.properties.id}</div>
                <PhiPill value={segment.properties.phi} />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
