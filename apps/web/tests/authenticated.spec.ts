import { test, expect } from '@playwright/test'

/**
 * Authenticated shell tests — run only when `E2E_AUTH_AVAILABLE === '1'`,
 * which `global-setup.ts` sets after successfully provisioning a test user
 * via the Supabase service role key.
 *
 * When the service role key is missing, every test in this file is skipped
 * with a helpful message pointing at `apps/web/tests/README.md`.
 */

const E2E_ENABLED = process.env.E2E_AUTH_AVAILABLE === '1'

test.describe('authenticated shell', () => {
  test.beforeAll(() => {
    test.skip(
      !E2E_ENABLED,
      'SUPABASE_SERVICE_ROLE_KEY not set — see apps/web/tests/README.md to enable authenticated E2E.'
    )
  })

  test('tab navigation switches surfaces', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15_000 })

    // Click the Ledger tab (TabBar renders it as a link with the visible label).
    await page.getByRole('link', { name: /^ledger$/i }).first().click()
    await expect(page).toHaveURL(/\/ledger($|\?)/)
  })

  test('Cmd-K opens the spotlight palette', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15_000 })

    // Send a chord that the SpotlightProvider listens for (meta+K on Mac, ctrl+K elsewhere).
    // Playwright normalizes Meta+K across platforms.
    await page.keyboard.press('Meta+k')

    // SpotlightDialog renders a Radix Dialog with sr-only title "Spotlight".
    const dialog = page.getByRole('dialog', { name: /spotlight/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByPlaceholder(/search or jump/i)).toBeFocused()
  })

  test('spotlight jump navigates to selected surface', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 15_000 })

    await page.keyboard.press('Meta+k')
    const dialog = page.getByRole('dialog', { name: /spotlight/i })
    await expect(dialog).toBeVisible()

    // cmdk renders items as role="option". Pick the "Bills" jump entry.
    await dialog.getByRole('option', { name: /bills/i }).first().click()
    await expect(page).toHaveURL(/\/bills($|\?)/)
    await expect(dialog).toBeHidden()
  })
})
