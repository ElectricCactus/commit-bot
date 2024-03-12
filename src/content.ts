import { writeCommit } from "./ai"
import { getDiff, getFileTree, getRepoName } from "./git"
import { spin } from "./progress"

export async function generateContent() {
  const repo = await getRepoName()
  const tree = await getFileTree()
  const { diff } = await getDiff()

  const message = spin(
    "Generating content...",
    async (spinner) => {
      const { emitter, start } = await writeCommit({ repo, tree, diff })

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

      await start()

      return message
    },
    {
      onSucceed() {
        return "Content generated!"
      },
    },
  )

  return message
}
