import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { parseBdoLog, searchEvents, type BdoEvent } from '../../domain/events';
import type { PortableProject, VodReference } from '../../domain/projects';
import type { SynchronizationAnchorInput } from '../../domain/synchronization';
import { calculateTimelineWindow, zoomLevelToFactor } from '../../domain/timeline';
import { useObjectUrl } from './useObjectUrl';

const MAX_VISIBLE_EVENTS = 50;

interface VideoSynchronizationProps {
  readonly project: PortableProject;
  readonly vodFiles: ReadonlyMap<string, File>;
  readonly onSynchronize: (vodId: string, anchor: SynchronizationAnchorInput) => Promise<boolean>;
}

export function VideoSynchronization({
  project,
  vodFiles,
  onSynchronize,
}: VideoSynchronizationProps) {
  const { t } = useTranslation();
  const parsedLog = useMemo(() => {
    if (project.rawLog === null || project.sessionDate === null) {
      return undefined;
    }
    return parseBdoLog(`${project.sessionDate}.log`, project.rawLog);
  }, [project.rawLog, project.sessionDate]);
  const [activeVodId, setActiveVodId] = useState(project.vods[0]?.id);
  const activeVod = project.vods.find((vod) => vod.id === activeVodId) ?? project.vods[0];
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [query, setQuery] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoTime, setVideoTime] = useState(0);

  if (parsedLog === undefined || project.vods.length === 0) {
    return null;
  }

  const file = activeVod === undefined ? undefined : vodFiles.get(activeVod.id);
  const firstEventId = parsedLog.events[0]?.id;
  const defaultEventId = activeVod?.synchronizationAnchor?.eventId ?? firstEventId;
  const selectedEvent =
    parsedLog.events.find((event) => event.id === (selectedEventId ?? defaultEventId)) ??
    parsedLog.events[0];
  const matchingEvents = (
    query.trim().length === 0 ? parsedLog.events : searchEvents(parsedLog.events, [query])
  ).slice(0, MAX_VISIBLE_EVENTS);
  const estimatedFrameRate = activeVod?.nominalFrameRate ?? 60;

  function selectPerspective(vodId: string) {
    const vod = project.vods.find((candidate) => candidate.id === vodId);
    setActiveVodId(vodId);
    setSelectedEventId(vod?.synchronizationAnchor?.eventId ?? firstEventId);
    setQuery('');
    setSaveState('idle');
    setIsVideoReady(false);
    setVideoTime(vod?.synchronizationAnchor?.videoTimeSeconds ?? 0);
  }

  async function saveSynchronization() {
    if (activeVod === undefined || selectedEvent === undefined) {
      return;
    }

    setSaveState('saving');
    const saved = await onSynchronize(activeVod.id, {
      eventId: selectedEvent.id,
      eventSessionTimeSeconds: selectedEvent.sessionTimeSeconds,
      videoTimeSeconds: videoTime,
    });
    setSaveState(saved ? 'saved' : 'error');
  }

  return (
    <section className="video-sync" aria-labelledby="video-sync-title">
      <div className="video-sync__heading">
        <div>
          <p className="section-kicker">{t('synchronization.kicker')}</p>
          <h2 id="video-sync-title">{t('synchronization.title')}</h2>
        </div>
        <p>{t('synchronization.description')}</p>
      </div>

      <div className="perspective-tabs" role="group" aria-label={t('synchronization.perspectives')}>
        {project.vods.map((vod) => (
          <button
            aria-pressed={vod.id === activeVod?.id}
            className={
              vod.id === activeVod?.id
                ? 'perspective-tab perspective-tab--active'
                : 'perspective-tab'
            }
            key={vod.id}
            onClick={() => selectPerspective(vod.id)}
            type="button"
          >
            <span>{vod.displayName}</span>
            <small>
              {vod.synchronizationAnchor === null
                ? t('synchronization.notSynchronized')
                : t('synchronization.synchronized')}
            </small>
          </button>
        ))}
      </div>

      <div className="video-sync__workspace">
        <div className="video-sync__player-column">
          {file === undefined || activeVod === undefined ? (
            <div className="video-unavailable">
              <strong>{t('synchronization.reselectTitle')}</strong>
              <p>{t('synchronization.reselectDescription')}</p>
            </div>
          ) : (
            <SynchronizedVideoPlayer
              estimatedFrameRate={estimatedFrameRate}
              file={file}
              initialTime={activeVod.synchronizationAnchor?.videoTimeSeconds ?? 0}
              key={`${activeVod.id}-${file.name}-${file.lastModified}-${file.size}`}
              onReady={setIsVideoReady}
              onTimeChange={setVideoTime}
              vod={activeVod}
            />
          )}
        </div>

        <div className="sync-event-panel">
          <p className="sync-event-panel__label">{t('synchronization.selectedEvent')}</p>
          {selectedEvent !== undefined && (
            <div className={`selected-event selected-event--${selectedEvent.verb}`}>
              <time>{selectedEvent.clockTime}</time>
              <p>{selectedEvent.rawLine}</p>
            </div>
          )}

          <label htmlFor="sync-event-search">{t('synchronization.findEvent')}</label>
          <input
            id="sync-event-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('synchronization.searchPlaceholder')}
            type="search"
            value={query}
          />
          <div
            className="sync-event-list"
            role="list"
            aria-label={t('synchronization.eventResults')}
          >
            {matchingEvents.map((event) => (
              <div key={event.id} role="listitem">
                <button
                  aria-pressed={event.id === selectedEvent?.id}
                  onClick={() => setSelectedEventId(event.id)}
                  type="button"
                >
                  <time>{event.clockTime}</time>
                  <span>{describeEvent(event)}</span>
                </button>
              </div>
            ))}
          </div>

          <button
            className="button button--primary sync-confirm"
            disabled={!isVideoReady || selectedEvent === undefined || saveState === 'saving'}
            onClick={() => void saveSynchronization()}
            type="button"
          >
            {saveState === 'saving'
              ? t('synchronization.saving')
              : activeVod?.synchronizationAnchor === null
                ? t('synchronization.confirm')
                : t('synchronization.update')}
          </button>
          {saveState === 'saved' && <p className="sync-save-state">{t('synchronization.saved')}</p>}
          {saveState === 'error' && (
            <p className="sync-save-state sync-save-state--error">
              {t('synchronization.saveError')}
            </p>
          )}
          {activeVod?.synchronizationAnchor !== null &&
            activeVod?.synchronizationAnchor !== undefined && (
              <p className="sync-offset">
                {t('synchronization.offset', {
                  offset: formatSignedTime(activeVod.synchronizationAnchor.offsetSeconds),
                })}
              </p>
            )}
        </div>
      </div>
    </section>
  );
}

