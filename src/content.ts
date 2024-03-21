import type { Adapter } from "./adapter"
import { branchName, writePR } from "./ai"
import { getDiff, getFileTree, getRepoName } from "./git"
import { spin } from "./progress"

type ContentGeneratorProps = {
  adapter: Adapter
}

export async function contentGenerator({ adapter }: ContentGeneratorProps) {
  const repo = await getRepoName()
  const tree = await getFileTree()
  const { diff } = await getDiff()

  const generator = await writePR({ adapter, repo, tree, diff })

  return {
    async generate(feedback?: string) {
      const { value, done } = await spin("Thinking...", () =>
        generator.next(...(feedback ? [feedback] : [])),
      )

      if (done) throw new Error("Cannot generate content, conversation ended")

      const { emitter, start } = value

      return spin(
        "Generating content...",
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
            return "Content generated!"
          },
        },
      )
    },
  }
}

export async function branchGenerator({ adapter }: ContentGeneratorProps) {
  const repo = await getRepoName()
  const tree = await getFileTree()
  const { diff } = await getDiff()

  const generator = await branchName({ adapter, repo, tree, diff })

  return {
    async generate(feedback?: string) {
      const { value, done } = await spin("Thinking...", () =>
        generator.next(...(feedback ? [feedback] : [])),
      )

      if (done) throw new Error("Cannot generate content, conversation ended")

      const { emitter, start } = value

      return spin(
        "Generating branch name...",
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
            return "Generated branch name!"
          },
        },
      )
    },
  }
}
