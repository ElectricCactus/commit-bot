import { writePR } from "./ai"
import { getDiff, getFileTree, getRepoName } from "./git"
import { spin } from "./progress"

export async function contentGenerator() {
  const repo = await getRepoName()
  const tree = await getFileTree()
  const { diff } = await getDiff()

  const generator = await writePR({ repo, tree, diff })

  return {
    async generate(feedback?: string) {
      const { value, done } = await generator.next(
        ...(feedback ? [feedback] : []),
      )

      if (done) throw new Error("Cannot generate content, conversation ended")

      const { emitter, start } = value

      return spin(
        "Generating content...",
        async (spinner) => {
          let message = ""

          emitter.on("data", async (data) => {
            if (
              (data.choices && data.choices.length === 0) ||
              !data.choices[0].delta.content
            )
              return

            const { content } = data.choices[0].delta

            message += content

            spinner.suffixText = `\n\n${message}`
          })

          emitter.on("unknown", (unknown) => {
            console.dir({ unknown }, { depth: null })
          })

          emitter.on("get_message", () => emitter.emit("message", message))

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