function SynchronizedVideoPlayer({
  file,
  vod,
  initialTime,
  estimatedFrameRate,
  onReady,
  onTimeChange,
}: {
  readonly file: File;
  readonly vod: VodReference;
  readonly initialTime: number;
  readonly estimatedFrameRate: number;
  readonly onReady: (ready: boolean) => void;
  readonly onTimeChange: (time: number) => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [displayTime, setDisplayTime] = useState(initialTime);
  const [mediaDuration, setMediaDuration] = useState(vod.durationSeconds ?? 0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [timelineCenter, setTimelineCenter] = useState(initialTime);
  const objectUrl = useObjectUrl(file);
  const zoomFactor = zoomLevelToFactor(zoomLevel);
  const timelineWindow = calculateTimelineWindow(mediaDuration, timelineCenter, zoomFactor);
  const frameDuration = 1 / estimatedFrameRate;

  function updateTime(time: number, followPlayhead = false) {
    setDisplayTime(time);
    onTimeChange(time);
    if (
      followPlayhead &&
      (time < timelineWindow.startSeconds || time > timelineWindow.endSeconds)
    ) {
      setTimelineCenter(time);
    }
  }

  function seekTo(time: number) {
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    const safeTime = Math.min(mediaDuration, Math.max(0, time));
    video.pause();
    video.currentTime = safeTime;
    updateTime(safeTime);
  }

  function stepFrame(direction: -1 | 1) {
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    video.pause();
    const maximum = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
    video.currentTime = Math.min(
      maximum,
      Math.max(0, video.currentTime + direction / estimatedFrameRate),
    );
    updateTime(video.currentTime, true);
  }

  function changeZoom(nextLevel: number) {
    setTimelineCenter(displayTime);
    setZoomLevel(Math.min(120, Math.max(1, nextLevel)));
  }

  function panTimeline(direction: -1 | 1) {
    const targetTime = Math.min(
      mediaDuration,
      Math.max(0, displayTime + timelineWindow.durationSeconds * 0.8 * direction),
    );
    setTimelineCenter(targetTime);
    seekTo(targetTime);
  }

  return (
    <>
      <video
        aria-label={t('synchronization.videoLabel', { name: vod.displayName })}
        controls
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            stepFrame(event.key === 'ArrowLeft' ? -1 : 1);
          }
        }}
        onError={() => onReady(false)}
        onLoadedMetadata={(event) => {
          const duration = Number.isFinite(event.currentTarget.duration)
            ? event.currentTarget.duration
            : (vod.durationSeconds ?? Math.max(initialTime, 0));
          const safeInitialTime = Math.min(initialTime, duration);
          setMediaDuration(duration);
          setTimelineCenter(safeInitialTime);
          event.currentTarget.currentTime = safeInitialTime;
          updateTime(safeInitialTime);
          onReady(true);
        }}
        onPause={(event) => updateTime(event.currentTarget.currentTime, true)}
        onTimeUpdate={(event) => updateTime(event.currentTarget.currentTime, true)}
        ref={videoRef}
        src={objectUrl}
      />
      <div className="video-timeline" aria-label={t('synchronization.timelineControls')}>
        <div className="video-timeline__transport">
          <button onClick={() => stepFrame(-1)} type="button">
            {t('synchronization.previousFrame')}
          </button>
          <output aria-live="off">{formatTime(displayTime)}</output>
          <button onClick={() => stepFrame(1)} type="button">
            {t('synchronization.nextFrame')}
          </button>
          <span>{t('synchronization.estimatedFps', { fps: estimatedFrameRate })}</span>
        </div>

        <div className="video-timeline__ruler" aria-hidden="true">
          <time>{formatTime(timelineWindow.startSeconds)}</time>
          <span>{t('synchronization.visibleRange')}</span>
          <time>{formatTime(timelineWindow.endSeconds)}</time>
        </div>
        <div className="video-timeline__scrubber">
          <input
            aria-label={t('synchronization.videoTimeline')}
            max={timelineWindow.endSeconds}
            min={timelineWindow.startSeconds}
            onChange={(event) => seekTo(Number(event.target.value))}
            onPointerDown={() => videoRef.current?.pause()}
            step={frameDuration}
            type="range"
            value={Math.min(
              timelineWindow.endSeconds,
              Math.max(timelineWindow.startSeconds, displayTime),
            )}
          />
        </div>

        <div className="video-timeline__zoom">
          <button disabled={zoomLevel === 1} onClick={() => panTimeline(-1)} type="button">
            {t('synchronization.panEarlier')}
          </button>
          <button
            disabled={zoomLevel === 1}
            onClick={() => changeZoom(zoomLevel - 12)}
            type="button"
          >
            {t('synchronization.zoomOut')}
          </button>
          <label htmlFor={`video-timeline-zoom-${vod.id}`}>
            {t('synchronization.zoom', { factor: formatZoom(zoomFactor) })}
          </label>
          <input
            aria-label={t('synchronization.timelineZoom')}
            id={`video-timeline-zoom-${vod.id}`}
            max="120"
            min="1"
            onChange={(event) => changeZoom(Number(event.target.value))}
            step="1"
            type="range"
            value={zoomLevel}
          />
          <button
            disabled={zoomLevel === 120}
            onClick={() => changeZoom(zoomLevel + 12)}
            type="button"
          >
            {t('synchronization.zoomIn')}
          </button>
          <button disabled={zoomLevel === 1} onClick={() => panTimeline(1)} type="button">
            {t('synchronization.panLater')}
          </button>
        </div>
        <p className="video-timeline__hint">{t('synchronization.timelineHint')}</p>
      </div>
    </>
  );
}

function describeEvent(event: BdoEvent): string {
  return `${event.familyA} ${event.verb === 'killed' ? 'killed' : 'died to'} ${event.familyB}`;
}

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${remainingSeconds
    .toFixed(3)
    .padStart(6, '0')}`;
}

function formatSignedTime(seconds: number): string {
  return `${seconds < 0 ? '−' : '+'}${formatTime(Math.abs(seconds))}`;
}

function formatZoom(factor: number): string {
  return factor < 10 ? factor.toFixed(1) : factor.toFixed(0);
}
