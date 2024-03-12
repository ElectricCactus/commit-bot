import { shellText } from "./shell"

export async function getRepoContext() {
  const origin_name =
    await shellText`git remote get-url origin | awk -F'[:/]' '{gsub(/\.git$/, "", $NF); print $(NF-1)"/"$NF}'`

  const folder_name = await shellText`basename $(pwd)`

  const cached_diff = await shellText`git diff --cached`
  const working_diff = await shellText`git diff`

  const tree = await shellText`git ls-tree -r HEAD --name-only`

  const repo = (origin_name !== "" ? origin_name : folder_name).replaceAll(
    /\r?\n|\r/g,
    "",
  )

  const is_cached = cached_diff !== ""
  const diff = is_cached ? cached_diff : working_diff

  return { cached_diff, working_diff, tree, repo, is_cached, diff }
}
