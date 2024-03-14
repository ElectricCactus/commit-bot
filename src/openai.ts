import { EventEmitter } from "events"
import createClient from "openapi-fetch"
import type { components, paths } from "./openai.d"

const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is required")
}

export const client = createClient<paths>({
  baseUrl: "https://api.openai.com/v1",
  headers: {
    Authorization: `Bearer ${apiKey}`,
  },
})

export type ChatCompletionsProps = {
  model: string
  messages: components["schemas"]["ChatCompletionRequestMessage"][]
}

type ChatCompletionStreamResponse =
  components["schemas"]["CreateChatCompletionStreamResponse"]

type ChatCompletionEmitter = Omit<EventEmitter, "on" | "emit"> & {
  on(event: "unknown", listener: (data: unknown) => void): void
  on(
    event: "data",
    listener: (data: ChatCompletionStreamResponse) => void,
  ): void
  on(event: "done", listener: () => void): void
  on(event: "message", listener: (data: string) => void): void
  on(event: "get_message", listener: () => void): void

  emit(event: "unknown", data: unknown): boolean
  emit(event: "data", data: ChatCompletionStreamResponse): boolean
  emit(event: "done"): boolean
  emit(event: "message", data: string): boolean
  emit(event: "get_message"): boolean
}

export type ChatCompletionResult = {
  response: Response
  emitter: ChatCompletionEmitter
  start: () => Promise<void>
}

export async function chatCompletions({
  model,
  messages,
}: ChatCompletionsProps): Promise<ChatCompletionResult> {
  const { response } = await client.POST("/chat/completions", {
    parseAs: "stream",
    body: {
      model,
      messages,
      stream: true,
      temperature: 0.4,
      frequency_penalty: 1.2,
    },
  })

  const reader = response.body?.getReader()

  if (!response.ok || !response.body || !reader) {
    throw new Error("Chat completions failed")
  }

  const emitter = new EventEmitter() as ChatCompletionEmitter
  const decoder = new TextDecoder()

  return {
    response,
    emitter,
    async start() {
      let done = false
      let value: Uint8Array | undefined

      while (!done) {
        ;({ done, value } = await reader.read())

        if (done) {
          break
        }

        const text = decoder.decode(value).trim()
        const lines = text.split("\n")

        for (const line of lines) {
          let chunk = line
          while (chunk.startsWith("data:")) {
            chunk = chunk.slice("data:".length).trim()
          }

          if (chunk === "" || chunk === "[DONE]") {
            continue
          }

          try {
            const json = JSON.parse(chunk) as ChatCompletionStreamResponse

            emitter.emit("data", json)
          } catch (err) {
            console.error("failed to parse", chunk, err)
            emitter.emit("unknown", chunk)
          }
        }
      }

      emitter.emit("done")
    },
  }
}

export type ConversationGenerator = AsyncGenerator<
  ChatCompletionResult,
  void,
  Omit<ChatCompletionsProps, "model">
>

export async function* startConversation({
  model,
  ...props
}: ChatCompletionsProps): ConversationGenerator {
  let next: Omit<ChatCompletionsProps, "model"> = props
  while (true) {
    next = yield await chatCompletions({ ...next, model })
  }
}
