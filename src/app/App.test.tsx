import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '../i18n';
import { App } from './App';

describe('App', () => {
  it('presents the local project foundation without pretending features are available', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Your projects' })).toBeInTheDocument();
    expect(screen.getByText('Local processing only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New project' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Import project' })).toBeDisabled();
  });
});
