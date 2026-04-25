"use client"

import { Check, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { approveControlRec, rejectControlRec } from "@/lib/api"
import type { ControlRecommendation } from "@/types/domain"

type ControlRecCardProps = {
  recommendations: ControlRecommendation[]
  onUpdate: () => void
}

export function ControlRecCard({ recommendations, onUpdate }: ControlRecCardProps) {
  if (recommendations.length === 0) return null

  return (
    <GlassCard className="rounded-[1.8rem] p-5">
      <div className="mb-4 text-sm text-[var(--text-hi)]">Control recommendations</div>
      <div className="grid gap-3">
        {recommendations.map((rec) => (
          <div key={rec.id} className="rounded-[1.4rem] border border-[rgba(173,218,255,0.1)] bg-[rgba(255,255,255,0.03)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-[var(--text-hi)]">{rec.parameter}</div>
              <div className="text-data text-[var(--text-lo)]">{rec.status}</div>
            </div>
            <div className="mt-2 text-sm text-[var(--text-md)]">{rec.rationale}</div>
            <div className="mt-2 text-data text-[var(--text-lo)]">
              proposed {rec.proposed_value ?? "n/a"} · confidence {Math.round(rec.confidence * 100)}%
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => approveControlRec(rec.id).then(onUpdate)}>
                <Check className="h-3 w-3" />
                Approva
              </Button>
              <Button variant="ghost" size="sm" onClick={() => rejectControlRec(rec.id).then(onUpdate)}>
                <X className="h-3 w-3" />
                Rifiuta
              </Button>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
