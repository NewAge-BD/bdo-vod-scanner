import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import '../i18n';
import type { VideoMetadataInspector } from '../infrastructure/media';
import { InMemoryProjectRepository } from '../infrastructure/projects';
import syntheticLog from '../test/fixtures/2026-08-29.log?raw';
import { App } from './App';

const metadataInspector: VideoMetadataInspector = {
  inspect: () =>
    Promise.resolve({
      durationSeconds: 3_600,
      width: 1920,
      height: 1080,
      nominalFrameRate: null,
      variableFrameRate: null,
      videoCodec: null,
      audioCodec: null,
    }),
};

describe('App', () => {
  it('loads an empty local project overview with functional actions', async () => {
    render(
      <App metadataInspector={metadataInspector} repository={new InMemoryProjectRepository()} />,
    );

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
    expect(screen.getByRole('button', { name: 'Choose log and MP4 files' })).toBeInTheDocument();
  });

  it('imports a validated log and MP4 into the local project', async () => {
    const user = userEvent.setup();
    render(
      <App metadataInspector={metadataInspector} repository={new InMemoryProjectRepository()} />,
    );

    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name'), 'Source import');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    const log = new File([syntheticLog], '2026-08-29.log', { type: 'text/plain' });
    const video = new File(
      [new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109])],
      'Synthetic Perspective.mp4',
      { type: 'video/mp4', lastModified: 100 },
    );
    await user.upload(screen.getByLabelText('Local log and MP4 files'), [log, video]);

    expect(await screen.findByRole('heading', { name: 'Imported sources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2026-08-29.log' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Synthetic Perspective' })).toBeInTheDocument();
    expect(screen.getByText('Linked for this session')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Synchronize VODs' })).toBeInTheDocument();

    fireEvent.loadedMetadata(screen.getByLabelText('Synthetic Perspective video perspective'));
    expect(screen.getByLabelText('Shared log event timeline')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 log events around video time/ })).toBeVisible();
    const videoViewport = screen.getByLabelText('Zoomable video viewport');
    vi.spyOn(videoViewport, 'getBoundingClientRect').mockReturnValue({
      bottom: 450,
      height: 450,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    const videoWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 400,
      clientY: 225,
      deltaY: -100,
    });
    fireEvent(videoViewport, videoWheel);
    expect(videoWheel.defaultPrevented).toBe(true);
    expect(screen.getByText('Video ×1.2')).toBeInTheDocument();
    fireEvent.doubleClick(videoViewport);
    expect(screen.getByText('Video ×1.0')).toBeInTheDocument();

    const playhead = screen.getByLabelText('Video timeline playhead');
    const zoom = screen.getByLabelText('Timeline zoom level');
    expect(playhead).toHaveAttribute('max', '3600');
    expect(zoom).toHaveValue('1');

    const timeline = screen.getByLabelText('Video timeline controls');
    vi.spyOn(timeline, 'getBoundingClientRect').mockReturnValue({
      bottom: 200,
      height: 200,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => undefined,
    });
    const timelineScale = playhead.parentElement;
    expect(timelineScale).not.toBeNull();
    vi.spyOn(timelineScale!, 'getBoundingClientRect').mockReturnValue({
      bottom: 160,
      height: 40,
      left: 0,
      right: 800,
      top: 120,
      width: 800,
      x: 0,
      y: 120,
      toJSON: () => undefined,
    });
    Object.assign(timeline, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });
    const timelineWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 600,
      deltaY: -100,
    });
    fireEvent(timeline, timelineWheel);
    expect(timelineWheel.defaultPrevented).toBe(true);
    expect(screen.getByText('Zoom ×1.3')).toBeInTheDocument();
    const zoomedStart = Number(playhead.getAttribute('min'));
    const zoomedEnd = Number(playhead.getAttribute('max'));
    expect(zoomedStart + (zoomedEnd - zoomedStart) * 0.75).toBeCloseTo(2_700, 6);
    const rangeStartBeforePan = playhead.getAttribute('min');
    fireEvent.pointerDown(timeline, { button: 1, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(timeline, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(timeline, { clientX: 300, pointerId: 1 });
    expect(playhead.getAttribute('min')).not.toBe(rangeStartBeforePan);
    fireEvent.doubleClick(timeline);
    expect(screen.getByText('Zoom ×1.0')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /3 log events around video time/ }));
    expect(screen.getByText('Zoom ×2.0')).toBeInTheDocument();
    fireEvent.doubleClick(timeline);

    fireEvent.change(zoom, { target: { value: '49' } });
    await user.click(
      screen.getByRole('button', { name: '00:00:03: CopperGrove killed MistRunner' }),
    );
    expect(
      screen.getByText(
        '[00:00:03] CopperGrove killed MistRunner from StarFoundry (CloudStep, BronzeLeaf)',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('00:00:05.000')).toBeInTheDocument();
    fireEvent.doubleClick(timeline);

    fireEvent.change(zoom, { target: { value: '13' } });
    expect(screen.getByText('Zoom ×2.0')).toBeInTheDocument();
    fireEvent.change(playhead, { target: { value: '60' } });
    expect(screen.getByText('00:01:00.000')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Set synchronization point' }));
    expect(await screen.findByText('Synchronization point saved locally.')).toBeInTheDocument();
    expect(screen.getByText('SYNCED')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Find a family, character, or guild name');
    await user.type(searchInput, 'EmberVale');
    await user.click(screen.getByRole('button', { name: 'Add name' }));
    expect(await screen.findByText('1 matching event')).toBeInTheDocument();
    expect(screen.getByText('EmberVale')).toBeInTheDocument();

    await user.type(searchInput, 'RiverWarden{Enter}');
    expect(await screen.findByText('2 matching events')).toBeInTheDocument();
    expect(screen.getByText('RiverWarden')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous matching event' }));
    expect(
      screen.getByText(
        '[23:59:58] FrostCairn died to RiverWarden from DawnKeep (TideCaller, IcePetal)',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('00:00:55.000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove EmberVale' }));
    expect(await screen.findByText('1 matching event')).toBeInTheDocument();
    expect(screen.queryByText('EmberVale')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start Clipping' }));
    expect(screen.getByRole('heading', { name: 'Clipping workspace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to synchronization' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All projects' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Imported sources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Source import' })).not.toBeInTheDocument();
    const clippingTimeline = screen.getByLabelText('Full-width clipping timeline');
    const clippingPlayhead = screen.getByLabelText('Video timeline playhead');
    expect(within(clippingTimeline).getByText('Kills')).toBeInTheDocument();
    expect(within(clippingTimeline).getByText('Deaths')).toBeInTheDocument();
    expect(within(clippingTimeline).getByText('Selected names')).toBeInTheDocument();
    const clippingNameInput = within(clippingTimeline).getByLabelText('Selected names');
    expect(
      within(clippingTimeline).queryByRole('button', { name: 'Remove RiverWarden timeline' }),
    ).not.toBeInTheDocument();
    await user.type(clippingNameInput, 'RiverWarden{Enter}');
    expect(
      await within(clippingTimeline).findByRole('button', {
        name: 'Remove RiverWarden timeline',
      }),
    ).toBeInTheDocument();
    const splitRiverWarden = within(clippingTimeline).getByRole('button', {
      name: 'Split RiverWarden timeline into kill and death timelines',
    });
    expect(splitRiverWarden).toHaveAttribute(
      'title',
      'Splits timeline in 2 separate kill and death timelines',
    );
    await user.click(splitRiverWarden);
    expect(within(clippingTimeline).getByText('RiverWarden · Kills')).toBeInTheDocument();
    expect(within(clippingTimeline).getByText('RiverWarden · Deaths')).toBeInTheDocument();
    const mergeRiverWarden = within(clippingTimeline).getByRole('button', {
      name: 'Merge RiverWarden kill and death timelines',
    });
    expect(mergeRiverWarden).toHaveAttribute('aria-pressed', 'true');
    await user.click(mergeRiverWarden);
    expect(within(clippingTimeline).queryByText('RiverWarden · Kills')).not.toBeInTheDocument();
    expect(within(clippingTimeline).queryByText('RiverWarden · Deaths')).not.toBeInTheDocument();
    await user.type(clippingNameInput, 'CopperGrove{Enter}');
    expect(
      await within(clippingTimeline).findByRole('button', {
        name: 'Remove CopperGrove timeline',
      }),
    ).toBeInTheDocument();
    expect(within(clippingTimeline).queryByText('Synthetic Perspective')).not.toBeInTheDocument();
    await user.click(
      within(clippingTimeline).getByRole('button', { name: 'Remove CopperGrove timeline' }),
    );
    expect(
      within(clippingTimeline).queryByRole('button', { name: 'Remove CopperGrove timeline' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Set in (I)' }));
    fireEvent.change(clippingPlayhead, { target: { value: '65' } });
    await user.click(screen.getByRole('button', { name: 'Set out (O)' }));
    const inHandle = screen.getByLabelText('Clip in-point handle');
    const outHandle = screen.getByLabelText('Clip out-point handle');
    expect(inHandle).toHaveAttribute('min', clippingPlayhead.getAttribute('min'));
    expect(inHandle).toHaveAttribute('max', clippingPlayhead.getAttribute('max'));
    expect(outHandle).toHaveAttribute('min', clippingPlayhead.getAttribute('min'));
    expect(outHandle).toHaveAttribute('max', clippingPlayhead.getAttribute('max'));
    fireEvent.change(outHandle, { target: { value: '70' } });
    await user.click(screen.getByRole('button', { name: 'Add clip' }));

    expect(await screen.findByText('Clip saved locally.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Marked clips' })).toBeInTheDocument();
    expect(screen.getByText('1 clip')).toBeInTheDocument();
    expect(screen.getByDisplayValue('RiverWarden')).toBeInTheDocument();
    expect(screen.getByText('00:00:55.000 – 00:01:10.000')).toBeInTheDocument();
    expect(screen.getByText('15.000 s')).toBeInTheDocument();

    const clipTitle = screen.getByLabelText('Clip title');
    await user.clear(clipTitle);
    await user.type(clipTitle, 'Opening pick{Enter}');
    expect(await screen.findByDisplayValue('Opening pick')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(screen.queryByLabelText('Clip title')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand' }));
    expect(await screen.findByDisplayValue('Opening pick')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to synchronization' }));
    expect(screen.getByRole('button', { name: 'All projects' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Imported sources' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Source import' })).toBeInTheDocument();

    const confirmDeletion = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const deleteVodButtons = screen.getAllByRole('button', {
      name: 'Delete Synthetic Perspective',
    });
    expect(deleteVodButtons).toHaveLength(2);
    await user.click(deleteVodButtons[0]!);
    expect(confirmDeletion).toHaveBeenCalledWith(expect.stringContaining('1 marked clip'));
    expect(screen.getByRole('heading', { name: 'Synthetic Perspective' })).toBeInTheDocument();

    confirmDeletion.mockReturnValueOnce(true);
    await user.click(deleteVodButtons[1]!);
    expect(
      screen.queryByRole('heading', { name: 'Synthetic Perspective' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Marked clips' })).not.toBeInTheDocument();
    confirmDeletion.mockRestore();
  }, 10_000);

  it('coordinates, promotes, hides, and restores synchronized perspectives', async () => {
    const user = userEvent.setup();
    render(
      <App metadataInspector={metadataInspector} repository={new InMemoryProjectRepository()} />,
    );

    await user.click(await screen.findByRole('button', { name: 'New project' }));
    await user.type(screen.getByLabelText('Project name'), 'Multiple perspectives');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    const log = new File([syntheticLog], '2026-08-29.log', { type: 'text/plain' });
    const mp4Signature = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109]);
    const perspectiveA = new File([mp4Signature], 'Perspective A.mp4', {
      type: 'video/mp4',
      lastModified: 100,
    });
    const perspectiveB = new File([mp4Signature], 'Perspective B.mp4', {
      type: 'video/mp4',
      lastModified: 200,
    });
    await user.upload(screen.getByLabelText('Local log and MP4 files'), [
      log,
      perspectiveA,
      perspectiveB,
    ]);

    fireEvent.loadedMetadata(await screen.findByLabelText('Perspective A video perspective'));
    await user.click(screen.getByRole('button', { name: 'Set synchronization point' }));
    await screen.findByText('Synchronization point saved locally.');

    await user.click(screen.getByRole('button', { name: 'Start Clipping' }));
    const clippingTimeline = screen.getByLabelText('Full-width clipping timeline');
    expect(within(clippingTimeline).getByText('Kills')).toBeInTheDocument();
    expect(within(clippingTimeline).getByText('Deaths')).toBeInTheDocument();
    expect(within(clippingTimeline).queryByText('Perspective A')).not.toBeInTheDocument();
    expect(within(clippingTimeline).queryByText('Perspective B')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to synchronization' }));

    await user.click(screen.getByRole('button', { name: 'Perspective B, Sync required' }));
    expect(screen.getByRole('button', { name: 'Perspective B, Sync required' })).toHaveClass(
      'perspective-tab--sync-required',
      'perspective-tab--active',
    );
    expect(screen.getByRole('button', { name: 'Perspective A, Synchronized' })).toHaveClass(
      'perspective-tab--synchronized',
    );
    fireEvent.loadedMetadata(screen.getByLabelText('Perspective B video perspective'));
    await user.click(screen.getByRole('button', { name: 'Set synchronization point' }));
    await screen.findByText('Synchronization point saved locally.');
    expect(screen.getByRole('button', { name: 'Perspective B, Synchronized' })).toHaveClass(
      'perspective-tab--synchronized',
      'perspective-tab--active',
    );
    await user.type(
      screen.getByLabelText('Find a family, character, or guild name'),
      'FrostCairn{Enter}',
    );
    expect(await screen.findByText('FrostCairn')).toBeInTheDocument();

    expect(
      await screen.findByLabelText('Perspective A synchronized muted mini player'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Video timeline playhead'), {
      target: { value: '60' },
    });
    await user.click(
      screen.getByRole('button', { name: 'Make Perspective A the main perspective' }),
    );

    expect(screen.getByLabelText('Perspective A video perspective')).toBeInTheDocument();
    expect(screen.queryByText('FrostCairn')).not.toBeInTheDocument();
    expect(screen.getByText('00:01:00.000')).toBeInTheDocument();
    expect(
      await screen.findByLabelText('Perspective B synchronized muted mini player'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide Perspective B mini player' }));
    expect(
      screen.queryByLabelText('Perspective B synchronized muted mini player'),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Show mini' }));
    expect(
      await screen.findByLabelText('Perspective B synchronized muted mini player'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Perspective B, Synchronized' }));
    expect(await screen.findByText('FrostCairn')).toBeInTheDocument();
  });
});
