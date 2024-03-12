import { shellText } from "./shell"

export async function getFileTree() {
  return shellText`git ls-tree -r HEAD --name-only`
}

export async function getRepoName() {
  const regex = /\r?\n|\r/g
  const origin_name =
    await shellText`git remote get-url origin | awk -F'[:/]' '{gsub(/\.git$/, "", $NF); print $(NF-1)"/"$NF}'`

  if (origin_name !== "") {
    return origin_name.replaceAll(regex, "")
  }

  const folder_name = await shellText`basename $(pwd)`

  return folder_name.replaceAll(regex, "")
}

export async function getDiff() {
  const working_diff = await shellText`git diff`
  const cached_diff = await shellText`git diff --cached`
  return {
    working_diff,
    cached_diff,
    is_cached: cached_diff !== "",
    diff: cached_diff !== "" ? cached_diff : working_diff,
  }
}
