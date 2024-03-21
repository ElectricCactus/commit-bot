import createClient from "openapi-fetch"
import {
  type ConversationGenerator,
  type ConversationMessage,
  type ConversationResult,
  ConversationSignal,
  createConversation,
} from "./adapter"
import type { components, paths } from "./openai.d"

let client: ReturnType<typeof createClient<paths>> | undefined

function getClient() {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required")
    }
    client = createClient<paths>({
      baseUrl: "https://api.openai.com/v1",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
  }
  return client
}

type ChatCompletionStreamResponse =
  components["schemas"]["CreateChatCompletionStreamResponse"]

type ChatCompletionProps = {
  model: string
  messages: ConversationMessage[]
}

async function chatCompletions({
  model,
  messages,
}: ChatCompletionProps): Promise<ConversationResult> {
  return createConversation({
    async setup() {
      const { response } = await getClient().POST("/chat/completions", {
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
        throw new Error("Conversation failed")
      }

      const decoder = new TextDecoder()

      async function* read(r: NonNullable<typeof reader>) {
        while (true) {
          const { done, value } = await r.read()

          if (done) {
            return
          }

          const lines = decoder
            .decode(value, { stream: true })
            .trim()
            .split("\n")

          for (let line of lines) {
            if (line.startsWith("data:")) {
              line = line.slice(5).trim()
            }

            if (line === "[DONE]" || line === "") continue

            const event = JSON.parse(line) as ChatCompletionStreamResponse

            yield event
          }
        }
      }

      return read(reader)
    },
    parse: (data) => {
      if (
        (data.choices && data.choices.length === 0) ||
        !data.choices[0].delta.content
      ) {
        return ConversationSignal.CONTINUE
      }

      const { content } = data.choices[0].delta

      return {
        type: "delta",
        content,
      }
    },
  })
}

async function* startConversation({
  model,
  ...props
}: ChatCompletionProps): ConversationGenerator {
  let next: Omit<ChatCompletionProps, "model"> = props
  while (true) {
    next = yield await chatCompletions({ ...next, model })
  }
}

export function factoryStartConversationOpenAI(model: string) {
  return (props: Omit<ChatCompletionProps, "model">) =>
    startConversation({ model, ...props })
}
