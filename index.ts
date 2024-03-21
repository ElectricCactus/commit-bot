#! /usr/bin/env bun

import { EOL } from "os"
import { parseArgs } from "util"
import { branchGenerator, prGenerator } from "@/generator"
import { getDiff, getStatus } from "@/git"
import { PromptError, createPrompt } from "@/prompts"
import { shell } from "@/shell"
import { APIError } from "@anthropic-ai/sdk"
import { ZodError } from "zod"
import { fromZodError } from "zod-validation-error"
import packageJson from "./package.json"

async function run() {
  const { values } = parseArgs({
    options: {
      version: {
        type: "boolean",
        short: "v",
      },
      branch: {
        type: "boolean",
        short: "b",
      },
    },
    args: Bun.argv,
    strict: true,
    allowPositionals: true,
  })

  if (values.version) {
    const version = "version" in packageJson ? packageJson.version : "0.0.0"
    console.log(version)
    process.exit(0)
  }

  if (values.branch) {
    console.log("‼️ Experimental feature")
    const branch = await branchGenerator({
      adapter: "claude_fast",
    })
    await branch.generate()
    process.exit(0)
  }

  const { is_cached } = await getDiff()

  if (!is_cached) {
    await Bun.write(Bun.stdout, `⚠️ You have unstaged changes.${EOL}`)

    await Bun.write(Bun.stdout, await getStatus())

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

  const content = await prGenerator({
    adapter: "claude_fast",
  })

  let message: string
  let feedback: string | undefined

  while (true) {
    message = await content.generate(feedback)

    await Bun.write(Bun.stdout, EOL)

    const { confirm_response } = await createPrompt({
      type: "confirm",
      initial: true,
      name: "confirm_response",
      message: "Does the content look good?",
    } as const)
    if (confirm_response) {
      break
    }

    const { new_message } = await createPrompt({
      type: "text",
      name: "new_message",
      message: "Feedback: ",
    } as const)

    feedback = new_message

    await Bun.write(Bun.stdout, `🔄 Applying feedback...${EOL}`)
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
  console.error("🚨 Aborted")
  process.exit(1)
})

function formatError<T>(err: T) {
  if (err instanceof ZodError) {
    return fromZodError(err).toString()
  }
  if (err instanceof APIError) {
    return `Anthropic error: (${err.status}) ${err.message}`
  }
  if (err instanceof PromptError) {
    return `Prompt error: ${err.message}`
  }
  if (err instanceof Error) {
    return err.stack
  }
  return `${err}`
}

await run()
  .catch((err) => {
    console.error("🚨", formatError(err))
    process.exit(1)
  })
  .finally(() => Bun.write(Bun.stdout, `👋 goodbye ${EOL}`))
