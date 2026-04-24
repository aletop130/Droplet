"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, BarChart3, Droplets, Info, PieChart } from "lucide-react"

import { GlassCard } from "@/components/ui/GlassCard"
import { API_BASE } from "@/lib/api"
import { ExplainStream } from "@/components/explain/ExplainStream"

type DMABalance = {
  dma_id: number
  month: string
  system_input_m3: number
  authorised_m3: number
  apparent_losses_m3: number
  real_losses_m3: number
  nrw_pct: number
  pdf_status: string
}

export default function DMADetailPage() {
  const params = useParams()
  const dmaId = Number(params.id)
  const [data, setData] = useState<DMABalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [explainOpen, setExplainOpen] = useState(false)

  useEffect(() => {
    if (!dmaId) return
    setLoading(true)
    fetch(`${API_BASE}/api/dmas/${dmaId}/balance`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    })
      .then((res) => {
        if (!res.ok) throw new Error(`DMA ${dmaId} not found`)
        return res.json()
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [dmaId])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-[var(--text-lo)]">Loading DMA #{dmaId}...</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="text-sm text-[var(--phi-red)]">{error || "DMA not found"}</span>
      </div>
    )
  }

  const nrwColor = data.nrw_pct > 50 ? "var(--phi-red)" : data.nrw_pct > 30 ? "var(--phi-yellow)" : "var(--phi-green)"
  const inputVol = data.system_input_m3
  const authorizedVol = data.authorised_m3
  const apparentVol = data.apparent_losses_m3
  const realVol = data.real_losses_m3

  return (
    <div className="mx-auto grid max-w-5xl gap-4">
      <div className="flex items-center gap-4">
        <a
          href="/app/map"
          className="flex h-8 w-8 items-center justify-center rounded border border-[var(--glass-stroke)] text-[var(--text-lo)] hover:border-[var(--acea-cyan)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            DMA Detail
          </p>
          <h1 className="font-[var(--font-unbounded)] text-2xl font-semibold">
            DMA #{dmaId} <span style={{ color: nrwColor }}>{data.nrw_pct}% NRW</span>
          </h1>
        </div>
        <button
          onClick={() => setExplainOpen(true)}
          className="ml-auto rounded border border-[var(--glass-stroke)] px-3 py-1.5 text-xs text-[var(--acea-cyan)] hover:border-[var(--acea-cyan)]"
        >
          <Info className="mr-1 inline h-3 w-3" />
          AI Explain
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
            <Droplets className="h-4 w-4 text-[var(--acea-cyan)]" />
            IWA Water Balance ({data.month})
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-lo)]">System Input</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--acea-cyan)]">
                {inputVol.toLocaleString()} m³
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-lo)]">Authorised</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--text-md)]">
                {authorizedVol.toLocaleString()} m³
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-lo)]">Apparent Losses</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--phi-orange)]">
                {apparentVol.toLocaleString()} m³
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-lo)]">Real Losses (ILM)</span>
              <span className="font-[var(--font-jetbrains)] text-[var(--phi-red)]">
                {realVol.toLocaleString()} m³
              </span>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
            <PieChart className="h-4 w-4 text-[var(--acea-cyan)]" />
            NRW Breakdown
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--text-lo)]">NRW %</span>
              <span className="font-[var(--font-unbounded)] text-xl" style={{ color: nrwColor }}>
                {data.nrw_pct}%
              </span>
            </div>
            <div>
              <div className="mb-1 text-xs text-[var(--text-lo)]">IWA Performance</div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-2)]">
                <div
                  className="h-full bg-gradient-to-r from-[var(--phi-green)] to-[var(--phi-red)]"
                  style={{ width: `${data.nrw_pct}%` }}
                />
              </div>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-4">
        <h2 className="mb-3 flex items-center gap-2 font-[var(--font-unbounded)] text-sm">
          <BarChart3 className="h-4 w-4 text-[var(--acea-cyan)]" />
          NRW Historical ({data.month})
        </h2>
        <div className="flex h-32 items-center justify-center border border-dashed border-[var(--glass-stroke)] text-sm text-[var(--text-lo)]">
          Historical trend placeholder
        </div>
      </GlassCard>

      <ExplainStream
        entityType="dma"
        entityId={dmaId}
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
      />
    </div>
  )
}