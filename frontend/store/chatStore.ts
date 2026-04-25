"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import type { ChatAgentMode, ChatAttachment, ChatCitation, ControlRecommendation, PageContext } from "@/types/domain"

export type ChatMessage = {
  id: string
  role: "operator" | "assistant"
  content: string
  agentMode?: ChatAgentMode
  attachments?: Array<Omit<ChatAttachment, "data_url">>
  citations?: ChatCitation[]
  suggestedActions?: ControlRecommendation[]
  auditLogId?: number
  pending?: boolean
}

type ChatState = {
  sessionId: string
  messages: ChatMessage[]
  pageContext: PageContext
  agentMode: ChatAgentMode
  setPageContext: (context: PageContext) => void
  setAgentMode: (mode: ChatAgentMode) => void
  appendMessage: (message: ChatMessage) => void
  updateMessage: (id: string, patch: Partial<ChatMessage>) => void
  clear: () => void
}

function makeSessionId() {
  return `session-${Math.random().toString(36).slice(2, 10)}`
}

const welcomeMessage =
  "Droplet AI is ready. I can analyze likely leaks, explain the current context, and suggest the next operational checks."

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      sessionId: makeSessionId(),
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content: welcomeMessage
        }
      ],
      pageContext: { route: "/app" },
      agentMode: "operations",
      setPageContext: (pageContext) => set({ pageContext }),
      setAgentMode: (agentMode) => set({ agentMode }),
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
              content: welcomeMessage
            }
          ]
        })
    }),
    { name: "droplet-chat-v2" }
  )
)
