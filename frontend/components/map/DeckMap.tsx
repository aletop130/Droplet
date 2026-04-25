"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers"
import DeckGL from "@deck.gl/react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, Radio, X } from "lucide-react"
import { Map, type MapRef } from "react-map-gl/maplibre"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { LayerToggles, type MapLayerKey } from "@/components/map/LayerToggles"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { PhiPill } from "@/components/ui/PhiPill"
import { phiColor } from "@/lib/phi"
import { useAlertsStore } from "@/store/alertsStore"
import { useDataStore } from "@/store/dataStore"
import { useSelectionStore } from "@/store/selectionStore"
import type { DMAFeature, Incident, SegmentDetail, SegmentFeature, SourceNode, TankDetail, TankFeature } from "@/types/domain"

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

function buildSolidImage(width: number, height: number, rgba: [number, number, number, number]) {
  const data = new Uint8Array(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4
    data[offset] = rgba[0]
    data[offset + 1] = rgba[1]
    data[offset + 2] = rgba[2]
    data[offset + 3] = rgba[3]
  }
  return { width, height, data }
}

function buildCircleImage(size: number, rgba: [number, number, number, number]) {
  const data = new Uint8Array(size * size * 4)
  const radius = size / 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - radius + 0.5
      const dy = y - radius + 0.5
      if (dx * dx + dy * dy > radius * radius) continue
      const offset = (y * size + x) * 4
      data[offset] = rgba[0]
      data[offset + 1] = rgba[1]
      data[offset + 2] = rgba[2]
      data[offset + 3] = rgba[3]
    }
  }
  return { width: size, height: size, data }
}

export function DeckMap() {
  const mapRef = useRef<MapRef | null>(null)
  const [enabled, setEnabled] = useState<Record<MapLayerKey, boolean>>(defaultLayers)
  const [viewState, setViewState] = useState(initialViewState)
  const segments = useDataStore((state) => state.segments) ?? ([] as SegmentFeature[])
  const tanks = useDataStore((state) => state.tanks) ?? ([] as TankFeature[])
  const dmas = useDataStore((state) => state.dmas) ?? ([] as DMAFeature[])
  const incidents = useDataStore((state) => state.incidents)?.slice(0, 80) ?? ([] as Incident[])
  const sources = useDataStore((state) => state.sources) ?? ([] as SourceNode[])
  const segmentDetailsById = useDataStore((state) => state.segmentDetailsById)
  const tankDetailsById = useDataStore((state) => state.tankDetailsById)
  const fetchCore = useDataStore((state) => state.fetchCore)
  const fetchSegmentDetail = useDataStore((state) => state.fetchSegmentDetail)
  const fetchTankDetail = useDataStore((state) => state.fetchTankDetail)
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
    void fetchCore()
  }, [fetchCore])

  useEffect(() => {
    if (!activeSegment) {
      setActiveSegmentDetail(null)
      return
    }
    if (segmentDetailsById[activeSegment]) {
      setActiveSegmentDetail(segmentDetailsById[activeSegment])
      return
    }
    let cancelled = false
    void fetchSegmentDetail(activeSegment)
      .then((detail) => {
        if (!cancelled) setActiveSegmentDetail(detail)
      })
      .catch(() => {
        if (!cancelled) setActiveSegmentDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeSegment, fetchSegmentDetail, segmentDetailsById])

  useEffect(() => {
    if (!activeTank) {
      setActiveTankDetail(null)
      return
    }
    if (tankDetailsById[activeTank]) {
      setActiveTankDetail(tankDetailsById[activeTank])
      return
    }
    let cancelled = false
    void fetchTankDetail(activeTank)
      .then((detail) => {
        if (!cancelled) setActiveTankDetail(detail)
      })
      .catch(() => {
        if (!cancelled) setActiveTankDetail(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeTank, fetchTankDetail, tankDetailsById])

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

  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    const styleMap = map

    function handleStyleImageMissing(event: { id: string }) {
      if (styleMap.hasImage(event.id)) return
      if (event.id === "circle-11") {
        styleMap.addImage(event.id, buildCircleImage(11, [120, 130, 148, 255]))
      } else if (event.id === "wood-pattern") {
        styleMap.addImage(event.id, buildSolidImage(8, 8, [72, 86, 104, 255]))
      }
    }

    styleMap.on("styleimagemissing", handleStyleImageMissing)
    return () => {
      styleMap.off("styleimagemissing", handleStyleImageMissing)
    }
  }, [])

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
        <Map ref={mapRef} mapStyle="https://tiles.openfreemap.org/styles/liberty" />
      </DeckGL>

      <div className="pointer-events-none fixed inset-x-0 top-20 z-20 flex justify-center px-4">
        <GlassCard className="pointer-events-auto w-full max-w-5xl rounded-[1.8rem] px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[160px] flex-1">
              <div className="text-data text-[var(--acea-cyan)]">Map filters</div>
              <div className="mt-1 text-sm text-[var(--text-md)]">Sharper controls with labels people can actually read.</div>
            </div>
            <div className="grid flex-[2] gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect label="Service area" value={dmaFilter} onChange={setDmaFilter}>
              <option value="all">All service areas</option>
              {dmas.map((dma) => (
                <option key={dma.id} value={dma.id}>
                  {dma.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Severity" value={severityFilter} onChange={setSeverityFilter}>
              <option value="all">Any severity</option>
              <option value="1">≥ 1</option>
              <option value="2">≥ 2</option>
              <option value="3">≥ 3</option>
            </FilterSelect>
            <FilterSelect label="Window" value={dateRange} onChange={setDateRange}>
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
              <option value="90d">90d</option>
            </FilterSelect>
            <FilterSelect label="Metric" value={metric} onChange={(value) => setMetric(value as "phi" | "headroom")}>
              <option value="phi">PHI</option>
              <option value="headroom">Headroom</option>
            </FilterSelect>
            </div>
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
              "Waiting for the next event."
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
            className="fixed inset-y-0 right-0 z-30 min-w-0 border-l border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.92)] pt-20 backdrop-blur-[24px]"
          >
            <button
              type="button"
              onMouseDown={() => setIsResizing(true)}
              className="absolute left-0 top-1/2 h-20 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(75,214,255,0.26)]"
            />
            <div className="app-scroll h-full overflow-y-auto px-5 pb-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-h2 text-[var(--text-hi)]">
                  {activeSegmentDetail ? "Segment detail" : activeTankDetail ? "Tank detail" : "Service area detail"}
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
                  <div className="mt-1 text-sm text-[var(--text-md)]">Population served {selectedDma.population.toLocaleString()}</div>
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
          <DataBadge label="material" value={detail.segment.properties.material} tone="neutral" />
          <DataBadge label="diameter" value={`${detail.segment.properties.diameter_mm} mm`} tone="neutral" />
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
        <div className="mb-3 text-sm font-medium text-[var(--text-hi)]">90d series</div>
        <div className="h-56 min-w-0">
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
        Open on map
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
        <div className="h-56 min-w-0">
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
        <div className="mb-3 text-sm font-medium text-[var(--text-hi)]">Local network</div>
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
              <span className="text-sm text-[var(--phi-yellow)]">Go to {tank.properties.name}</span>
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

function FilterSelect({
  label,
  value,
  onChange,
  children
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="relative grid gap-1.5 rounded-[1.2rem] border border-[var(--glass-stroke)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(239,247,255,0.86))] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <span className="text-data text-[var(--text-lo)]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none bg-transparent pr-8 text-sm font-medium text-[var(--text-hi)] outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-[2rem] h-4 w-4 text-[var(--acea-cyan)]" />
    </label>
  )
}
