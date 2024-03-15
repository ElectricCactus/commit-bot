import { once } from "events"
import {
  type ChatCompletionResult,
  type ChatCompletionsProps,
  startConversation,
} from "./openai"

const USE_EMOJI = true

const DEFAULT_PR_FORMAT = `
chore(scope): solves a problem with some solution

this is the slightly longer description of the pr

- added a new feature
- fixed a bug
- improved performance

\`tag tag tag tag tag\`
`

const DEFAULT_SYSTEM_PROMPT = `
	You write pull requests. Pull request should include a short conventional commits style title,
	followed by a longer description what this PR is trying to solve. The title should be plaintext but the description can be markdown.
	**Keep in mind, everything should be around 80 characters in length to keep the content quickly digestible.**
	Keep verbage succint and to the point. Prefer bulleted lists over lengthy paragraphs.
	You should generate tags, up to 5, relevant to this PR to aid in searchability.
	Each line should be 80 characters or less. Don't include descriptions for changes due to
	generated side effects, eg. lock files. When working with emojis, use them as glyphs to
	quickly convey meaning and not as decoration. ${
    USE_EMOJI
      ? "Use of emojis in the description is encouraged."
      : "Use of emojis should be where appropriate."
  }
	The format is below, do not include the format template text in the generated content:
	
  ${DEFAULT_PR_FORMAT}
`

type PullRequestContext = {
  repo: string
  tree: string
  diff: string
}

type Message = ChatCompletionsProps["messages"][number]

type CodeChatProps = {
  messages: Message[]
  model: string
}

export async function* codeChat(
  props: CodeChatProps,
): AsyncGenerator<ChatCompletionResult, void, string> {
  const conversation = await startConversation(props)

  let next = await conversation.next()

  while (!next.done) {
    const [[system_message], user_message]: [string[], string, boolean] =
      await Promise.all([
        once(next.value.emitter, "message"),
        yield next.value,
        next.value.emitter.emit("get_message"),
      ])

    let messages: Message[] = [
      {
        role: "system",
        content: system_message,
      },
      {
        role: "user",
        content: user_message,
      },
    ]

    props.messages.push(...messages)
    messages = props.messages

    next = await conversation.next({ messages })
  }
}

export async function writePR({ repo, tree, diff }: PullRequestContext) {
  const model = "gpt-4-turbo-preview"
  const messages: Message[] = [
    {
      role: "system",
      content: DEFAULT_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `The repo name is ${repo}, the file tree is ${tree}, and the diff is ${diff}`,
    },
  ]

  return await codeChat({ model, messages })
}

export async function branchName({ repo, tree, diff }: PullRequestContext) {
  const model = "gpt-4-turbo-preview"
  const messages: Message[] = [
    {
      role: "system",
      content:
        "Your role is to generate a branch name based on the provided context.",
    },
    {
      role: "user",
      content: `The repo name is ${repo}, the file tree is ${tree}, and the diff is ${diff}`,
    },
  ]

  return await codeChat({ model, messages })
}
