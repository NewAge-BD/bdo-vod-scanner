import { fireEvent, render, screen } from '@testing-library/react';
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
    Object.assign(timeline, {
      hasPointerCapture: vi.fn(() => true),
      releasePointerCapture: vi.fn(),
      setPointerCapture: vi.fn(),
    });
    const timelineWheel = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 400,
      deltaY: -100,
    });
    fireEvent(timeline, timelineWheel);
    expect(timelineWheel.defaultPrevented).toBe(true);
    expect(screen.getByText('Zoom ×1.3')).toBeInTheDocument();
    const rangeStartBeforePan = playhead.getAttribute('min');
    fireEvent.pointerDown(timeline, { button: 1, clientX: 400, pointerId: 1 });
    fireEvent.pointerMove(timeline, { clientX: 300, pointerId: 1 });
    fireEvent.pointerUp(timeline, { clientX: 300, pointerId: 1 });
    expect(playhead.getAttribute('min')).not.toBe(rangeStartBeforePan);
    fireEvent.doubleClick(timeline);
    expect(screen.getByText('Zoom ×1.0')).toBeInTheDocument();

    fireEvent.change(zoom, { target: { value: '13' } });
    expect(screen.getByText('Zoom ×2.0')).toBeInTheDocument();
    fireEvent.change(playhead, { target: { value: '60' } });
    expect(screen.getByText('00:01:00.000')).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Set synchronization point' }));
    expect(await screen.findByText('Synchronization point saved locally.')).toBeInTheDocument();
    expect(screen.getByText('SYNCED')).toBeInTheDocument();
  });
});
