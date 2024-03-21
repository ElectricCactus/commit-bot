#! /usr/bin/env bun

import { EOL } from "os"
import { join } from "path"
import { parseArgs } from "util"
import packageJson from "@/../package.json"
import { changeSizeGenerator } from "@/generator"

async function main() {
  console.log("‼️ Experimental feature")

  const { version } = packageJson
  if (!isVersion(version)) {
    throw new Error("Invalid version")
  }

  const changes = await changeSizeGenerator({ adapter: "claude_fast" })
  const response = await changes.generate()

  const size = response.match(/<answer>(.*)<\/answer>/)?.[1]

  if (!size) {
    throw new Error("Invalid response, missing answer tag")
  }

  const part = parseSemVerPart(size)

  packageJson.version = bumpSemVer(version, part)

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
    console.log("Version change:", version, "->", packageJson.version)
    process.exit()
  }

  await Bun.write(Bun.stdout, `Writing new version to package.json... ${EOL}`)
  await Bun.write(
    join("..", "..", "package.json"),
    JSON.stringify(packageJson, null, 2),
  )

  await Bun.write(Bun.stdout, `Committing new version... ${EOL}`)
  await Bun.$`git add package.json`
  await Bun.$`git commit -m "chore: bump version to ${packageJson.version} ${EOL} ${response}"`
  await Bun.$`git tag -a v${packageJson.version} -m "v${packageJson.version}"`
  await Bun.$`git push --follow-tags`

  await Bun.write(
    Bun.stdout,
    `🎉 Version ${packageJson.version} released! ${EOL}`,
  )

  await Bun.$`echo "RELEASE_VERSION=${packageJson.version}" >> ${process.env.GITHUB_ENV}`
}

if (import.meta.main) {
  main()
} else {
  throw new Error("This script should be run as a main module")
}

// #region SemVer
enum SemVerParts {
  Major = 1,
  Minor = 2,
  Patch = 3,
}

type SemVer = `${number}.${number}.${number}`

function parseSemVerPart(part: string): SemVerParts {
  switch (part) {
    case "major":
      return SemVerParts.Major
    case "minor":
      return SemVerParts.Minor
    case "patch":
      return SemVerParts.Patch
    default:
      throw new Error("Invalid part")
  }
}

function isVersion(version: string): version is SemVer {
  return /^\d+\.\d+\.\d+$/.test(version)
}

function bumpSemVer(version: SemVer, part: SemVerParts): SemVer {
  const [major, minor, patch] = version.split(".").map(Number)

  switch (part) {
    case SemVerParts.Major:
      return `${major + 1}.0.0`
    case SemVerParts.Minor:
      return `${major}.${minor + 1}.0`
    case SemVerParts.Patch:
      return `${major}.${minor}.${patch + 1}`
  }
}

// #endregion SemVer
