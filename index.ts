import { writeCommit } from "@/ai"
import { EOL } from "os"
import { $ } from "bun"
import ora from "ora"
import { createPrompt } from "bun-promptx"

async function getContext() {
	const origin_name =
		await $`git remote get-url origin | awk -F'[:/]' '{gsub(/\.git$/, "", $NF); print $(NF-1)"/"$NF}'`.text()

	const folder_name = await $`basename $(pwd)`.text()

	const cached_diff = await $`git diff --cached`.text()
	const working_diff = await $`git diff`.text()

	const tree = await $`git ls-tree -r HEAD --name-only`.text()

	const repo = (origin_name !== "" ? origin_name : folder_name).replaceAll(
		/\r?\n|\r/g,
		"",
	)

	const is_cached = cached_diff !== ""

	return { cached_diff, working_diff, tree, repo, is_cached }
}

async function run() {
	let { cached_diff, working_diff, tree, repo, is_cached } = await getContext()

	if (!is_cached) {
		await Bun.write(Bun.stdout, `⚠️ You have unstaged changes.${EOL}`)

		const should_stage_response = createPrompt(
			"Stage changes with `git add .`? [y/N]",
		)
		if (should_stage_response.value?.toLowerCase() === "y") {
			await $`git add .`
		} else {
			await Bun.write(Bun.stdout, `🆗 Using working changes...${EOL}`)
		}
		;({ cached_diff, working_diff, tree, repo, is_cached } = await getContext())
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

	const confirm_response = createPrompt(
		"Would you like to use this content? [Y/n]",
	)
	if (confirm_response.value?.toLowerCase() === "n") {
		throw new Error("User declined content")
	}

	await $`git commit -m ${message}`

	await Bun.write(Bun.stdout, `🎉 Committed!${EOL}`)

	const push_response = createPrompt("Push to origin? [Y/n]")
	if (push_response.value?.toLowerCase() === "n") {
		throw new Error("User declined push")
	}

	await $`git push origin HEAD`

	await Bun.write(Bun.stdout, `🚀 Pushed!${EOL}`)
}

await run().catch((err) => {
	console.error("🚨", err.message)
	process.exit(1)
})

console.log("👋 goodbye")
