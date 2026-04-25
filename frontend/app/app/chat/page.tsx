"use client"

import { AgentChat } from "@/components/chat/AgentChat"

export default function ChatPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[1320px]">
      <AgentChat mode="page" />
    </div>
  )
}
