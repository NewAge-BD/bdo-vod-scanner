import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { BdoEvent } from '../../domain/events';
import '../../i18n';
import { scanVideoForSynchronization } from '../../infrastructure/ocr';
import { AutoSyncPanel } from './AutoSyncPanel';

vi.mock('../../infrastructure/ocr', () => ({
  scanVideoForSynchronization: vi.fn(),
}));

const event: BdoEvent = {
  id: 'synthetic-event',
  lineNumber: 1,
  rawLine: '[20:26:19] StoneFamily killed EmberFamily from MoonGuard (EmberWarden, StoneRaven)',
  clockTime: '20:26:19',
  dayOffset: 0,
  sessionTimeSeconds: 73_579,
  verb: 'killed',
  familyA: 'StoneFamily',
  familyB: 'EmberFamily',
  guildB: 'MoonGuard',
  characterA: 'StoneRaven',
  characterB: 'EmberWarden',
};

describe('AutoSyncPanel', () => {
  it('runs a local scan and lets the user preview a suggestion before saving it', async () => {
    const user = userEvent.setup();
    const onUseSuggestion = vi.fn();
    vi.mocked(scanVideoForSynchronization).mockImplementation(({ onProgress }) => {
      onProgress({ completed: 1, phase: 'sampling', total: 2 });
      return Promise.resolve({
        confidence: 0.91,
        event,
        previewDataUrl: 'data:image/jpeg;base64,cHJldmlldw==',
        recognizedLine: '[StoneRaven] killed [EmberWarden]',
        videoTimeSeconds: 42.5,
      });
    });

    render(
      <AutoSyncPanel
        events={[event]}
        file={new File(['video'], 'synthetic.mp4', { type: 'video/mp4' })}
        isSelectingRegion={false}
        onRegionSelectionChange={vi.fn()}
        onUseSuggestion={onUseSuggestion}
        region={{ height: 0.2, width: 0.5, x: 0.05, y: 0.7 }}
        startTimeSeconds={30}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Start Auto Sync' }));
    expect(await screen.findByText('Matching kill event found')).toBeInTheDocument();
    expect(screen.getByText('91% match confidence')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Recognized in-game chat crop' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Preview suggested anchor' }));
    expect(onUseSuggestion).toHaveBeenCalledWith(
      expect.objectContaining({ event, videoTimeSeconds: 42.5 }),
    );
  });
});
