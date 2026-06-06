/**
 * Vitest workspace root.
 *
 * Without this, running `vitest run apps/web/path/to/test.ts` from the repo
 * root would fail because vitest searches upward from the cwd for a
 * vitest.config and never finds the one at apps/web/vitest.config.ts. The
 * symptom was a "Failed to load url @/lib/x" error on any test importing
 * a module that uses the `@/...` path alias — vitest didn't know about
 * the alias because it was using zero config.
 *
 * Declaring apps/web as a workspace project here tells vitest to load
 * that subdirectory's config, so the alias, jsdom env, and setup file
 * all resolve correctly regardless of where vitest is invoked from.
 */
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'apps/web/vitest.config.ts'
])
