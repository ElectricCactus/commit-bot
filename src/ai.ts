import { chatCompletions } from "./openai"

type WriteCommitProps = {
	repo: string
	tree: string
	diff: string
}

const USE_EMOJI = true

const DEFAULT_SYSTEM_PROMPT = `
	You write pull requests. Pull request should include a short conventional commits style title,
	followed by a longer description what this PR is trying to solve. This should be plaintext. 
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
	
	chore(scope): solves a problem with some solution

	this is the slightly longer description of the pr

	- added a new feature
	- fixed a bug
	- improved performance

	\`tag tag tag tag tag\`
`

export async function writeCommit({ repo, tree, diff }: WriteCommitProps) {
	const system_prompt = DEFAULT_SYSTEM_PROMPT
	const user_prompt = `The repo name is ${repo}, the file tree is ${tree}, and the diff is ${diff}`

	return chatCompletions({
		model: "gpt-4-turbo-preview",
		messages: [
			{
				role: "system",
				content: system_prompt,
			},
			{
				role: "user",
				content: user_prompt,
			},
		],
	})
}
