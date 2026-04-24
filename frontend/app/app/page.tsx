"use client"

import { useEffect, useState } from "react"
import { Activity, AlertTriangle, Database, Gauge, Shield, Waves } from "lucide-react"

import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { PhiPill } from "@/components/ui/PhiPill"
import { API_BASE, getSegments, getTanks } from "@/lib/api"

type DailyDigest = {
  day: string
  trend_summary: string
  top_incidents: Array<{ incident_id: number; severity: number }>
  intervention_recs: Array<{ id: number; text: string }>
}

type KPIs = {
  networkHealth: string
  activeIncidents: number
  avgHeadroom: string
  riskTanks: number
}

export default function MissionControlPage() {
  const [digest, setDigest] = useState<DailyDigest | null>(null)
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/daily-digest/today`).then((r) => r.json()),
      getSegments(),
      getTanks(),
      fetch(`${API_BASE}/api/incidents?status=open`).then((r) => r.json())
    ])
      .then(([digest, segs, tanks, incidents]) => {
        setDigest(digest)

        const features = segs.features
        const goodSegs = features.filter((f: any) => f.properties.phi <= 1).length
        const networkHealth = features.length > 0
          ? `${Math.round((goodSegs / features.length) * 100)}%`
          : "—"

        const tankFeats = tanks.features
        const avgHeadroom = tankFeats.length > 0
          ? `${Math.round(tankFeats.reduce((s: number, f: any) => s + (f.properties.headroom_pct ?? 0), 0) / tankFeats.length)}%`
          : "—"
        const riskTanks = tankFeats.filter((f: any) => f.properties.severity >= 2).length

        setKpis({
          networkHealth,
          activeIncidents: incidents.total ?? incidents.items?.length ?? 0,
          avgHeadroom,
          riskTanks,
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const cards = kpis
    ? [
        {
          title: "Network Health",
          icon: Gauge,
          value: kpis.networkHealth,
          caption: "segments in PHI 0–1",
          badge: <PhiPill value={1} />
        },
        {
          title: "Active Incidents",
          icon: AlertTriangle,
          value: String(kpis.activeIncidents),
          caption: "open operational events",
          badge: <DataBadge label="open" value={String(kpis.activeIncidents)} tone="red" />
        },
        {
          title: "Tank Fleet",
          icon: Database,
          value: kpis.avgHeadroom,
          caption: "average headroom",
          badge: <DataBadge label="risk" value={`${kpis.riskTanks} tanks`} tone="yellow" />
        },
        {
          title: "Water Availability",
          icon: Waves,
          value: "—",
          caption: "GRACE-FO (nightly)",
          badge: <DataBadge label="30d" value="watch" tone="teal" />
        }
      ]
    : null

  return (
    <div className="mx-auto grid max-w-7xl gap-5">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-[var(--font-jetbrains)] text-xs uppercase tracking-[0.18em] text-[var(--acea-cyan)]">
            Mission Control
          </p>
          <h1 className="mt-2 font-[var(--font-unbounded)] text-3xl font-semibold tracking-normal text-[var(--text-hi)]">
            Ciociaria live operations
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DataBadge label="backend" value="HF Space" />
          <DataBadge label="pilot" value="Frosinone" tone="teal" />
          <DataBadge label="mode" value="digital twin" tone="yellow" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {loading || !cards
          ? Array.from({ length: 4 }).map((_, i) => (
              <GlassCard key={i} className="animate-pulse p-4">
                <div className="h-10 w-10 rounded-md bg-white/[0.06]" />
                <div className="mt-6 h-9 w-24 rounded bg-white/[0.06]" />
                <div className="mt-2 h-4 w-32 rounded bg-white/[0.04]" />
              </GlassCard>
            ))
          : cards.map((card) => {
              const Icon = card.icon
              return (
                <GlassCard key={card.title} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-md border border-[var(--glass-stroke)] bg-white/[0.04]">
                      <Icon className="h-5 w-5 text-[var(--acea-cyan)]" />
                    </div>
                    {card.badge}
                  </div>
                  <div className="mt-6 font-[var(--font-unbounded)] text-3xl font-semibold tracking-normal">{card.value}</div>
                  <div className="mt-1 text-sm text-[var(--text-md)]">{card.title}</div>
                  <div className="mt-4 text-xs text-[var(--text-lo)]">{card.caption}</div>
                </GlassCard>
              )
            })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <GlassCard className="p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-[var(--font-unbounded)] text-lg tracking-normal">Daily Digest</h2>
              <p className="mt-1 text-sm text-[var(--text-md)]">Generated by the audited Regolo agent run.</p>
            </div>
            <DataBadge label={digest?.day ?? "today"} value={loading ? "loading" : "ready"} />
          </div>
          <div className="grid gap-3">
            {digest ? (
              <>
                <div className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-[var(--text-md)]">
                  <Activity className="mt-0.5 h-4 w-4 shrink-0 text-[var(--acea-teal)]" />
                  <span>{digest.trend_summary}</span>
                </div>
                {digest.top_incidents.map((inc) => (
                  <div key={inc.incident_id} className="flex items-start gap-3 rounded-md border border-[var(--phi-red)]/30 bg-[var(--phi-red)]/5 p-3 text-sm text-[var(--text-md)]">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--phi-red)]" />
                    <span>Incident #{inc.incident_id} · severity {inc.severity}</span>
                  </div>
                ))}
                <div className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-[var(--text-md)]">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--phi-green)]" />
                  <span>No control parameter is applied without operator approval.</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-[var(--text-lo)]">
                Loading digest...
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <h2 className="font-[var(--font-unbounded)] text-lg tracking-normal">AI Act Gate</h2>
          <div className="mt-4 grid gap-3 text-sm text-[var(--text-md)]">
            {[
              ["LLM calls", "audit row required"],
              ["Control recs", "operator approval"],
              ["Infrastructure", "digital twin only"],
              ["Brick router", "chat/search only"]
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-white/10 pb-2 last:border-b-0">
                <span>{label}</span>
                <span className="font-[var(--font-jetbrains)] text-xs text-[var(--acea-ice)]">{value}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </section>
    </div>
  )
}
