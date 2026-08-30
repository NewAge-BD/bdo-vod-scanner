import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createProjectClip, updateProjectClip } from '../../domain/clips';
import { createProject, portableProjectSchema } from '../../domain/projects';
import '../../i18n';
import { ClipPanel } from './ClipPanel';

describe('ClipPanel', () => {
  it('reorders clips with the drag handle', async () => {
    const project = projectWithTwoClips();
    const [firstId, secondId] = project.clipOrder;
    const onReorderClips = vi.fn().mockResolvedValue(true);
    render(
      <ClipPanel
        onCollapsedChange={vi.fn().mockResolvedValue(true)}
        onDeleteClip={vi.fn().mockResolvedValue(true)}
        onRenameClip={vi.fn().mockResolvedValue(true)}
        onReorderClips={onReorderClips}
        project={project}
      />,
    );

    const dragHandle = screen.getByRole('button', { name: 'Drag First clip to reorder' });
    const secondCard = screen.getByRole('listitem', { name: 'Clip Second clip' });
    const dataTransfer = {
      dropEffect: 'none',
      effectAllowed: 'none',
      setData: vi.fn(),
    };
    fireEvent.dragStart(dragHandle, { dataTransfer });
    fireEvent.dragOver(secondCard, { dataTransfer });
    fireEvent.drop(secondCard, { dataTransfer });

    await waitFor(() => expect(onReorderClips).toHaveBeenCalledWith([secondId, firstId]));
  });
});

function projectWithTwoClips() {
  const base = createProject('Clip order');
  const vodId = crypto.randomUUID();
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
  const first = createProjectClip(withVod, vodId, {
    inPointSeconds: 10,
    outPointSeconds: 20,
    matchingEventIds: [],
  });
  const firstNamed = updateProjectClip(first, first.clipOrder[0]!, { title: 'First clip' });
  const second = createProjectClip(firstNamed, vodId, {
    inPointSeconds: 30,
    outPointSeconds: 40,
    matchingEventIds: [],
  });
  return updateProjectClip(second, second.clipOrder[1]!, { title: 'Second clip' });
}
