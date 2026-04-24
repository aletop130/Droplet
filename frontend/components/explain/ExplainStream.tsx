"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Loader2, RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { API_BASE } from "@/lib/api"

type StreamEvent = {
  type: "status" | "token" | "done"
  message?: string
  text?: string
  audit_log_id?: number
}

type ExplainStreamProps = {
  entityType: "segment" | "tank" | "dma" | "incident"
  entityId: number
  open: boolean
  onClose: () => void
}

export function ExplainStream({
  entityType,
  entityId,
  open,
  onClose
}: ExplainStreamProps) {
  const [status, setStatus] = useState<string>("")
  const [text, setText] = useState<string>("")
  const [auditLogId, setAuditLogId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !entityId) return

    setStatus("")
    setText("")
    setAuditLogId(null)
    setError(null)
    setLoading(true)

    const eventSource = new EventSource(
      `${API_BASE}/api/explain/${entityType}/${entityId}`
    )

    eventSource.onmessage = (event) => {
      try {
        const data: StreamEvent = JSON.parse(event.data)
        if (data.type === "status") {
          setStatus(data.message ?? "")
        } else if (data.type === "token") {
          setText((prev) => prev + (data.text ?? ""))
        } else if (data.type === "done") {
          setAuditLogId(data.audit_log_id ?? null)
          setLoading(false)
          eventSource.close()
        }
      } catch {
        setError("Failed to parse server response")
        setLoading(false)
      }
    }

    eventSource.onerror = () => {
      setError("Connection lost")
      setLoading(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [open, entityType, entityId])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [text])

  if (!open) return null

  return (
    <aside className="fixed bottom-0 right-0 top-0 z-40 w-full max-w-[520px] transform border-l border-[var(--glass-stroke)] bg-[rgba(5,11,20,0.95)] backdrop-blur-[var(--blur-glass)] transition duration-300">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-[var(--glass-stroke)] px-4">
          <div className="flex items-center gap-2">
            <Loader2 className={`h-4 w-4 text-[var(--acea-cyan)] ${loading ? "animate-spin" : ""}`} />
            <span className="font-[var(--font-unbounded)] text-sm">Explain: {entityType} #{entityId}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close explainer">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto p-4 font-[var(--font-jetbrains)] text-sm leading-6 text-[var(--text-md)]"
        >
          {status && (
            <div className="mb-2 text-xs text-[var(--acea-cyan)]">{status}</div>
          )}
          {error && (
            <div className="mb-2 text-xs text-[var(--phi-red)]">{error}</div>
          )}
          {text.split("\n\n").map((paragraph, index) => (
            <p key={index} className="mb-4">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--glass-stroke)] px-4 py-3">
          <div className="text-xs text-[var(--text-lo)]">
            {auditLogId ? (
              <span>Audit: #{auditLogId}</span>
            ) : loading ? (
              <span>Collecting context...</span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus("")
              setText("")
              setAuditLogId(null)
              setError(null)
            }}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>
    </aside>
  )
}