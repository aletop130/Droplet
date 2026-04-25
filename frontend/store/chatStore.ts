"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ChatCitation, ControlRecommendation, PageContext } from "@/types/domain"

export type ChatMessage = {
  id: string
  role: "operator" | "assistant"
  content: string
  citations?: ChatCitation[]
  suggestedActions?: ControlRecommendation[]
  auditLogId?: number
  pending?: boolean
}

type ChatState = {
  sessionId: string
  messages: ChatMessage[]
  pageContext: PageContext
  setPageContext: (context: PageContext) => void
  appendMessage: (message: ChatMessage) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  clear: () => void
}

function makeSessionId() {
  return `session-${Math.random().toString(36).slice(2, 10)}`
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: makeSessionId(),
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content:
            "Regolo AI è pronto. Puoi chiedere diagnosi su segmenti, serbatoi, DMA o spiegazioni del contesto attivo."
        }
      ],
      pageContext: { route: "/app" },
      setPageContext: (pageContext) => set({ pageContext }),
      appendMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
      updateMessage: (id, patch) =>
        set((state) => ({
          messages: state.messages.map((message) => (message.id === id ? { ...message, ...patch } : message))
        })),
      clear: () =>
        set({
          sessionId: makeSessionId(),
          messages: [
            {
              id: "welcome",
              role: "assistant",
              content:
                "Regolo AI è pronto. Puoi chiedere diagnosi su segmenti, serbatoi, DMA o spiegazioni del contesto attivo."
            }
          ]
        })
    }),
    { name: "droplet-chat" }
  )
)
