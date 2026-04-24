"use client"

import { FormEvent, useState } from "react"
import { Bot, Send, X } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { GlassCard } from "@/components/ui/GlassCard"
import { Input } from "@/components/ui/Input"

type AgentChatProps = {
  open: boolean
  onClose: () => void
}

export function AgentChat({ open, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask about the active page, an incident, a tank balance, a DMA water balance, or an audit trail."
    }
  ])
  const [input, setInput] = useState("")

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!input.trim()) {
      return
    }
    setMessages((current) => [
      ...current,
      { role: "operator", content: input.trim() },
      {
        role: "assistant",
        content:
          "Chat routing is connected to the HF backend in the next work step. Every LLM response will write an AI Act audit row."
      }
    ])
    setInput("")
  }

  return (
    <aside
      className={`fixed bottom-0 right-0 top-0 z-40 w-full max-w-[420px] transform border-l border-[var(--glass-stroke)] bg-[rgba(5,11,20,0.9)] backdrop-blur-[var(--blur-glass)] transition duration-300 ${open ? "translate-x-0" : "translate-x-full"}`}
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
            <GlassCard key={`${message.role}-${index}`} className="p-3">
              <div className="mb-1 font-[var(--font-jetbrains)] text-[11px] uppercase tracking-[0.14em] text-[var(--text-lo)]">
                {message.role}
              </div>
              <p className="text-sm leading-6 text-[var(--text-md)]">{message.content}</p>
            </GlassCard>
          ))}
        </div>
        <form className="flex gap-2 border-t border-[var(--glass-stroke)] p-4" onSubmit={submit}>
          <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="/explain TK-03" />
          <Button size="icon" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  )
}
