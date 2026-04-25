"use client"

import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { clearSession, readSession } from "@/lib/mockAuth"

export default function SettingsPage() {
  const router = useRouter()
  const session = readSession()

  return (
    <div className="mx-auto grid max-w-4xl gap-5">
      <section>
        <div className="text-data text-[var(--acea-cyan)]">Impostazioni</div>
        <h1 className="text-h1 mt-2">Thresholds, session envelope and read-only v1 controls.</h1>
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
            <div className="mt-1 text-sm text-[var(--text-md)]">{session?.user ?? "operator"} · scadenza {session ? new Date(session.exp).toLocaleString("it-IT") : "n/a"}</div>
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={() => {
              clearSession()
              router.replace("/login")
            }}
          >
            Esci
          </Button>
        </div>
      </GlassCard>
    </div>
  )
}
