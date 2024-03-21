import { once } from "events"
import {
  Adapters,
  type Adapter,
  type ConversationMessage,
  type ConversationResult,
  getAdapter,
} from "./adapter"

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
  adapter: Adapter
  repo: string
  tree: string
  diff: string
}

type CodeChatProps = {
  adapter: Adapter
  messages: ConversationMessage[]
}

export async function* codeChat({
  adapter,
  ...props
}: CodeChatProps): AsyncGenerator<ConversationResult, void, string> {
  const { generateConversation } = getAdapter(adapter)
  const conversation = await generateConversation(props)

  let next = await conversation.next()

  while (!next.done) {
    const [[system_message], user_message]: [string[], string, boolean] =
      await Promise.all([
        once(next.value.emitter, "message"),
        yield next.value,
        next.value.emitter.emit("get.message"),
      ])

    let messages: ConversationMessage[] = [
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

export async function writePR({
  adapter,
  repo,
  tree,
  diff,
}: PullRequestContext) {
  const messages: ConversationMessage[] = [
    {
      role: "system",
      content: DEFAULT_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: `The repo name is ${repo}, the file tree is ${tree}, and the diff is ${diff}`,
    },
  ]

  return await codeChat({
    adapter,
    messages,
  })
}

export async function branchName({
  adapter,
  repo,
  tree,
  diff,
}: PullRequestContext) {
  const messages: ConversationMessage[] = [
    {
      role: "system",
      content: `You are a generator for branch names based the provided context (repo name, file tree, diff).
        You should only output the branch name and nothing else. The application
        of this will be used to pass directly to a CLI tool. The style should be conventional
        for consistency. You should only output branch names. If there is anything else in the
        message like: "Here is the branch name: branch-name", it will be considered an error.
        If the branch name contains information about generated content like npm/bun/deno/yarn lock files,
        it will be considered an error. The branch name should be 80 characters or less. If there isn't anything
        important to include, you should output a random creative name, include some popular culture references.`,
    },
    {
      role: "user",
      content: `<repo>${repo}</repo> <tree>${tree}</tree> <diff>${diff}</diff>`,
    },
  ]

  return await codeChat({
    adapter,
    messages,
  })
}
