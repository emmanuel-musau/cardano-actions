import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Vitest 4 replaced `vitest.workspace.ts` with `test.projects`. Each glob
    // entry is a project root; a package's own vitest.config.ts wins for
    // anything it sets (jsdom for `client`, longer timeouts for `effects`).
    projects: ["packages/*", "apps/*"],

    // Explicit imports from "vitest" rather than globals: the base tsconfig
    // ships `types: []`, and a test file that names what it imports is
    // readable without knowing the runner's ambient magic.
    globals: false,

    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      exclude: ["**/dist/**", "**/test/**", "**/*.config.ts", "**/.tsbuildinfo/**"]
    }
  }
})
