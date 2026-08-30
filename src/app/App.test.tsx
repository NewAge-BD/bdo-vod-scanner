import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import '../i18n';
import { InMemoryProjectRepository } from '../infrastructure/projects';
import { App } from './App';

describe('App', () => {
  it('loads an empty local project overview with functional actions', async () => {
    render(<App repository={new InMemoryProjectRepository()} />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Your projects' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Local processing only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New project' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Import project' })).toBeEnabled();
  });

  it('creates a named project and opens its local workspace', async () => {
    const user = userEvent.setup();
    render(<App repository={new InMemoryProjectRepository()} />);

    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name'), 'Saturday Node War');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Saturday Node War' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('This project is saved locally.', { exact: false }),
    ).toBeInTheDocument();
  });
});
