import { test, expect } from '@playwright/test'

test('design-system page renders the masthead', async ({ page }) => {
  await page.goto('/design-system')
  // The Masthead's volume string is part of the showcase.
  // Use .first() because the text may appear in multiple components on the showcase page.
  await expect(page.getByText(/VOL\. III · BRIEFING/i).first()).toBeVisible()
})

test('design-system page renders headline primitive', async ({ page }) => {
  await page.goto('/design-system')
  await expect(
    page.getByRole('heading', { name: /Net worth, up 2\.4% this month\./i })
  ).toBeVisible()
})
