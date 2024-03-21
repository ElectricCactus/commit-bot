import { EventEmitter } from "events"
import { factoryStartConversationClaude } from "./anthropic"
import { factoryStartConversationOpenAI } from "./openai"

export type ConversationMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }

export type ConversationEventDelta = {
  type: "delta"
  content: string
}

export type ConversationEvent = ConversationEventDelta

export const ConversationSignal = {
  DONE: "[DONE]",
  CONTINUE: "[CONTINUE]",
} as const

type ConversationSignals =
  (typeof ConversationSignal)[keyof typeof ConversationSignal]

export type ParseConversationEventFn<T> = (
  input: T,
) => ConversationEvent | ConversationSignals

export type ConversationEmitter = Omit<EventEmitter, "on" | "emit"> & {
  on(event: "error", listener: (error: Error) => void): void
  emit(event: "error", error: Error): boolean

  on(event: "data", listener: (data: ConversationEvent) => void): void
  emit(event: "data", data: ConversationEvent): boolean

  on(event: "done", listener: (message: string) => void): void
  emit(event: "done", message: string): boolean

  on(event: "message", listener: () => void): void
  emit(event: "message", message: string): boolean

  on(event: "get.message", listener: () => void): void
  emit(event: "get.message"): boolean
}

export type ConversationResult = {
  emitter: ConversationEmitter
  start: () => Promise<void>
}

export type ConversationProps<T> = {
  setup: () => Promise<AsyncIterable<T>>
  parse: ParseConversationEventFn<T>
}

export async function createConversation<T>({
  setup,
  parse,
}: ConversationProps<T>): Promise<ConversationResult> {
  const stream = await setup()

  const emitter: ConversationEmitter = new EventEmitter()

  return {
    emitter,
    start: async () => {
      let message = ""

      for await (const chunk of stream) {
        try {
          const event = parse(chunk)

          if (event === ConversationSignal.DONE) {
            break
          }
          if (event === ConversationSignal.CONTINUE) {
            continue
          }

          emitter.emit("data", event)

          if (event.type === "delta") {
            message += event.content
          }
        } catch (err) {
          if (err instanceof Error) {
            emitter.emit("error", err)
          } else {
            throw err
          }
        }
      }

      emitter.emit("done", message)
    },
  }
}

export type ConversationGenerator = AsyncGenerator<
  ConversationResult,
  void,
  { messages: ConversationMessage[] }
>

type GenerateConversationFn = (props: {
  messages: ConversationMessage[]
}) => ConversationGenerator

export const Adapters = {
  openAI: factoryStartConversationOpenAI("gpt-4-turbo-preview"),
  claude: factoryStartConversationClaude("claude-3-opus-20240229"),
  claude_fast: factoryStartConversationClaude("claude-3-haiku-20240307"),
} as const satisfies Record<string, GenerateConversationFn>

export type Adapter = keyof typeof Adapters

export function getAdapter(adapter: Adapter) {
  const { [adapter]: generateConversation } = Adapters
  if (!generateConversation) {
    throw new Error(
      `Invalid adapter: '${adapter}' Valid adapters: ${Object.keys(
        Adapters,
      ).join(", ")}`,
    )
  }
  return { generateConversation }
}
