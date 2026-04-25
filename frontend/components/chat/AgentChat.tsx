"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Bot, Check, Send, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { postChat } from "@/lib/api"
import { useChatStore } from "@/store/chatStore"
import { useSelectionStore } from "@/store/selectionStore"

const slashCommands = ["/summarise", "/explain", "/what-if", "/compare"]

type AgentChatProps = {
  open: boolean
  onClose: () => void
}

export function AgentChat({ open, onClose }: AgentChatProps) {
  const messages = useChatStore((state) => state.messages)
  const sessionId = useChatStore((state) => state.sessionId)
  const storedPageContext = useChatStore((state) => state.pageContext)
  const appendMessage = useChatStore((state) => state.appendMessage)
  const updateMessage = useChatStore((state) => state.updateMessage)
  const activeRoute = useSelectionStore((state) => state.activeRoute)
  const activeSegment = useSelectionStore((state) => state.activeSegment)
  const activeTank = useSelectionStore((state) => state.activeTank)
  const activeDMA = useSelectionStore((state) => state.activeDMA)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const deferredCommands = useMemo(
    () => (input.startsWith("/") ? slashCommands.filter((command) => command.startsWith(input.toLowerCase())) : []),
    [input]
  )

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, open])

  async function send() {
    const content = input.trim()
    if (!content || loading) return

    const operatorId = `operator-${Date.now()}`
    const assistantId = `assistant-${Date.now()}`
    const livePageContext = {
      ...storedPageContext,
      route: activeRoute,
      entity_type: activeSegment ? "segment" : activeTank ? "tank" : activeDMA ? "dma" : storedPageContext.entity_type,
      entity_id: activeSegment ?? activeTank ?? activeDMA ?? storedPageContext.entity_id ?? null
    }

    appendMessage({ id: operatorId, role: "operator", content })
    appendMessage({ id: assistantId, role: "assistant", content: "", pending: true })
    setInput("")
    setLoading(true)

    try {
      const stream = await postChat(content, livePageContext, sessionId)
      let buffer = ""

      for await (const chunk of stream) {
        if (chunk.token) {
          buffer += chunk.token
          updateMessage(assistantId, { content: buffer })
        }
        if (chunk.done) {
          updateMessage(assistantId, {
            content: buffer || "Nessuna risposta disponibile.",
            citations: chunk.citations,
            auditLogId: chunk.audit_log_id,
            suggestedActions: chunk.suggested_actions,
            pending: false
          })
        }
      }
    } catch {
      updateMessage(assistantId, {
        content: "Errore di connessione verso il backend AI.",
        pending: false
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ x: 460 }}
          animate={{ x: 0 }}
          exit={{ x: 460 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed inset-y-0 right-0 z-50 w-full max-w-[420px] border-l border-[rgba(173,218,255,0.12)] bg-[rgba(5,10,20,0.92)] backdrop-blur-[24px]"
        >
          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center justify-between border-b border-[rgba(173,218,255,0.1)] px-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-[rgba(75,214,255,0.18)] bg-[rgba(255,255,255,0.03)]">
                  <Bot className="h-4 w-4 text-[var(--acea-cyan)]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-hi)]">Regolo AI</div>
                  <div className="text-data text-[var(--text-lo)]">{sessionId}</div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="app-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message) => (
                <GlassCard
                  key={message.id}
                  className={`p-4 ${message.role === "operator" ? "ml-8 bg-[rgba(75,214,255,0.06)]" : "mr-8"}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-data text-[var(--text-lo)]">{message.role === "operator" ? "Operatore" : "Regolo"}</span>
                    {message.auditLogId ? <DataBadge label="audit" value={String(message.auditLogId)} tone="neutral" /> : null}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-[var(--text-md)]">
                    {message.pending && !message.content ? "Sto componendo la risposta..." : message.content}
                  </div>
                  {message.citations?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.citations.map((citation, index) => (
                        <button
                          key={`${citation.audit_log_id}-${index}`}
                          type="button"
                          className="rounded-full border border-[rgba(173,218,255,0.14)] px-2 py-1 text-data text-[var(--acea-cyan)]"
                        >
                          audit #{citation.audit_log_id}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {message.suggestedActions?.length ? (
                    <div className="mt-3 grid gap-2">
                      {message.suggestedActions.slice(0, 2).map((action) => (
                        <div
                          key={action.id}
                          className="rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[rgba(255,255,255,0.03)] p-3"
                        >
                          <div className="text-sm text-[var(--text-hi)]">{action.parameter}</div>
                          <div className="mt-1 text-sm text-[var(--text-md)]">{action.rationale}</div>
                          <div className="mt-3 flex gap-2">
                            <Button size="sm">
                              <Check className="h-3 w-3" />
                              Approva
                            </Button>
                            <Button variant="ghost" size="sm">
                              Rifiuta
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </GlassCard>
              ))}
              <div ref={endRef} />
            </div>

            <div className="border-t border-[rgba(173,218,255,0.1)] p-4">
              {deferredCommands.length ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {deferredCommands.map((command) => (
                    <button
                      key={command}
                      type="button"
                      onClick={() => setInput(`${command} `)}
                      className="rounded-full border border-[rgba(173,218,255,0.14)] px-2 py-1 text-data text-[var(--acea-cyan)]"
                    >
                      {command}
                    </button>
                  ))}
                </div>
              ) : null}

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  void send()
                }}
                className="flex items-end gap-2"
              >
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void send()
                    }
                  }}
                  rows={3}
                  placeholder="Chiedi diagnosi, spiegazioni o confronti..."
                  className="min-h-[88px] flex-1 rounded-2xl border border-[rgba(173,218,255,0.14)] bg-[rgba(4,10,20,0.68)] px-4 py-3 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-[rgba(75,214,255,0.32)]"
                />
                <Button size="icon" className="mb-1" disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              <div className="mt-2 flex items-center justify-between text-data text-[var(--text-lo)]">
                <span>Enter invia · Shift+Enter newline</span>
                <span>{storedPageContext.route}</span>
              </div>
            </div>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  )
}
