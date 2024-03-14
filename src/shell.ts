import { $, type Shell, type ShellExpression } from "bun"
import { spin } from "./progress"
import { template } from "./strings"

export const shell = (async (...params: Parameters<Shell>) => {
  const [strings, ...expr] = params
  const text = template(
    strings,
    ...expr.filter((e): e is NonNullable<ShellExpression> => e != null),
  )

  return spin(text, () => $(...params))
}) as Shell

export const shellText = async (...params: Parameters<Shell>) => {
  const [...[strings, ...expr]] = params
  const text = strings.reduce((acc, str, i) => acc + str + (expr[i] ?? ""), "")

  return spin(text, () => $(strings, expr).text())
}
