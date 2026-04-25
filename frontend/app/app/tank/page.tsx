"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { getTanks } from "@/lib/api"
import type { TankFeature } from "@/types/domain"

export default function TanksIndexPage() {
  const [tanks, setTanks] = useState<TankFeature[]>([])

  useEffect(() => {
    getTanks().then((payload) => setTanks(payload.features))
  }, [])

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section>
        <div className="text-data text-[var(--acea-cyan)]">Serbatoi</div>
        <h1 className="text-h1 mt-2">Fleet overview with direct navigation into tank states.</h1>
      </section>

      <div className="grid gap-2">
        {tanks.map((tank) => (
          <Link key={tank.properties.id} href={`/app/tank/${tank.properties.id}`} className="rounded-[1.6rem] border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-[var(--text-hi)]">{tank.properties.name}</div>
                <div className="mt-1 text-sm text-[var(--text-md)]">{tank.properties.dma_name}</div>
              </div>
              <div className="flex gap-2">
                <DataBadge label="headroom" value={`${tank.properties.headroom_pct}%`} />
                <DataBadge label="resilience" value={`${Math.round(tank.properties.resilience_hours ?? 0)}h`} tone="yellow" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
