import { $, ShellPromise, type Shell } from "bun"
import { spin } from "./progress"

export const shell = (async (...params: Parameters<Shell>) => {
  const [...[strings, ...expr]] = params
  const text = strings.reduce((acc, str, i) => acc + str + (expr[i] ?? ""), "")

  return spin(text, () => $(strings, expr))
}) as Shell

export const shellText = async (...params: Parameters<Shell>) => {
  const [...[strings, ...expr]] = params
  const text = strings.reduce((acc, str, i) => acc + str + (expr[i] ?? ""), "")

  return spin(text, () => $(strings, expr).text())
}
