"use client"

import { useState } from "react"
import { AlertTriangle, ArrowRight, Check, Clock, ExternalLink, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { API_BASE } from "@/lib/api"

type ControlRecommendation = {
  id: number
  entity_type: string
  entity_id: number
  parameter: string
  suggested_value: number
  reason: string
  confidence: number
  status: "pending" | "approved" | "rejected"
  created_at: string
  operator_id: string | null
  operator_action: string | null
}

type ControlRecCardProps = {
  recommendations: ControlRecommendation[]
  onUpdate: () => void
}

export function ControlRecCard({ recommendations, onUpdate }: ControlRecCardProps) {
  const [loading, setLoading] = useState<number | null>(null)
  const [showDetails, setShowDetails] = useState<number | null>(null)

  async function approve(recId: number) {
    setLoading(recId)
    try {
      const response = await fetch(`${API_BASE}/api/control-recommendations/${recId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_id: "operator" })
      })
      if (response.ok) {
        onUpdate()
      }
    } finally {
      setLoading(null)
    }
  }

  async function reject(recId: number, reason: string) {
    setLoading(recId)
    try {
      const response = await fetch(`${API_BASE}/api/control-recommendations/${recId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator_id: "operator", reason })
      })
      if (response.ok) {
        onUpdate()
      }
    } finally {
      setLoading(null)
    }
  }

  const pending = recommendations.filter((r) => r.status === "pending")

  if (recommendations.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="font-[var(--font-unbounded)] text-sm text-[var(--text-hi)]">
        AI Control Recommendations
      </h3>
      {pending.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-[var(--phi-yellow)]">
          <Clock className="h-3 w-3" />
          <span>{pending.length} pending operator approval</span>
        </div>
      )}
      {recommendations.map((rec) => (
        <GlassCard key={rec.id} className="p-4">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-center gap-2">
              {rec.status === "pending" ? (
                <AlertTriangle className="h-4 w-4 text-[var(--phi-yellow)]" />
              ) : rec.status === "approved" ? (
                <Check className="h-4 w-4 text-[var(--phi-green)]" />
              ) : (
                <X className="h-4 w-4 text-[var(--phi-red)]" />
              )}
              <span className="font-[var(--font-jetbrains)] text-xs uppercase text-[var(--text-lo)]">
                {rec.entity_type} #{rec.entity_id} → {rec.parameter}
              </span>
            </div>
            <span
              className={`font-[var(--font-unbounded)] text-xs ${
                rec.status === "pending"
                  ? "text-[var(--phi-yellow)]"
                  : rec.status === "approved"
                    ? "text-[var(--phi-green)]"
                    : "text-[var(--phi-red)]"
              }`}
            >
              {rec.status.toUpperCase()}
            </span>
          </div>

          <div className="mb-3 font-[var(--font-jetbrains)] text-sm text-[var(--text-md)]">
            <span className="text-[var(--text-lo)]">Suggested → </span>
            <span className="text-[var(--acea-cyan)]">{rec.suggested_value}</span>
          </div>

          <div className="mb-3 text-sm text-[var(--text-md)]">{rec.reason}</div>

          <div className="mb-3 flex items-center gap-2 text-xs text-[var(--text-lo)]">
            <span>Confidence:</span>
            <span className="font-[var(--font-jetbrains)]">{(rec.confidence * 100).toFixed(0)}%</span>
          </div>

          {showDetails === rec.id && (
            <div className="mb-3 rounded border border-[var(--glass-stroke)] p-2 text-xs text-[var(--text-lo)]">
              <div>Created: {new Date(rec.created_at).toLocaleString()}</div>
              {rec.operator_id && (
                <div>
                  Operator: {rec.operator_id} / {rec.operator_action}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            {rec.status === "pending" ? (
              <>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetails(showDetails === rec.id ? null : rec.id)}
                  >
                    {showDetails === rec.id ? "Hide" : "Details"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => reject(rec.id, "Operator rejected")}
                    disabled={loading === rec.id}
                  >
                    <X className="mr-1 h-3 w-3" />
                    Reject
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={() => approve(rec.id)}
                  disabled={loading === rec.id}
                >
                  <Check className="mr-1 h-3 w-3" />
                  Approve
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setShowDetails(showDetails === rec.id ? null : rec.id)}>
                {showDetails === rec.id ? "Hide" : "Details"}
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  )
}