"use client"

import { useEffect, useMemo, useState } from "react"
import DeckGL from "@deck.gl/react"
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers"
import { Map } from "react-map-gl/maplibre"
import { AlertTriangle, Gauge } from "lucide-react"

import { LayerToggles, type MapLayerKey } from "@/components/map/LayerToggles"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { getSegments, getTanks } from "@/lib/api"
import { phiColor, phiLabel } from "@/lib/phi"
import type { SegmentFeature, SegmentFeatureCollection, TankFeature } from "@/types/domain"

const EMPTY_FC: SegmentFeatureCollection = { type: "FeatureCollection", features: [] }

const initialViewState = {
  longitude: 13.48,
  latitude: 41.64,
  zoom: 9.15,
  pitch: 38,
  bearing: -14
}

const defaultLayers: Record<MapLayerKey, boolean> = {
  phi: true,
  tanks: true,
  incidents: true,
  dmas: true,
  sources: false,
  subsidence: false,
  ndvi: false,
  thermal: false,
  tdoa: true
}

export function DeckMap() {
  const [segments, setSegments] = useState<SegmentFeatureCollection>(EMPTY_FC)
  const [tanks, setTanks] = useState<TankFeature[]>([])
  const [selected, setSelected] = useState<SegmentFeature | TankFeature | null>(null)
  const [backendState, setBackendState] = useState<"loading" | "live" | "warning">("loading")
  const [enabled, setEnabled] = useState<Record<MapLayerKey, boolean>>(defaultLayers)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSegments(), getTanks()])
      .then(([segGeojson, tankGeojson]) => {
        if (!cancelled) {
          if (segGeojson.features.length > 0) setSegments(segGeojson)
          if (tankGeojson.features.length > 0) setTanks(tankGeojson.features)
          setBackendState("live")
        }
      })
      .catch((error) => {
        console.warn(error)
        if (!cancelled) setBackendState("warning")
      })
    return () => { cancelled = true }
  }, [])

  const layers = useMemo(() => {
    const built = []
    if (enabled.phi) {
      built.push(
        new GeoJsonLayer<any>({
          id: "pipe-segments",
          data: segments,
          pickable: true,
          stroked: true,
          filled: false,
          lineWidthMinPixels: 3,
          getLineColor: (feature: any) => phiColor(feature.properties.phi),
          getLineWidth: (feature: any) => 2 + feature.properties.phi,
          onClick: ({ object }) => object && setSelected(object as SegmentFeature)
        })
      )
    }
    if (enabled.tanks) {
      built.push(
        new ScatterplotLayer<TankFeature>({
          id: "tank-markers",
          data: tanks,
          pickable: true,
          radiusUnits: "pixels",
          getPosition: (feature) => feature.geometry.coordinates,
          getRadius: (feature) => 10 + (100 - feature.properties.headroom_pct) / 10,
          getLineWidth: 2,
          stroked: true,
          filled: true,
          getFillColor: (feature) => {
            const color = phiColor(feature.properties.severity)
            return [color[0], color[1], color[2], 82] as [number, number, number, number]
          },
          getLineColor: (feature) => phiColor(feature.properties.severity),
          onClick: ({ object }) => object && setSelected(object as TankFeature)
        })
      )
    }
    return built
  }, [enabled, segments, tanks])

  const selectedSegment = selected && "material" in selected.properties ? (selected as SegmentFeature) : null
  const selectedTank = selected && "headroom_pct" in selected.properties ? (selected as TankFeature) : null

  return (
    <div className="relative h-[calc(100vh-7.5rem)] min-h-[620px] overflow-hidden rounded-lg border border-[var(--glass-stroke)] bg-[var(--bg-1)]">
      <DeckGL initialViewState={initialViewState} controller layers={layers}>
        <Map mapStyle="https://tiles.openfreemap.org/styles/dark" reuseMaps />
      </DeckGL>

      <GlassCard className="absolute left-4 top-4 w-[210px] p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4 text-[var(--acea-cyan)]" />
          Layers
        </div>
        <LayerToggles
          enabled={enabled}
          onToggle={(key) => setEnabled((current) => ({ ...current, [key]: !current[key] }))}
        />
      </GlassCard>

      <GlassCard className="absolute right-4 top-4 w-[340px] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.16em] text-[var(--text-lo)]">
              Selected asset
            </div>
            <h2 className="mt-1 font-[var(--font-unbounded)] text-lg tracking-normal">
              {selectedSegment
                ? `Segment ${selectedSegment.properties.id}`
                : selectedTank?.properties.name ?? "Click a feature"}
            </h2>
          </div>
          <DataBadge
            label={backendState === "live" ? `${segments.features.length}seg` : "API"}
            value={backendState === "live" ? `${tanks.length}tank` : backendState}
            tone={backendState === "warning" ? "yellow" : "cyan"}
          />
        </div>

        {selectedSegment ? (
          <div className="mt-4 grid gap-3 text-sm text-[var(--text-md)]">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span>PHI</span>
              <span className="text-[var(--acea-ice)]">{selectedSegment.properties.phi} · {phiLabel(selectedSegment.properties.phi)}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span>Material</span>
              <span>{selectedSegment.properties.material}</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span>Diameter</span>
              <span>{selectedSegment.properties.diameter_mm} mm</span>
            </div>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {["subsidence", "ndvi", "thermal", "hydraulic", "tank_signal"].map((key) => (
                <div key={key} className="rounded-md border border-white/10 bg-white/[0.03] p-2 text-center">
                  <div className="font-[var(--font-jetbrains)] text-xs text-[var(--acea-cyan)]">
                    {Math.round((selectedSegment.properties[key as keyof SegmentFeature["properties"]] as number) * 100)}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-[var(--text-lo)]">{key}</div>
                </div>
              ))}
            </div>
            <a
              href={`/app/segment/${selectedSegment.properties.id}`}
              className="mt-1 block rounded border border-[var(--glass-stroke)] py-1.5 text-center text-xs text-[var(--acea-cyan)] hover:border-[var(--acea-cyan)]"
            >
              Open detail →
            </a>
          </div>
        ) : selectedTank ? (
          <div className="mt-4 grid gap-3 text-sm text-[var(--text-md)]">
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span>Headroom</span>
              <span>{selectedTank.properties.headroom_pct}%</span>
            </div>
            <div className="flex justify-between border-b border-white/10 pb-2">
              <span>Severity</span>
              <span>{selectedTank.properties.severity}</span>
            </div>
            {selectedTank.properties.capacity_m3 != null && (
              <div className="flex justify-between border-b border-white/10 pb-2">
                <span>Capacity</span>
                <span>{selectedTank.properties.capacity_m3?.toLocaleString()} m³</span>
              </div>
            )}
            <a
              href={`/app/tank/${selectedTank.properties.id}`}
              className="mt-1 block rounded border border-[var(--glass-stroke)] py-1.5 text-center text-xs text-[var(--acea-cyan)] hover:border-[var(--acea-cyan)]"
            >
              Open detail →
            </a>
          </div>
        ) : backendState === "loading" ? (
          <div className="mt-4 text-xs text-[var(--text-lo)]">Loading network data…</div>
        ) : null}

        {backendState === "warning" && (
          <div className="mt-4 flex gap-2 rounded-md border border-[rgba(251,191,36,0.28)] bg-[rgba(251,191,36,0.08)] p-3 text-xs text-[var(--phi-yellow)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Backend unreachable — check HF Space status.
          </div>
        )}
      </GlassCard>
    </div>
  )
}
