type SseMessage = {
  event?: string
  data: string
}

function parseSseBuffer(buffer: string) {
  const messages: SseMessage[] = []
  const chunks = buffer.split("\n\n")
  const remaining = chunks.pop() ?? ""

  for (const chunk of chunks) {
    const lines = chunk.split("\n")
    let event: string | undefined
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim()
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim())
      }
    }

    if (dataLines.length > 0) {
      messages.push({ event, data: dataLines.join("\n") })
    }
  }

  return { messages, remaining }
}

export async function* streamSseJson<T>(input: RequestInfo | URL, init?: RequestInit): AsyncGenerator<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "text/event-stream",
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok || !response.body) {
    throw new Error(`SSE request failed with ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseBuffer(buffer)
    buffer = parsed.remaining

    for (const message of parsed.messages) {
      if (!message.data || message.data === "[DONE]") continue
      yield JSON.parse(message.data) as T
    }
  }

  if (buffer.trim()) {
    const parsed = parseSseBuffer(`${buffer}\n\n`)
    for (const message of parsed.messages) {
      if (!message.data || message.data === "[DONE]") continue
      yield JSON.parse(message.data) as T
    }
  }
}
