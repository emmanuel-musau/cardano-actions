import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

/**
 * Invariants for automated dependency updates. `.github/dependabot.yml` is a
 * file GitHub reads and nothing in this repository executes, so a typo in it
 * fails silently — as no pull requests, or as the wrong ones. These assertions
 * are the only thing standing between a broken key and a quarter of drift.
 *
 * They also pin the two properties issue #11 asked for and that are easy to
 * lose in a later edit: updates arrive grouped and weekly, and nothing merges
 * without a human and green CI.
 */

const root = join(import.meta.dirname, "..")

type Group = {
  patterns?: string[]
  "update-types"?: string[]
}

type Update = {
  "package-ecosystem"?: string
  directory?: string
  directories?: string[]
  schedule?: { interval?: string; day?: string }
  groups?: Record<string, Group>
  "target-branch"?: string
  cooldown?: { "default-days"?: number }
}

const config = parse(readFileSync(join(root, ".github", "dependabot.yml"), "utf8")) as {
  version?: number
  updates?: Update[]
}

const updates = config.updates ?? []
const ecosystemOf = (update: Update) => update["package-ecosystem"]

describe("the dependabot configuration", () => {
  it("is a version 2 config with updates", () => {
    expect(config.version).toBe(2)
    expect(updates.length).toBeGreaterThan(0)
  })

  it("covers npm and GitHub Actions", () => {
    // Actions are the other thing that rots. `release.yml` publishes to npm on
    // a pinned major; an unmaintained action there is a supply-chain problem,
    // not a stale version number.
    expect([...updates.map(ecosystemOf)].sort()).toEqual(["github-actions", "npm"])
  })

  it("updates the whole pnpm workspace from a single root entry", () => {
    // Splitting one pnpm workspace across several `directory` entries produces
    // PRs that edit a package manifest and leave the root `pnpm-lock.yaml`
    // alone (dependabot-core#11135), which then fails `pnpm install
    // --frozen-lockfile` in CI. One entry at the root is the working shape.
    const npm = updates.filter((update) => ecosystemOf(update) === "npm")
    expect(npm).toHaveLength(1)
    expect(npm[0]?.directory).toBe("/")
    expect(npm[0]?.directories).toBeUndefined()
  })

  it("runs weekly, on a named day", () => {
    for (const update of updates) {
      expect(update.schedule?.interval, `${ecosystemOf(update)} schedule`).toBe("weekly")
      // Without `day`, "weekly" is whatever day GitHub picks. A batch that
      // lands on a known morning is a batch that gets reviewed.
      expect(update.schedule?.day, `${ecosystemOf(update)} schedule`).toBeDefined()
    }
  })

  it("groups every in-major update into one pull request per ecosystem", () => {
    for (const update of updates) {
      const groups = Object.values(update.groups ?? {})
      const catchAll = groups.filter((group) => group.patterns?.includes("*"))
      expect(catchAll, `${ecosystemOf(update)} groups`).toHaveLength(1)
      expect([...(catchAll[0]?.["update-types"] ?? [])].sort()).toEqual(["minor", "patch"])
    }
  })

  it("never groups a major", () => {
    // A major that arrives inside a batch of eleven other bumps is a major
    // nobody read the changelog for.
    const grouped = updates.flatMap((update) =>
      Object.values(update.groups ?? {}).flatMap((group) => group["update-types"] ?? [])
    )
    expect(grouped).not.toContain("major")
  })

  it("waits before proposing a fresh npm release", () => {
    // Cooldown is what keeps us from being the first install of a compromised
    // version. Security updates ignore it, which is the intent.
    const npm = updates.find((update) => ecosystemOf(update) === "npm")
    expect(npm?.cooldown?.["default-days"]).toBeGreaterThan(0)
  })

  it("asks for no cooldown on actions, where the key is not supported", () => {
    // GitHub rejects `cooldown` for the github-actions ecosystem, and a
    // rejected key invalidates the entire file rather than the one entry — the
    // npm updates would stop with it, silently. Actions keep GitHub's own
    // three-day default instead.
    const actions = updates.find((update) => ecosystemOf(update) === "github-actions")
    expect(actions?.cooldown).toBeUndefined()
  })

  it("targets the default branch, where the required checks run", () => {
    for (const update of updates) {
      expect(update["target-branch"], `${ecosystemOf(update)} target`).toBeUndefined()
    }
  })
})

describe("nothing merges a dependency update on its own", () => {
  const workflowDir = join(root, ".github", "workflows")
  const workflows = readdirSync(workflowDir)
    .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
    .map((file) => ({ file, text: readFileSync(join(workflowDir, file), "utf8") }))

  it("has workflows to check", () => {
    // Guards the two assertions below from passing over an empty directory.
    expect(workflows.length).toBeGreaterThan(0)
  })

  it("enables auto-merge nowhere", () => {
    // Auto-merge cannot be expressed in dependabot.yml; it takes a workflow
    // calling `gh pr merge --auto` or an action that does. Merging a
    // dependency update is a human decision taken after CI is green — issue
    // #11's second acceptance criterion, kept honest here rather than in a
    // comment.
    const enabling = workflows
      .filter(({ text }) => /--auto\b|enable-pull-request-automerge|automerge/i.test(text))
      .map(({ file }) => file)
    expect(enabling).toEqual([])
  })

  it("puts Dependabot's pull requests through the same checks as everyone's", () => {
    const ci = parse(readFileSync(join(workflowDir, "ci.yml"), "utf8")) as {
      on?: Record<string, unknown>
      jobs?: Record<string, { if?: string }>
    }
    // `pull_request:` with no `branches`/`paths` filter — every PR runs lint,
    // typecheck, test and build, including the ones Dependabot opens.
    expect(ci.on).toHaveProperty("pull_request")
    expect(ci.on?.pull_request ?? null).toBeNull()

    // And the changeset gate is not waived for them: a bump that touches a
    // package still needs a changeset pushed onto the branch before it can
    // merge. CLAUDE.md admits no exception, so neither does this.
    expect(ci.jobs?.changeset?.if ?? "").not.toMatch(/dependabot/i)
  })
})
