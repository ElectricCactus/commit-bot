import prompts, { type PromptObject, type PromptType } from "prompts"
import { z } from "zod"

const ValidationMap = {
	text: z.string(),
	password: z.string(),
	invisible: z.string(),
	number: z.string(),
	confirm: z.boolean(),
	list: z.string(),
	toggle: z.string(),
	select: z.string(),
	multiselect: z.string(),
	autocomplete: z.string(),
	date: z.string(),
	autocompleteMultiselect: z.string(),
} satisfies Record<PromptType, z.ZodType>

type ValidationMap = {
	[key in keyof typeof ValidationMap]: z.infer<(typeof ValidationMap)[key]>
}

type TypedAnswers<O extends PromptObject<string>> = O extends { name: infer K }
	? K extends string
		? {
				[P in K]: O["type"] extends keyof ValidationMap
					? ValidationMap[O["type"]]
					: never
		  }
		: never
	: never

type UnionToIntersection<T> = (
	T extends unknown
		? (x: T) => unknown
		: never
) extends (x: infer R) => unknown
	? R
	: never

function assertHasAllAnswers<O extends PromptObject<string>>(
	prompt: O[],
	answers: prompts.Answers<string>,
): asserts answers is TypedAnswers<O> {
	let prev: O | undefined
	for (const question of prompt) {
		const key =
			typeof question.name === "function"
				? question.name(prev, answers, question)
				: question.name

		const type =
			typeof question.type === "function"
				? question.type(prev, answers, question)
				: question.type

		if (typeof type === "string") {
			const result = ValidationMap[type].safeParse(answers[key])
			if (!result.success) {
				throw result.error
			}
		}

		prev = question

		if (key in answers) continue
		throw new Error(`Expected answer for question "${key}"`)
	}
}

export class PromptError extends Error {}

export class PromptCancelledError extends PromptError {
	constructor() {
		super("Cancelled")
	}
}

export async function createPrompt<T extends PromptObject<string>>(
	prompt: T | T[],
): Promise<UnionToIntersection<TypedAnswers<T>>> {
	const questions = Array.isArray(prompt) ? prompt : [prompt]

	const response = await prompts(questions, {
		onCancel: () => {
			throw new PromptCancelledError()
		},
	})

	assertHasAllAnswers(questions, response)

	return response
}
