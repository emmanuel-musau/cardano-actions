# Changesets

This folder holds unreleased changes. Each file describes one change: which
packages it affects, how far to bump them, and what to tell someone reading the
changelog. `changeset version` consumes them, writes the bumps and the
CHANGELOG entries, and deletes the files.

Add one with `pnpm changeset`. Full docs:
[changesets/changesets](https://github.com/changesets/changesets).

## Why the config looks like this

`config.json` is strict JSON and can't carry comments, so the non-default
choices are explained here.

**`access: "public"`.** Scoped packages default to `restricted` — npm's paid,
access-controlled product. Publishing `@cardano-slips/core` without this
fails with a 402 rather than doing what we meant. Nothing here is worth hiding:
a security model that asks you to verify the derivation yourself cannot ship a
package nobody can read.

**`linked: []` and `fixed: []`.** Packages version independently. A fix in
`verifier` must not force a `flow` release — see
[ARCHITECTURE.md](../docs/ARCHITECTURE.md). Grouping them would put version
numbers on packages whose code did not change, which makes a changelog a worse
record than no changelog.

**`updateInternalDependencies: "patch"`.** When `core` is released, packages
that depend on it have their dependency range bumped in the same release, down
to a patch. Without it, a published `flow` can point at a `core` range that no
longer describes what it was tested against.

**`changedFilePatterns`.** Test-only changes inside a package don't require a
changeset. They change nothing a consumer installs, and demanding a changelog
entry for them teaches people to write empty ones.

**`privatePackages: { version: false, tag: false }`.** `apps/*` and
`examples/*` are deployed or read, never installed. They get no version bump
and no git tag.

**`commit: false`.** The release workflow makes the version commit itself, so
its message follows the repository's commit conventions rather than the
Changesets default.
