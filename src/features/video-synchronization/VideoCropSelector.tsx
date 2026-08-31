import { useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';

import type { AutoSyncRegion } from '../../domain/auto-sync';
import type { ViewportPoint } from '../../domain/viewport';

const MINIMUM_REGION_SIZE = 0.03;
const KEYBOARD_STEP = 0.01;

export function VideoCropSelector({
  label,
  onChange,
  pan,
  region,
  videoRef,
  zoom,
}: {
  readonly label: string;
  readonly onChange: (region: AutoSyncRegion) => void;
  readonly pan: ViewportPoint;
  readonly region: AutoSyncRegion | undefined;
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly zoom: number;
}) {
  const [drag, setDrag] = useState<SelectionDrag>();
  const draftRegion = drag?.region ?? region;

  function beginSelection(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    const point = getNormalizedVideoPoint(event, videoRef.current, zoom, pan);
    if (point === undefined) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      region: { ...point, width: 0, height: 0 },
      start: point,
    });
  }

  function updateSelection(event: PointerEvent<HTMLDivElement>) {
    if (drag === undefined || drag.pointerId !== event.pointerId) {
      return;
    }
    const point = getNormalizedVideoPoint(event, videoRef.current, zoom, pan);
    if (point === undefined) {
      return;
    }
    setDrag({ ...drag, region: regionFromPoints(drag.start, point) });
  }

  function finishSelection(event: PointerEvent<HTMLDivElement>) {
    if (drag === undefined || drag.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (drag.region.width >= MINIMUM_REGION_SIZE && drag.region.height >= MINIMUM_REGION_SIZE) {
      onChange(drag.region);
    }
    setDrag(undefined);
  }

  function adjustWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (region === undefined || !event.key.startsWith('Arrow')) {
      return;
    }
    event.preventDefault();
    const horizontal = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    const vertical = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (event.shiftKey) {
      onChange({
        ...region,
        width: clamp(region.width + horizontal * KEYBOARD_STEP, MINIMUM_REGION_SIZE, 1 - region.x),
        height: clamp(region.height + vertical * KEYBOARD_STEP, MINIMUM_REGION_SIZE, 1 - region.y),
      });
      return;
    }
    onChange({
      ...region,
      x: clamp(region.x + horizontal * KEYBOARD_STEP, 0, 1 - region.width),
      y: clamp(region.y + vertical * KEYBOARD_STEP, 0, 1 - region.height),
    });
  }

  return (
    <div
      aria-label={label}
      className="video-crop-selector"
      onKeyDown={adjustWithKeyboard}
      onPointerCancel={finishSelection}
      onPointerDown={beginSelection}
      onPointerMove={updateSelection}
      onPointerUp={finishSelection}
      role="application"
      tabIndex={0}
    >
      <span
        className="video-crop-selector__content"
        style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
      >
        {draftRegion !== undefined && draftRegion.width > 0 && draftRegion.height > 0 && (
          <span
            className="video-crop-selector__selection"
            style={{
              height: `${draftRegion.height * 100}%`,
              left: `${draftRegion.x * 100}%`,
              top: `${draftRegion.y * 100}%`,
              width: `${draftRegion.width * 100}%`,
            }}
          />
        )}
      </span>
    </div>
  );
}

function getNormalizedVideoPoint(
  event: PointerEvent<HTMLDivElement>,
  video: HTMLVideoElement | null,
  zoom: number,
  pan: ViewportPoint,
): NormalizedPoint | undefined {
  if (video === null || video.videoWidth === 0 || video.videoHeight === 0) {
    return undefined;
  }
  const bounds = event.currentTarget.getBoundingClientRect();
  const content = getContainedVideoBounds(
    bounds.width,
    bounds.height,
    video.videoWidth,
    video.videoHeight,
  );
  const pointerX =
    (event.clientX - bounds.left - bounds.width / 2 - pan.x) / zoom + bounds.width / 2;
  const pointerY =
    (event.clientY - bounds.top - bounds.height / 2 - pan.y) / zoom + bounds.height / 2;
  return {
    x: clamp((pointerX - content.x) / content.width, 0, 1),
    y: clamp((pointerY - content.y) / content.height, 0, 1),
  };
}

function getContainedVideoBounds(
  containerWidth: number,
  containerHeight: number,
  videoWidth: number,
  videoHeight: number,
): { readonly height: number; readonly width: number; readonly x: number; readonly y: number } {
  const scale = Math.min(containerWidth / videoWidth, containerHeight / videoHeight);
  const width = videoWidth * scale;
  const height = videoHeight * scale;
  return { height, width, x: (containerWidth - width) / 2, y: (containerHeight - height) / 2 };
}

function regionFromPoints(start: NormalizedPoint, end: NormalizedPoint): AutoSyncRegion {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

interface NormalizedPoint {
  readonly x: number;
  readonly y: number;
}

interface SelectionDrag {
  readonly pointerId: number;
  readonly region: AutoSyncRegion;
  readonly start: NormalizedPoint;
}
