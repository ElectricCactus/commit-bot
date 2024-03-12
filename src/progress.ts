import { EOL } from "os"
import ora, { type Ora } from "ora"

type Props = {
  onStart: (ora: Ora) => void
  onSucceed: (ora: Ora) => string | undefined
  onFail: (ora: Ora) => string | undefined
}

export async function spin<T extends (ora: Ora) => unknown>(
  text: string,
  fn: T,
  events?: Partial<Props>,
) {
  const spinner = ora({
    spinner: "dots8Bit",
    text,
  }).start()

  events?.onStart?.(spinner)

  try {
    const result = await fn(spinner)
    spinner.succeed(events?.onSucceed?.(spinner) ?? text)
    return result as ReturnType<T>
  } catch (err) {
    spinner.fail(events?.onFail?.(spinner) ?? text)
    throw err
  }
}
