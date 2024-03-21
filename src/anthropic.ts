import Anthropic from "@anthropic-ai/sdk"
import {
  type ConversationGenerator,
  type ConversationMessage,
  type ConversationResult,
  ConversationSignal,
  createConversation,
} from "./adapter"

let client: Anthropic | undefined

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required")
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

type ChatCompletionProps = {
  model: Anthropic.MessageCreateParams["model"]
  messages: ConversationMessage[]
}

async function chatCompletions({
  model,
  ...props
}: ChatCompletionProps): Promise<ConversationResult> {
  return createConversation({
    async setup() {
      const [system, user, ...rest] = props.messages
      const messages: Anthropic.MessageParam[] = [
        {
          role: "user" as const,
          content: [system.content, user.content].join("\n"),
        },
        ...rest,
      ].map(({ content, role }) =>
        role === "system" ? { content, role: "assistant" } : { content, role },
      )
      return await getClient().messages.create({
        max_tokens: 1024,
        messages,
        model,
        stream: true,
      })
    },
    parse(event) {
      if (event.type === "content_block_delta") {
        return {
          type: "delta",
          content: event.delta.text,
        }
      }
      return ConversationSignal.CONTINUE
    },
  })
}

async function* startConversation(
  props: ChatCompletionProps,
): ConversationGenerator {
  let next: Pick<ChatCompletionProps, "messages"> = props
  while (true) {
    next = yield await chatCompletions({ ...props, ...next })
  }
}

export function factoryStartConversationClaude(
  model: ChatCompletionProps["model"],
) {
  return (props: Omit<ChatCompletionProps, "model">) =>
    startConversation({ model, ...props })
}
