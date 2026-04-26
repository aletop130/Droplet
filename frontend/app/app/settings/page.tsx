"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { getAudit } from "@/lib/api"
import { clearSession, readSession } from "@/lib/mockAuth"
import type { AuditEntry } from "@/types/domain"

export default function SettingsPage() {
  const router = useRouter()
  const session = readSession()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [purpose, setPurpose] = useState("")
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    getAudit().then((payload) => setEntries(payload.items))
  }, [])

  const filtered = useMemo(
    () => entries.filter((entry) => (purpose ? entry.purpose === purpose : true)),
    [entries, purpose]
  )

  return (
    <div className="mx-auto grid max-w-[1450px] gap-5">
      <section>
        <div className="text-data text-[var(--acea-cyan)]">Settings</div>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--text-hi)]">Settings</h1>
      </section>

      <GlassCard className="rounded-[1.8rem] p-5">
        <div className="grid gap-3">
          <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-data text-[var(--text-lo)]">PHI thresholds</div>
            <div className="mt-1 text-sm text-[var(--text-md)]">Read-only v1 from backend configuration.</div>
          </div>
          <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-data text-[var(--text-lo)]">Mass-balance residual threshold</div>
            <div className="mt-1 text-sm text-[var(--text-md)]">Watch {" > "} 12% · Alert {" > "} 25%</div>
          </div>
          <div className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="text-data text-[var(--text-lo)]">Session info</div>
            <div className="mt-1 text-sm text-[var(--text-md)]">{session?.user ?? "operator"} · expires {session ? new Date(session.exp).toLocaleString("en-GB") : "n/a"}</div>
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={() => {
              clearSession()
              router.replace("/login")
            }}
          >
            Sign out
          </Button>
        </div>
      </GlassCard>

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-data text-[var(--acea-cyan)]">Audit</div>
            <h2 className="text-h2 mt-2 text-[var(--text-hi)]">AI traces and operator action slots.</h2>
          </div>
        </div>

        <div className="flex gap-2">
          {["", "chat", "explain"].map((item) => (
            <button
              key={item || "all"}
              type="button"
              onClick={() => setPurpose(item)}
              className={`rounded-full border px-3 py-1 text-data ${purpose === item ? "border-[rgba(75,214,255,0.24)] text-[var(--acea-cyan)]" : "border-[rgba(173,218,255,0.12)] text-[var(--text-lo)]"}`}
            >
              {item || "all"}
            </button>
          ))}
        </div>

        <div className="grid gap-2">
          {filtered.map((entry) => (
            <GlassCard key={entry.id} className="rounded-[1.6rem] p-4">
              <button type="button" onClick={() => setExpanded((current) => (current === entry.id ? null : entry.id))} className="w-full text-left">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-[var(--text-hi)]">#{entry.id} · {entry.model}</div>
                    <div className="mt-1 text-sm text-[var(--text-md)]">{entry.response_text.slice(0, 180)}...</div>
                  </div>
                  <div className="text-data text-[var(--text-lo)]">{entry.purpose}</div>
                </div>
              </button>
              {expanded === entry.id ? (
                <div className="mt-4 grid gap-3">
                  <div className="whitespace-pre-wrap rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3 text-sm text-[var(--text-md)]">
                    {entry.response_text}
                  </div>
                  <div className="whitespace-pre-wrap rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-3 text-data text-[var(--text-lo)]">
                    {JSON.stringify(entry.tool_calls ?? {}, null, 2)}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm">Accept</Button>
                    <Button variant="ghost" size="sm">Reject</Button>
                    <Button variant="ghost" size="sm">Override + note</Button>
                  </div>
                </div>
              ) : null}
            </GlassCard>
          ))}
        </div>
      </section>
    </div>
  )
}
