import { EOL } from "os"
import { writeCommit } from "@/ai"
import { getRepoContext } from "@/git"
import { PromptError, createPrompt } from "@/prompts"
import ora from "ora"
import { ZodError } from "zod"
import { fromZodError } from "zod-validation-error"
import { shell } from "@/shell"
import { generateContent } from "@/content"

async function run() {
  const { is_cached } = await getRepoContext()

  if (!is_cached) {
    await Bun.write(Bun.stdout, `⚠️ You have unstaged changes.${EOL}`)

    const { should_stage } = await createPrompt({
      type: "confirm",
      initial: true,
      name: "should_stage",
      message: "Stage changes with `git add .`?",
    } as const)

    if (should_stage) {
      await shell`git add .`
    } else {
      await Bun.write(Bun.stdout, `🆗 Using working changes...${EOL}`)
    }
  }

  const message = await generateContent()

  await Bun.write(Bun.stdout, EOL)

  const { confirm_response } = await createPrompt({
    type: "confirm",
    initial: true,
    name: "confirm_response",
    message: "Would you like to use this content?",
  } as const)
  if (!confirm_response) {
    throw new Error("User declined content")
  }

  await shell`git commit -m ${message}`

  const { push_response } = await createPrompt({
    name: "push_response",
    type: "confirm",
    initial: true,
    message: "Push to origin?",
  } as const)
  if (!push_response) {
    throw new Error("User declined push")
  }

  await shell`git push`
}

process.on("SIGINT", () => {
  console.log("Ctrl-C was pressed")
  process.exit()
})

function formatError<T>(err: T) {
  if (err instanceof ZodError) {
    return fromZodError(err).toString()
  }
  if (err instanceof PromptError) {
    return `Prompt error: ${err.message}`
  }
  if (err instanceof Error) {
    return err.message
  }
  return `${err}`
}

await run().catch((err) => {
  console.error("🚨", formatError(err))
  process.exit(1)
})

console.log("👋 goodbye")
