#! /usr/bin/env bun

import { EOL } from "os"
import { join } from "path"
import { $ } from "bun"
import { parseArgs } from "util"
import packageJson from "@/../package.json"
import { changeSizeGenerator } from "@/generator"

async function main() {
  if (!import.meta.main) {
    throw new Error("This script should be run as a main module")
  }

  await Bun.write(Bun.stdout, `‼️ Experimental feature ${EOL}`)

  const { version } = packageJson
  if (!isVersion(version)) {
    throw new Error("Invalid version")
  }

  await Bun.write(Bun.stdout, `Current version: ${version}${EOL}`)

  const changes = await changeSizeGenerator({ adapter: "claude_fast" })
  const response = await changes.generate()

  const size = response.match(/<answer>(.*)<\/answer>/)?.[1]

  if (!size) {
    throw new Error("Invalid response, missing answer tag")
  }

  packageJson.version = bumpSemVer(version, size)

  const { values } = parseArgs({
    options: {
      dry: {
        type: "boolean",
        short: "d",
      },
    },
    args: Bun.argv,
    strict: true,
    allowPositionals: true,
  })

  if (values.dry) {
    await Bun.write(
      Bun.stdout,
      `Version change: ${version} -> ${packageJson.version}${EOL}`,
    )
    process.exit(0)
  }

  await Bun.write(Bun.stdout, `Writing new version to package.json...${EOL}`)
  await Bun.write(
    join(import.meta.dir, "..", "..", "package.json"),
    JSON.stringify(packageJson, null, 2),
  )

  await Bun.write(Bun.stdout, `Committing new version...${EOL}`)
  await $`git add package.json`
  await $`git commit -m "chore: bump version to ${packageJson.version} ${EOL} ${response}"`
  await $`git tag -a v${packageJson.version} -m "v${packageJson.version}"`
  await $`git push --follow-tags`

  await Bun.write(
    Bun.stdout,
    `🎉 Version ${packageJson.version} released! ${EOL}`,
  )
  await $`echo "RELEASE_VERSION=${packageJson.version}" >> ${process.env.GITHUB_ENV}`
}

// #region SemVer

type SemVer = `${number}.${number}.${number}`

function isVersion(version: string): version is SemVer {
  return /^\d+\.\d+\.\d+$/.test(version)
}

function bumpSemVer(version: SemVer, part: string): SemVer {
  const [major, minor, patch] = version.split(".").map(Number)

  switch (part.toLowerCase()) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Invalid sem ver part ${part}`)
  }
}

// #endregion SemVer

await main().catch((err) => {
  console.error("🚨", err)
  throw err
})
