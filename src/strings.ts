export type Expression = string | { toString(): string } | Expression[]

export type TemplateParameters<
  T extends TemplateStringsArray = TemplateStringsArray,
  E extends Expression = Expression,
> = [T, ...E[]]

export function template<T extends TemplateStringsArray, E extends Expression>(
  ...[strings, ...expr]: TemplateParameters<T, E>
): string {
  return strings.reduce((acc, str, i) => acc + str + (expr[i] ?? ""), "")
}
