import { writeCommit } from "./ai"
import { getRepoContext } from "./git"
import { spin } from "./progress"

export async function generateContent() {
  const { diff, tree, repo } = await getRepoContext()

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
