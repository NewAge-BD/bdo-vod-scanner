import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createProjectClip } from '../../domain/clips';
import { createProject, portableProjectSchema } from '../../domain/projects';
import '../../i18n';
import { DavinciExportPanel } from './DavinciExportPanel';

describe('DavinciExportPanel', () => {
  it('saves selected settings and downloads a timeline', async () => {
    const user = userEvent.setup();
    const onDefaultsChange = vi.fn().mockResolvedValue(true);
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const base = createProject('Resolve UI');
    const vodId = '11111111-1111-4111-8111-111111111111';
    const withVod = portableProjectSchema.parse({
      ...base,
      vods: [
        {
          id: vodId,
          displayName: 'Perspective',
          fileName: 'Perspective.mp4',
          fileSizeBytes: 12,
          lastModifiedMs: 100,
          durationSeconds: 120,
          width: 2560,
          height: 1440,
          nominalFrameRate: 60,
          variableFrameRate: false,
          videoCodec: null,
          audioCodec: null,
          synchronizationAnchor: null,
          searchTerms: [],
          splitSearchTerms: [],
        },
      ],
    });
    const project = createProjectClip(withVod, vodId, {
      inPointSeconds: 10,
      outPointSeconds: 20,
      matchingEventIds: [],
    });
    render(<DavinciExportPanel onDefaultsChange={onDefaultsChange} project={project} />);

    expect(screen.getByText('How to import the timeline')).toBeInTheDocument();
    expect(
      screen.getByText('In DaVinci Resolve, choose File → Import → Timeline.'),
    ).toBeInTheDocument();
    const frameRate = screen.getByLabelText('Timeline frame rate');
    await user.clear(frameRate);
    await user.type(frameRate, '59.94');
    await user.click(screen.getByRole('button', { name: 'Export to DaVinci Resolve' }));

    await waitFor(() =>
      expect(onDefaultsChange).toHaveBeenCalledWith({
        frameRate: 59.94,
        width: 1920,
        height: 1080,
      }),
    );
    expect(click).toHaveBeenCalledOnce();
    click.mockRestore();
  });
});
