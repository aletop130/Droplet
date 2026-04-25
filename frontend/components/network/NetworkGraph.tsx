"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { PointerEvent, WheelEvent } from "react"
import { Activity, Droplets, MapPinned, RotateCcw, Search, ZoomIn, ZoomOut } from "lucide-react"

import { getNetworkAreas, getNetworkGraph } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { NetworkArea, NetworkGraph as NetworkGraphData, PipeNode, TankNode } from "@/types/domain"
import { NodeDrawer } from "@/components/network/NodeDrawer"

type SelectedNetworkNode =
  | { kind: "tank"; item: TankNode }
  | { kind: "pipe"; item: PipeNode }
  | null

type ViewState = {
  scale: number
  x: number
  y: number
}

const CANVAS_WIDTH = 1180
const CANVAS_HEIGHT = 720

const phiColor = ["#10b981", "#fbbf24", "#fb923c", "#f43f5e"] as const

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function formatUpdated(value?: string) {
  if (!value) return "live"
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  })
}

function tankRadius(tank: TankNode) {
  return clamp(10 + Math.sqrt(Math.max(tank.capacity_m3, 1)) / 9, 15, 30)
}

function pipeWidth(pipe: PipeNode) {
  return clamp(2 + pipe.fillPercent / 11, 3, 12)
}

