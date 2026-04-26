"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Check, Coins, FileText, ImageIcon, Music, Paperclip, RotateCcw, Send, Sparkles, Wrench, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/Button"
import { DataBadge } from "@/components/ui/DataBadge"
import { GlassCard } from "@/components/ui/GlassCard"
import { postChat } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chatStore"
import { useSelectionStore } from "@/store/selectionStore"
import type { ChatAttachment, ChatAttachmentKind } from "@/types/domain"

const slashCommands = ["/summarize", "/explain", "/what-if", "/compare"]
const operationsQuickPrompts = [
  "What is the highest-priority field check for the active anomaly?",
  "Give me the next three operational checks for the next two hours.",
  "Is this pattern more consistent with leakage, demand, or a sensor issue?"
]
const investmentsQuickPrompts = [
  "Give me the best ARERA-aligned investment recommendation.",
  "Which GIS and hydrogeology opportunity has the best ROI?",
  "Summarize payback, uncertainty, and what data must be validated."
]

const maxAttachments = 6
const maxAttachmentBytes = 8 * 1024 * 1024
const acceptedAttachmentTypes = "image/*,audio/*,.pdf,.txt,.md,.csv,.json,.xml,.doc,.docx,.xls,.xlsx"

function attachmentKind(mimeType: string, name: string): ChatAttachmentKind {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType.startsWith("audio/")) return "audio"
  if (/\.(png|jpe?g|webp|gif)$/i.test(name)) return "image"
  if (/\.(mp3|wav|m4a|ogg|webm)$/i.test(name)) return "audio"
  return "document"
}

