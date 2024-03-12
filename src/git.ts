import { $ } from "bun"

export async function getRepoContext() {
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
