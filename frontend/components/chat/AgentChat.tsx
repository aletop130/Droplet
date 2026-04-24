"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Bot, Loader2, Send, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"
import { API_BASE } from "@/lib/api"

type ChatMessage = {
  role: "operator" | "assistant"
  content: string
  isLoading?: boolean
}

type ChatStreamEvent = {
  type: "token" | "done"
  text?: string
  answer?: string
  citations?: Array<{ audit_log_id: number; doc_ids: number[] }>
  suggested_actions?: string[]
  latency_ms?: number
}

type AgentChatProps = {
  open: boolean
  onClose: () => void
  pageContext?: { entity_type: string; entity_id: number }
}

export function AgentChat({ open, onClose, pageContext }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask about the active page, an incident, a tank balance, a DMA water balance, or an audit trail."
    }
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput("")

    setMessages((current) => [
      ...current,
      { role: "operator", content: userMessage }
    ])

    setMessages((current) => [
      ...current,
      { role: "operator", content: userMessage },
      { role: "assistant", content: "", isLoading: true }
    ])
    setLoading(true)

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          page_context: pageContext ?? { entity_type: null, entity_id: null }
        })
      })

      if (!response.ok || !response.body) {
        throw new Error(`Chat API returned ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter((line) => line.startsWith("data: "))

        for (const line of lines) {
          try {
            const data: ChatStreamEvent = JSON.parse(line.slice(5))
            if (data.type === "token" && data.text) {
              assistantContent += data.text
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: assistantContent }
                }
                return updated
              })
            } else if (data.type === "done") {
              setLoading(false)
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      setMessages((prev) => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === "assistant") {
          updated[updated.length - 1] = {
            ...last,
            content: "Connection failed. The backend may be unavailable.",
            isLoading: false
          }
        }
        return updated
      })
      setLoading(false)
    }
  }

  return (
    <aside
      className={`fixed bottom-0 right-0 top-0 z-40 w-full max-w-[420px] transform border-l border-[var(--glass-stroke)] bg-[rgba(5,11,20,0.95)] backdrop-blur-[var(--blur-glass)] transition duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
      aria-hidden={!open}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-[var(--glass-stroke)] px-4">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-[var(--acea-cyan)]" />
            <span className="font-[var(--font-unbounded)] text-sm">AgentChat</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close chat">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message, index) => (
            <GlassCard
              key={`${message.role}-${index}`}
              className={`p-3 ${message.isLoading ? "opacity-60" : ""}`}
            >
              <div className="mb-1 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.14em] text-[var(--text-lo)]">
                {message.isLoading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Assistant
                  </span>
                ) : (
                  message.role
                )}
              </div>
              <p className="text-sm leading-6 text-[var(--text-md)]">
                {message.isLoading ? (
                  <span className="flex items-center gap-1 text-xs text-[var(--text-lo)]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  message.content
                )}
              </p>
            </GlassCard>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form className="flex gap-2 border-t border-[var(--glass-stroke)] p-4" onSubmit={submit}>
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="/explain TK-03"
            disabled={loading}
          />
          <Button size="icon" aria-label="Send" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  )
}