function attachmentIcon(kind: ChatAttachmentKind) {
  if (kind === "image") return ImageIcon
  if (kind === "audio") return Music
  return FileText
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`))
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : ""
      resolve({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        kind: attachmentKind(file.type || "", file.name),
        data_url: dataUrl
      })
    }
    reader.readAsDataURL(file)
  })
}

function isMarkdownTableLine(line: string) {
  const trimmed = line.trim()
  return trimmed.startsWith("|")
}

function isMarkdownTableSeparator(line: string) {
  return /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(line)
}

function stableStreamingMarkdown(content: string, pending?: boolean) {
  if (!pending || !content) return content

  const lines = content.split("\n")
  let end = lines.length - 1
  while (end >= 0 && lines[end].trim() === "") {
    end -= 1
  }
  if (end < 0) return content

  let start = end
  while (start >= 0 && isMarkdownTableLine(lines[start])) {
    start -= 1
  }

  const trailingTable = lines.slice(start + 1, end + 1)
  if (trailingTable.length >= 1 && trailingTable.some(isMarkdownTableSeparator)) {
    return lines.slice(0, start + 1).join("\n").trimEnd()
  }

  return content
}

type AgentChatProps = {
  mode?: "page" | "panel"
}

export function AgentChat({ mode = "page" }: AgentChatProps) {
  const messages = useChatStore((state) => state.messages)
  const sessionId = useChatStore((state) => state.sessionId)
  const storedPageContext = useChatStore((state) => state.pageContext)
  const agentMode = useChatStore((state) => state.agentMode)
  const setAgentMode = useChatStore((state) => state.setAgentMode)
  const appendMessage = useChatStore((state) => state.appendMessage)
  const updateMessage = useChatStore((state) => state.updateMessage)
  const clear = useChatStore((state) => state.clear)
  const activeRoute = useSelectionStore((state) => state.activeRoute)
  const activeSegment = useSelectionStore((state) => state.activeSegment)
  const activeTank = useSelectionStore((state) => state.activeTank)
  const activeDMA = useSelectionStore((state) => state.activeDMA)
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const deferredCommands = useMemo(
    () => (input.startsWith("/") ? slashCommands.filter((command) => command.startsWith(input.toLowerCase())) : []),
    [input]
  )
  const quickPrompts = agentMode === "investments" ? investmentsQuickPrompts : operationsQuickPrompts
  const assistantName = agentMode === "investments" ? "Investments Agent" : "Droplet AI"

  const heroVisible = mode === "page" && messages.length <= 1 && !loading

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setAttachmentError(null)
    const slots = Math.max(0, maxAttachments - attachments.length)
    const selected = Array.from(files).slice(0, slots)
    const oversized = selected.find((file) => file.size > maxAttachmentBytes)
    if (oversized) {
      setAttachmentError(`${oversized.name} is larger than ${formatBytes(maxAttachmentBytes)}.`)
      return
    }
    if (files.length > slots) {
      setAttachmentError(`Only ${maxAttachments} attachments can be sent at once.`)
    }
    try {
      const next = await Promise.all(selected.map(readAttachment))
      setAttachments((current) => [...current, ...next].slice(0, maxAttachments))
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : "Unable to read attachment.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id))
    setAttachmentError(null)
  }

  async function send() {
    const content = input.trim()
    if ((!content && !attachments.length) || loading) return

    const operatorId = `operator-${Date.now()}`
    const assistantId = `assistant-${Date.now()}`
    const pendingAttachments = attachments
    const messageContent = content || "Analyze the attached file."
    const livePageContext = {
      ...storedPageContext,
      route: activeRoute,
      entity_type: activeSegment ? "segment" : activeTank ? "tank" : activeDMA ? "dma" : storedPageContext.entity_type,
      entity_id: activeSegment ?? activeTank ?? activeDMA ?? storedPageContext.entity_id ?? null
    }

    appendMessage({
      id: operatorId,
      role: "operator",
      content: messageContent,
      agentMode,
      attachments: pendingAttachments.map(({ data_url: _dataUrl, ...attachment }) => attachment)
    })
    appendMessage({ id: assistantId, role: "assistant", content: "", pending: true, agentMode })
    setInput("")
    setAttachments([])
    setAttachmentError(null)
    setLoading(true)

    try {
      const stream = await postChat(messageContent, livePageContext, sessionId, agentMode, pendingAttachments)
      let buffer = ""

      for await (const chunk of stream) {
        if (chunk.error) {
          updateMessage(assistantId, {
            content: `AI error${chunk.error_type ? ` (${chunk.error_type})` : ""}: ${chunk.error}`,
            pending: false
          })
          return
        }
        if (chunk.token) {
          buffer += chunk.token
          updateMessage(assistantId, { content: buffer })
        }
        if (chunk.done) {
          updateMessage(assistantId, {
            content: buffer || "No response available.",
            citations: chunk.citations,
            auditLogId: chunk.audit_log_id,
            suggestedActions: chunk.suggested_actions,
            pending: false
          })
        }
      }
    } catch (error) {
      updateMessage(assistantId, {
        content: `AI request failed: ${error instanceof Error ? error.message : String(error)}`,
        pending: false
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        mode === "page"
          ? "rounded-[2rem] border border-[var(--glass-stroke)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(239,247,255,0.92))] shadow-[0_24px_80px_rgba(8,53,107,0.14)]"
          : "rounded-[1.6rem] border border-[var(--glass-stroke)] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(239,247,255,0.92))]"
      )}
    >
      <div className="relative overflow-hidden border-b border-[rgba(173,218,255,0.1)] px-5 pb-5 pt-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(75,214,255,0.18),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(68,215,192,0.14),transparent_24%)]" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-[1.2rem] border border-[rgba(75,214,255,0.22)] bg-[linear-gradient(180deg,rgba(75,214,255,0.18),rgba(255,255,255,0.7))]">
                <Image src="/droplet-mark.svg" alt="" width={26} height={26} className="h-6 w-6" priority />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold text-[var(--text-hi)]">{assistantName}</div>
                  <Sparkles className="h-3.5 w-3.5 text-[var(--acea-teal)]" />
                </div>
                <div className="text-data text-[var(--text-lo)]">{sessionId}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <DataBadge label="agent" value={agentMode === "investments" ? "investment" : "operations"} tone={agentMode === "investments" ? "yellow" : "neutral"} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="rounded-[1.2rem] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.72)] p-1">
              <div className="grid grid-cols-2 gap-1">
                {[
                  { value: "operations" as const, label: "Operations", icon: Wrench },
                  { value: "investments" as const, label: "Investment", icon: Coins }
                ].map((item) => {
                  const Icon = item.icon
                  const active = agentMode === item.value
                  return (
                    <button
                      key={item.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setAgentMode(item.value)}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-[0.95rem] px-3 text-sm transition",
                        active
                          ? "bg-[rgba(75,214,255,0.14)] text-[var(--acea-ice)]"
                          : "text-[var(--text-md)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--text-hi)]"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <Button variant="ghost" size="sm" onClick={clear}>
              <RotateCcw className="h-3.5 w-3.5" />
              New chat
            </Button>
          </div>
        </div>
      </div>

      {heroVisible ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="text-page-title max-w-3xl text-[var(--text-hi)]">What do you want to investigate today?</div>
          <div className="mt-3 max-w-2xl text-sm text-[var(--text-md)]">
            {agentMode === "investments"
              ? "Ask about GIS opportunities, ARERA indicators, ROI, payback, falde depth, and investment uncertainty."
              : "Ask about incidents, pipe anomalies, DMA behavior, tank status, or the next operational checks."}
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                className="rounded-full border border-[rgba(173,218,255,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-sm text-[var(--text-md)] transition hover:border-[rgba(75,214,255,0.22)] hover:text-[var(--text-hi)]"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="app-scroll flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.role === "operator" ? "justify-end" : "justify-start")}
            >
              <GlassCard
                className={cn(
                  "min-w-0 p-4",
                  message.role === "operator"
                    ? "max-w-[78%] bg-[linear-gradient(180deg,rgba(75,214,255,0.1),rgba(47,144,255,0.04))]"
                    : "w-[92%] max-w-[920px] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(68,215,192,0.03))]"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-data text-[var(--text-lo)]">
                    {message.role === "operator"
                      ? "Operator"
                      : message.agentMode === "investments"
                        ? "Investments Agent"
                        : "Droplet AI"}
                  </span>
                  {message.auditLogId ? <DataBadge label="audit" value={String(message.auditLogId)} tone="neutral" /> : null}
                </div>
                {message.attachments?.length ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {message.attachments.map((attachment) => {
                      const Icon = attachmentIcon(attachment.kind)
                      return (
                        <div
                          key={attachment.id}
                          className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.72)] px-2.5 py-1.5 text-xs text-[var(--text-md)]"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--acea-cyan)]" />
                          <span className="max-w-[220px] truncate">{attachment.name}</span>
                          <span className="shrink-0 text-[var(--text-lo)]">{formatBytes(attachment.size_bytes)}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : null}
                {(() => {
                  const displayContent = stableStreamingMarkdown(message.content, message.pending)
                  return message.pending && !displayContent ? (
                  <div className="text-sm leading-7 text-[var(--text-md)]">
                    {message.agentMode === "investments" ? "Building an investment report..." : "Building an operational answer..."}
                  </div>
                ) : (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-[rgba(173,218,255,0.14)]">
                          <table className="w-full min-w-[520px] table-fixed border-collapse text-left text-xs">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="break-words border-b border-[rgba(173,218,255,0.14)] bg-[rgba(75,214,255,0.08)] px-3 py-2 font-semibold text-[var(--text-hi)]">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="break-words border-b border-[rgba(173,218,255,0.08)] px-3 py-2 align-top text-[var(--text-md)]">
                          {children}
                        </td>
                      ),
                      p: ({ children }) => <p className="mb-2 text-sm leading-7 text-[var(--text-md)]">{children}</p>,
                      li: ({ children }) => <li className="ml-4 list-disc text-sm leading-7 text-[var(--text-md)]">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold text-[var(--text-hi)]">{children}</strong>
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                )
                })()}
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
                        className="rounded-2xl border border-[rgba(173,218,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(75,214,255,0.03))] p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-[var(--text-hi)]">{action.parameter}</div>
                          <DataBadge label="target" value={`${action.entity_type} ${action.entity_id}`} tone="neutral" />
                        </div>
                        <div className="mt-1 text-sm text-[var(--text-md)]">{action.rationale}</div>
                        <div className="mt-3 flex gap-2">
                          <Button size="sm">
                            <Check className="h-3 w-3" />
                            Approve
                          </Button>
                          <Button variant="ghost" size="sm">
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </GlassCard>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

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

        {attachments.length ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => {
              const Icon = attachmentIcon(attachment.kind)
              return (
                <div
                  key={attachment.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-[rgba(173,218,255,0.14)] bg-[rgba(255,255,255,0.04)] px-2.5 py-1.5 text-xs text-[var(--text-md)]"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--acea-cyan)]" />
                  <span className="max-w-[220px] truncate">{attachment.name}</span>
                  <span className="shrink-0 text-[var(--text-lo)]">{formatBytes(attachment.size_bytes)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${attachment.name}`}
                    onClick={() => removeAttachment(attachment.id)}
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[var(--text-lo)] transition hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--text-hi)]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}
        {attachmentError ? <div className="mb-2 text-xs text-[var(--phi-red)]">{attachmentError}</div> : null}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
          className="flex items-end gap-3"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedAttachmentTypes}
            className="hidden"
            onChange={(event) => void addFiles(event.currentTarget.files)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mb-1 h-12 w-12"
            disabled={loading || attachments.length >= maxAttachments}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                void send()
              }
            }}
            rows={mode === "page" ? 2 : 3}
            placeholder={
              agentMode === "investments"
                ? "Ask for ARERA-aligned investment strategy, ROI, payback, or GIS/falde prioritization."
                : "Ask what to check next, which failure mode is most likely, or which action should be prioritized."
            }
            className="min-h-[72px] flex-1 rounded-[1.6rem] border border-[var(--glass-stroke)] bg-[rgba(255,255,255,0.86)] px-4 py-3 text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)] focus:border-[rgba(75,214,255,0.32)]"
          />
          <Button size="icon" className="mb-1 h-12 w-12" disabled={loading || (!input.trim() && !attachments.length)}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-2 flex items-center justify-between text-data text-[var(--text-lo)]">
          <span>Enter sends · Shift+Enter adds a line</span>
          <span>{agentMode === "investments" ? "investment agent" : "operations agent"}</span>
        </div>
      </div>
    </div>
  )
}
