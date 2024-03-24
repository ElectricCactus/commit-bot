import type { Adapter, ConversationResult } from "./adapter"
import { branchName, bumpVersion, writePR } from "./ai"
import { getDiff, getFileTree, getRepoName } from "./git"
import { spin } from "./progress"

type ContentGeneratorProps = {
  adapter: Adapter
}

type ContentGeneratorProvider = (
  props: ContentGeneratorProps,
) => Promise<AsyncGenerator<ConversationResult, void, string>>

type FactoryContentGeneratorProps = {
  provider: ContentGeneratorProvider
  strings?: {
    thinking?: string
    busy?: string
    done?: string
  }
}

type ContentGenerator = (props: ContentGeneratorProps) => Promise<{
  generate(feedback?: string): Promise<string>
}>

function factoryContentGenerator({
  provider,
  strings,
}: FactoryContentGeneratorProps): ContentGenerator {
  return async function generator(props: ContentGeneratorProps) {
    const generator = await provider(props)

    return {
      async generate(feedback?: string) {
        const { value, done } = await spin(
          strings?.thinking ?? "Thinking...",
          () => generator.next(...(feedback ? [feedback] : [])),
        )

        if (done) throw new Error("Cannot generate content, conversation ended")

        const { emitter, start } = value

        return spin(
          strings?.busy ?? "Generating content...",
          async (spinner) => {
            let message = ""

            emitter.on("data", async (data) => {
              if (data.type !== "delta") return

              message += data.content

              spinner.suffixText = `\n\n${message}`
            })

            emitter.on("get.message", () => emitter.emit("message", message))

            await start()

            emitter.emit("message", message)

            return message
          },
          {
            onSucceed() {
              return strings?.done ?? "Content generated!"
            },
          },
        )
      },
    }
  }
}

export const prGenerator = factoryContentGenerator({
  async provider({ adapter }) {
    const repo = await getRepoName()
    const tree = await getFileTree()
    const { diff } = await getDiff()

    return writePR({ adapter, repo, tree, diff })
  },
})

export const branchGenerator = factoryContentGenerator({
  async provider({ adapter }) {
    const repo = await getRepoName()
    const tree = await getFileTree()
    const { diff } = await getDiff()

    return branchName({ adapter, repo, tree, diff })
  },
})

export const changeSizeGenerator = factoryContentGenerator({
  async provider({ adapter }) {
    const repo = await getRepoName()
    const tree = await getFileTree()
    const { diff } = await getDiff()

    return bumpVersion({ adapter, repo, tree, diff })
  },
})
