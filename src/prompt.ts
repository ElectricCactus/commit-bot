import {
	createSelection,
	createPrompt,
	type SelectionItem,
	type SelectionOptions,
	type PromptOptions,
} from "bun-promptx"

type SelectionPromptProps = {
	items: SelectionItem[]
	values: Map<SelectionItem, unknown>
} & SelectionOptions

export function selectionPrompt<T extends SelectionPromptProps>({
	items,
	values,
	...options
}: T) {
	const response = createSelection(items, { ...options })

	assertValidResponse(response)

	const selectedItem = items[response.selectedIndex]

	return values.get(selectedItem)
}

type InputPromptProps = {
	message: string
} & PromptOptions

export function inputPrompt<T extends InputPromptProps>({
	message,
	...options
}: T) {
	const response = createPrompt(message, { ...options })

	assertValidResponse(response)

	return response.value
}

type Response =
	| ReturnType<typeof createPrompt>
	| ReturnType<typeof createSelection>

type DeepNonNullable<T> = {
	[K in keyof T]: NonNullable<T[K]>
}

function assertValidResponse<T extends Response>(
	response: T,
): asserts response is DeepNonNullable<T> {
	if (response.error) {
		throw new Error(response.error)
	}

	if ("value" in response && response.value === null) {
		throw new Error("No value returned")
	}

	if ("selectedIndex" in response && response.selectedIndex === null) {
		throw new Error("No item selected")
	}
}
