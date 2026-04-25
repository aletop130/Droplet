"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { getExplainStream } from "@/lib/api"

type ExplainStreamProps = {
  entityType: "segment" | "tank"
  entityId: number
  open: boolean
  onClose: () => void
}

export function ExplainStream({ entityType, entityId, open, onClose }: ExplainStreamProps) {
  const [text, setText] = useState("")
  const [auditLogId, setAuditLogId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    setText("")
    setAuditLogId(null)
    setError(null)
    setLoading(true)

    ;(async () => {
      try {
        const stream = await getExplainStream(entityType, entityId)
        let buffer = ""
        for await (const chunk of stream) {
          if (cancelled) return
          if (chunk.token) {
            buffer += chunk.token
            setText(buffer)
          }
          if (chunk.done) {
            setAuditLogId(chunk.audit_log_id ?? null)
          }
        }
      } catch {
        if (!cancelled) setError("Connessione explain non disponibile.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [entityId, entityType, open])

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" })
  }, [text])

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ x: 560 }}
          animate={{ x: 0 }}
          exit={{ x: 560 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed inset-y-0 right-0 z-[60] w-full max-w-[520px] border-l border-[rgba(173,218,255,0.12)] bg-[rgba(4,10,20,0.94)] backdrop-blur-[24px]"
        >
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-[rgba(173,218,255,0.1)] px-4">
              <div>
                <div className="text-sm text-[var(--text-hi)]">Explain stream</div>
                <div className="text-data text-[var(--text-lo)]">{entityType} #{entityId}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div ref={containerRef} className="app-scroll flex-1 overflow-y-auto p-4 text-sm leading-7 text-[var(--text-md)] whitespace-pre-wrap">
              {loading && !text ? "Collecting context..." : text}
              {error ? <div className="mt-4 text-[var(--phi-red)]">{error}</div> : null}
            </div>
            <div className="flex items-center justify-between border-t border-[rgba(173,218,255,0.1)] p-4">
              <div className="text-data text-[var(--text-lo)]">{auditLogId ? `audit #${auditLogId}` : "streaming"}</div>
              <Button variant="ghost" size="sm" onClick={() => { setText(""); setAuditLogId(null); setError(null) }}>
                <RotateCcw className="h-3 w-3" />
                Reset
              </Button>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
