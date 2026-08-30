import { expect, test } from '@playwright/test';

test('manages a portable private local project', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('BDO VOD Scanner');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/website-symbol.png');
  await expect(page.getByRole('heading', { level: 1, name: 'Your projects' })).toBeVisible();
  await expect(page.getByText('Local processing only')).toBeVisible();

  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByLabel('Project name').fill('Saturday Node War');
  await page.getByRole('button', { name: 'Create project' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Saturday Node War' })).toBeVisible();
  await page.getByRole('button', { name: 'All projects' }).click();
  await expect(page.getByRole('button', { name: /Saturday Node War/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: /Saturday Node War/ })).toBeVisible();

  const projectCard = page.getByRole('article');
  await projectCard.getByRole('button', { name: 'Rename' }).click();
  await page.getByLabel('Project name').fill('Sunday Node War');
  await page.getByRole('button', { name: 'Save name' }).click();
  await expect(projectCard.getByRole('button', { name: /Sunday Node War/ })).toBeVisible();

  const downloadStarted = page.waitForEvent('download');
  await projectCard.getByRole('button', { name: 'Export' }).click();
  const download = await downloadStarted;
  expect(download.suggestedFilename()).toBe('Sunday Node War.bdo-vod-project.json');
  const exportedProjectPath = await download.path();
  expect(exportedProjectPath).not.toBeNull();

  page.once('dialog', (dialog) => void dialog.accept());
  await projectCard.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('heading', { name: 'No projects yet' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles(exportedProjectPath);
  await expect(page.getByRole('heading', { level: 1, name: 'Sunday Node War' })).toBeVisible();
  await page.getByRole('button', { name: 'All projects' }).click();
  await expect(page.getByRole('button', { name: /Sunday Node War/ })).toBeVisible();

  await page.getByRole('button', { name: /Sunday Node War/ }).click();
  await page.getByLabel('Local log and MP4 files').setInputFiles([
    {
      name: '2026-08-29.log',
      mimeType: 'text/plain',
      buffer: Buffer.from(
        '[20:00:56] FrostCairn died to RiverWarden from DawnKeep (TideCaller, IcePetal)',
      ),
    },
    {
      name: 'Synthetic Perspective.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]),
    },
  ]);

  await expect(page.getByRole('heading', { name: 'Imported sources' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2026-08-29.log' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic Perspective' })).toBeVisible();
  await expect(page.getByText('Linked for this session')).toBeVisible();
  await expect(page.getByText('SYNC REQUIRED', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synchronize VODs' })).toBeVisible();
  await expect(
    page.getByText(
      '[20:00:56] FrostCairn died to RiverWarden from DawnKeep (TideCaller, IcePetal)',
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set synchronization point' })).toBeDisabled();

  await page.reload();
  await page.getByRole('button', { name: /Sunday Node War/ }).click();
  await expect(page.getByText('Reselect required')).toBeVisible();
  await expect(page.getByText('This VOD is not linked for the current session')).toBeVisible();
});
