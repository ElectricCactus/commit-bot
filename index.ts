import { writeCommit } from "@/ai"
import { EOL } from "os"
import { $ } from "bun"
import ora from "ora"
import { fromZodError } from "zod-validation-error"
import { getRepoContext } from "@/git"
import { PromptCancelledError, PromptError, createPrompt } from "@/prompts"
import { ZodError } from "zod"

async function run() {
	let { cached_diff, working_diff, tree, repo, is_cached } =
		await getRepoContext()

	if (!is_cached) {
		await Bun.write(Bun.stdout, `⚠️ You have unstaged changes.${EOL}`)

		const { should_stage } = await createPrompt({
			type: "confirm",
			initial: true,
			name: "should_stage",
			message: "Stage changes with `git add .`?",
		} as const)

		if (should_stage) {
			await Bun.write(Bun.stdout, `git add .${EOL}`)
			await $`git add .`
		} else {
			await Bun.write(Bun.stdout, `🆗 Using working changes...${EOL}`)
		}
		;({ cached_diff, working_diff, tree, repo, is_cached } =
			await getRepoContext())
	}

	const diff = is_cached ? cached_diff : working_diff

	const { emitter, start } = await writeCommit({ repo, tree, diff })
	let message = ""

	const spinner = ora({
		spinner: "dots8Bit",
		text: "Generating content...",
	}).start()

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
	spinner.succeed("Content generated!")

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

	await Bun.write(Bun.stdout, `g commit${EOL}`)
	await $`git commit -m ${message}`

	const { push_response } = await createPrompt({
		name: "push_response",
		type: "confirm",
		initial: true,
		message: "Push to origin?",
	} as const)
	if (!push_response) {
		throw new Error("User declined push")
	}

	await Bun.write(Bun.stdout, `g push${EOL}`)
	await $`git push`
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
