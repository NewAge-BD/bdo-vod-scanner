import { expect, test } from '@playwright/test';

test('shows the private local project foundation', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('BDO VOD Scanner');
  await expect(page.getByRole('heading', { level: 1, name: 'Your projects' })).toBeVisible();
  await expect(page.getByText('Local processing only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'New project' })).toBeDisabled();
});
