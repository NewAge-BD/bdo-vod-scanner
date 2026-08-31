import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createProject, portableProjectSchema } from '../../domain/projects';
import '../../i18n';
import { SourceOverview } from './SourceOverview';

describe('SourceOverview', () => {
  it('renames only the displayed VOD name through the provided save action', async () => {
    const user = userEvent.setup();
    const onRenameVod = vi.fn().mockResolvedValue(true);
    const project = portableProjectSchema.parse({
      ...createProject('Perspective labels'),
      vods: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          displayName: 'Perspective One',
          fileName: 'Original recording.mp4',
          fileSizeBytes: 12,
          lastModifiedMs: 100,
          durationSeconds: 60,
          width: 1920,
          height: 1080,
          nominalFrameRate: 60,
          variableFrameRate: false,
          videoCodec: null,
          audioCodec: null,
          synchronizationAnchor: null,
          searchTerms: [],
        },
      ],
    });

    render(
      <SourceOverview
        linkedVodIds={new Set()}
        onDeleteVod={vi.fn()}
        onRenameVod={onRenameVod}
        project={project}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Rename Perspective One' }));
    const input = screen.getByRole('textbox', { name: 'VOD display name' });
    await user.clear(input);
    await user.type(input, 'Main shotcaller');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onRenameVod).toHaveBeenCalledWith(project.vods[0]!.id, 'Main shotcaller');
    expect(screen.getByText('Original recording.mp4')).toBeInTheDocument();
  });
});
