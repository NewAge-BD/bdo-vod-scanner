import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../i18n';
import { GuidedTour, GUIDED_TOUR_COMPLETION_KEY } from './GuidedTour';

describe('GuidedTour', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        get length() {
          return values.size;
        },
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      } satisfies Storage,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('opens on the first visit, guides through steps, and remembers dismissal', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <>
        <GuidedTour />
        <div data-guide="project-actions">Project controls</div>
      </>,
    );

    expect(screen.getByRole('region', { name: 'Welcome to BDO VOD Scanner' })).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 24')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('region', { name: 'Start with a project' })).toBeInTheDocument();
    await waitFor(() =>
      expect(document.querySelector('.guided-tour__spotlight')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Close guide' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(GUIDED_TOUR_COMPLETION_KEY)).toBe('complete');

    unmount();
    render(<GuidedTour />);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Guide Me' }));
    expect(screen.getByRole('region', { name: 'Welcome to BDO VOD Scanner' })).toBeInTheDocument();
  });

  it('can be completed with the keyboard', async () => {
    const user = userEvent.setup();
    render(<GuidedTour />);

    for (let index = 0; index < 23; index += 1) {
      await user.click(screen.getByRole('button', { name: 'Next' }));
    }
    await user.click(screen.getByRole('button', { name: 'Finish guide' }));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guide Me' })).toHaveFocus();
  });
});