function buildProjection(graph: NetworkGraphData | null) {
  const points: [number, number][] = []
  graph?.tanks.forEach((tank) => points.push([tank.lon ?? tank.x, tank.lat ?? tank.y]))
  graph?.pipes.forEach((pipe) => {
    if (pipe.path?.length) {
      pipe.path.forEach((point) => points.push(point))
    } else {
      points.push([pipe.x, pipe.y])
    }
  })

  if (!points.length) {
    return {
      tanks: [] as Array<TankNode & { sx: number; sy: number }>,
      pipes: [] as Array<PipeNode & { sx: number; sy: number; screenPath: [number, number][] }>
    }
  }

  const xs = points.map((point) => point[0])
  const ys = points.map((point) => point[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const padding = 56
  const spanX = Math.max(maxX - minX, 0.001)
  const spanY = Math.max(maxY - minY, 0.001)
  const scale = Math.min((CANVAS_WIDTH - padding * 2) / spanX, (CANVAS_HEIGHT - padding * 2) / spanY)

  const project = ([x, y]: [number, number]): [number, number] => [
    padding + (x - minX) * scale + ((CANVAS_WIDTH - padding * 2) - spanX * scale) / 2,
    CANVAS_HEIGHT - padding - (y - minY) * scale - ((CANVAS_HEIGHT - padding * 2) - spanY * scale) / 2
  ]

  return {
    tanks: (graph?.tanks ?? []).map((tank) => {
      const [sx, sy] = project([tank.lon ?? tank.x, tank.lat ?? tank.y])
      return { ...tank, sx, sy }
    }),
    pipes: (graph?.pipes ?? []).map((pipe) => {
      const screenPath = (pipe.path?.length ? pipe.path : [[pipe.x, pipe.y] as [number, number]]).map((point) => project(point))
      const [sx, sy] = project([pipe.x, pipe.y])
      return { ...pipe, sx, sy, screenPath }
    })
  }
}

type NetworkGraphProps = {
  embedded?: boolean
}

export function NetworkGraph({ embedded = false }: NetworkGraphProps) {
  const [graph, setGraph] = useState<NetworkGraphData | null>(null)
  const [areas, setAreas] = useState<NetworkArea[]>([])
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SelectedNetworkNode>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [view, setView] = useState<ViewState>({ scale: 1, x: 0, y: 0 })
  const dragRef = useRef<{ pointerId: number; x: number; y: number; view: ViewState } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let mounted = true
    getNetworkAreas()
      .then((items) => {
        if (!mounted) return
        setAreas(items)
        setSelectedAreaId(items[0]?.id ?? null)
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Unable to load network areas")
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (selectedAreaId == null) return
    let mounted = true
    setLoading(true)
    setSelected(null)
    setGraph(null)
    getNetworkGraph(selectedAreaId)
      .then((payload) => {
        if (!mounted) return
        setGraph(payload)
        setSelected(payload.tanks[0] ? { kind: "tank", item: payload.tanks[0] } : null)
        resetView()
      })
      .catch((err: unknown) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Unable to load network graph")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [selectedAreaId])

  const projected = useMemo(() => buildProjection(graph), [graph])
  const tankIds = useMemo(() => new Set(projected.tanks.map((tank) => tank.id)), [projected.tanks])
  const filteredTanks = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return projected.tanks
    return projected.tanks.filter((tank) => tank.name.toLowerCase().includes(needle) || String(tank.id).includes(needle) || tank.dma_name?.toLowerCase().includes(needle))
  }, [projected.tanks, query])
  const highlightedPipes = useMemo(() => {
    if (!selected) return new Set<number>()
    if (selected.kind === "pipe") return new Set([selected.item.id])
    return new Set(selected.item.connectedPipes)
  }, [selected])
  const filteredTankIds = useMemo(() => new Set(filteredTanks.map((tank) => tank.id)), [filteredTanks])

  const stats = useMemo(() => {
    const pipes = graph?.pipes ?? []
    const tanks = graph?.tanks ?? []
    return {
      tanks: tanks.length,
      pipes: pipes.length,
      avgFill: tanks.length ? Math.round(tanks.reduce((sum, tank) => sum + tank.fillLevel, 0) / tanks.length) : 0,
      phiCritical: pipes.filter((pipe) => pipe.phi >= 2).length
    }
  }, [graph])

  function resetView() {
    setView({ scale: 1, x: 0, y: 0 })
  }

  function zoomAt(delta: number, anchor: { x: number; y: number }) {
    setView((current) => {
      const nextScale = clamp(current.scale * delta, 0.55, 4)
      const contentX = (anchor.x - current.x) / current.scale
      const contentY = (anchor.y - current.y) / current.scale

      return {
        scale: nextScale,
        x: anchor.x - contentX * nextScale,
        y: anchor.y - contentY * nextScale
      }
    })
  }

  function zoomBy(delta: number) {
    zoomAt(delta, { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 })
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const anchor = {
      x: ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT
    }
    zoomAt(event.deltaY > 0 ? 0.9 : 1.1, anchor)
  }

  function beginPan(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest("[data-network-node='true']")) return
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePan(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    setView({
      scale: drag.view.scale,
      x: drag.view.x + event.clientX - drag.x,
      y: drag.view.y + event.clientY - drag.y
    })
  }

  function endPan(event: PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null
    }
  }

  if (error) {
    return (
      <div className={cn("mx-auto max-w-[1450px] rounded-[1.6rem] border border-[rgba(244,63,94,0.24)] bg-[rgba(244,63,94,0.06)] p-5 text-sm text-[var(--text-hi)]", embedded && "mt-1")}>
        {error}
      </div>
    )
  }

  return (
    <div className={cn("mx-auto grid max-w-[1600px] gap-5", embedded && "pb-3")}>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-data text-[var(--acea-cyan)]">Map network detail</div>
          <h1 className="text-page-title mt-2">Ciociaria hydraulic graph</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            ["tanks", stats.tanks],
            ["pipes", stats.pipes],
            ["avg fill", `${stats.avgFill}%`],
            ["PHI >= 2", stats.phiCritical]
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
              <div className="text-data text-[var(--text-lo)]">{label}</div>
              <div className="mt-1 text-lg text-[var(--text-hi)]">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 rounded-[1.6rem] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.78)] p-3 shadow-[0_24px_70px_rgba(8,53,107,0.12)] backdrop-blur-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-[15rem] items-center gap-2 rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                <MapPinned className="h-4 w-4 text-[var(--acea-cyan)]" />
                <select
                  value={selectedAreaId ?? ""}
                  onChange={(event) => setSelectedAreaId(Number(event.target.value))}
                  className="w-full bg-transparent text-sm text-[var(--text-hi)] outline-none"
                >
                  {areas.map((area) => (
                    <option key={area.id} value={area.id} className="bg-white text-[#102033]">
                      {area.name} - {area.pipe_count} pipes - {area.tank_count} tanks
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex min-w-[15rem] items-center gap-2 rounded-2xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                <Search className="h-4 w-4 text-[var(--text-lo)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Tank, DMA, ID"
                  className="w-full bg-transparent text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => zoomBy(1.16)} className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[var(--text-md)]">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => zoomBy(0.86)} className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[var(--text-md)]">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" onClick={resetView} className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] text-[var(--text-md)]">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative aspect-[16/10] min-h-[33rem] overflow-hidden rounded-[1.2rem] border border-[var(--glass-stroke)] bg-[radial-gradient(circle_at_28%_16%,rgba(75,214,255,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.92),rgba(239,247,255,0.96))]">
            {loading || !graph ? (
              <div className="absolute inset-0 grid place-items-center">
                <div className="flex items-center gap-3 text-sm text-[var(--text-md)]">
                  <Activity className="h-5 w-5 animate-pulse text-[var(--acea-cyan)]" />
                  Loading {areas.find((area) => area.id === selectedAreaId)?.name ?? "network area"}
                </div>
              </div>
            ) : null}
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
              className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
              onWheel={handleWheel}
              onPointerDown={beginPan}
              onPointerMove={movePan}
              onPointerUp={endPan}
              onPointerCancel={endPan}
            >
              <defs>
                <pattern id="network-grid" width="42" height="42" patternUnits="userSpaceOnUse">
                  <path d="M 42 0 L 0 0 0 42" fill="none" stroke="rgba(8,53,107,0.08)" strokeWidth="1" />
                </pattern>
                <linearGradient id="tank-water" x1="0" x2="1">
                  <stop offset="0%" stopColor="#2f90ff" />
                  <stop offset="100%" stopColor="#44d7c0" />
                </linearGradient>
              </defs>
              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#network-grid)" opacity="0.75" />
              <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="transparent" />
              <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
                {projected.pipes.map((pipe) => {
                  const points = pipe.screenPath.map(([x, y]) => `${x},${y}`).join(" ")
                  const active = highlightedPipes.has(pipe.id) || hovered === `pipe:${pipe.id}`
                  const connectedToVisibleTank = !query || (pipe.fromTank != null && filteredTankIds.has(pipe.fromTank)) || (pipe.toTank != null && filteredTankIds.has(pipe.toTank))
                  return (
                    <g key={pipe.id} className={cn(!connectedToVisibleTank && "opacity-25")}>
                      <polyline
                        points={points}
                        fill="none"
                        stroke={phiColor[pipe.phi] ?? phiColor[0]}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={pipeWidth(pipe) + (active ? 4 : 0)}
                        opacity={active ? 0.95 : 0.54}
                      />
                      <polyline
                        points={points}
                        fill="none"
                        stroke="transparent"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={20}
                        className="cursor-pointer"
                        data-network-node="true"
                        onPointerEnter={() => setHovered(`pipe:${pipe.id}`)}
                        onPointerLeave={() => setHovered(null)}
                        onClick={() => setSelected({ kind: "pipe", item: pipe })}
                      />
                    </g>
                  )
                })}

                {projected.tanks.map((tank) => {
                  const radius = tankRadius(tank)
                  const active = selected?.kind === "tank" && selected.item.id === tank.id
                  const visible = !query || filteredTankIds.has(tank.id)
                  const fillHeight = (radius * 2 * tank.fillLevel) / 100
                  return (
                    <g
                      key={tank.id}
                      transform={`translate(${tank.sx} ${tank.sy})`}
                      opacity={visible ? 1 : 0.16}
                      className="cursor-pointer"
                      data-network-node="true"
                      onPointerEnter={() => setHovered(`tank:${tank.id}`)}
                      onPointerLeave={() => setHovered(null)}
                      onClick={() => setSelected({ kind: "tank", item: tank })}
                    >
                      <circle r={radius + 8} fill="rgba(75,214,255,0.08)" opacity={active || hovered === `tank:${tank.id}` ? 1 : 0} />
                      <clipPath id={`tank-clip-${tank.id}`}>
                        <circle r={radius} />
                      </clipPath>
                      <circle r={radius} fill="rgba(255,255,255,0.9)" stroke={phiColor[tank.phi] ?? phiColor[0]} strokeWidth={active ? 4 : 2.5} />
                      <rect
                        x={-radius}
                        y={radius - fillHeight}
                        width={radius * 2}
                        height={fillHeight}
                        fill="url(#tank-water)"
                        clipPath={`url(#tank-clip-${tank.id})`}
                        opacity="0.86"
                      />
                      <Droplets x={-7} y={-7} className="pointer-events-none h-3.5 w-3.5 text-[var(--text-hi)]" />
                      {active || hovered === `tank:${tank.id}` ? (
                        <g transform={`translate(${radius + 10} -18)`}>
                          <rect width="132" height="36" rx="10" fill="rgba(255,255,255,0.94)" stroke="rgba(8,53,107,0.16)" />
                          <text x="10" y="15" fill="#102033" fontSize="12" fontWeight="600">{tank.name}</text>
                          <text x="10" y="29" fill="#4b6078" fontSize="11">{Math.round(tank.fillLevel)}% full</text>
                        </g>
                      ) : null}
                    </g>
                  )
                })}
              </g>
            </svg>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.86)] px-3 py-2 text-data text-[var(--text-lo)]">
              Updated {formatUpdated(graph?.generated_at)}
            </div>
          </div>
        </div>

        <NodeDrawer selected={selected} onClose={() => setSelected(null)} />
      </section>
    </div>
  )
}
