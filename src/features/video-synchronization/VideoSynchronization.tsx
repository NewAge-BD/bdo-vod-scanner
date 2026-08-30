import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import { parseBdoLog, searchEvents, type BdoEvent } from '../../domain/events';
import type { PortableProject, VodReference } from '../../domain/projects';
import {
  mapSessionTimeToVideoTime,
  mapVideoTimeToSessionTime,
  type SynchronizationAnchorInput,
} from '../../domain/synchronization';
import {
  buildLogTimelineMarkers,
  calculateTimelineWindow,
  zoomLevelToFactor,
  type LogTimelineMarker,
} from '../../domain/timeline';
import { clampVideoPan, zoomVideoAtPoint, type ViewportPoint } from '../../domain/viewport';
import { SynchronizedMiniPlayer } from './SynchronizedMiniPlayer';
import { useObjectUrl } from './useObjectUrl';

const MAX_VISIBLE_EVENTS = 50;
const MAX_VIDEO_ZOOM = 8;
const EMPTY_EVENTS: readonly BdoEvent[] = [];

interface VideoSynchronizationProps {
  readonly project: PortableProject;
  readonly vodFiles: ReadonlyMap<string, File>;
  readonly onSearchTermsChange: (vodId: string, searchTerms: readonly string[]) => Promise<boolean>;
  readonly onSynchronize: (vodId: string, anchor: SynchronizationAnchorInput) => Promise<boolean>;
}

export function VideoSynchronization({
  project,
  vodFiles,
  onSearchTermsChange,
  onSynchronize,
}: VideoSynchronizationProps) {
  const { t } = useTranslation();
  const parsedLog = useMemo(() => {
    if (project.rawLog === null || project.sessionDate === null) {
      return undefined;
    }
    return parseBdoLog(`${project.sessionDate}.log`, project.rawLog);
  }, [project.rawLog, project.sessionDate]);
  const events = parsedLog?.events ?? EMPTY_EVENTS;
  const [activeVodId, setActiveVodId] = useState(project.vods[0]?.id);
  const activeVod = project.vods.find((vod) => vod.id === activeVodId) ?? project.vods[0];
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [searchDraft, setSearchDraft] = useState('');
  const [searchSaveState, setSearchSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [eventSeekRequest, setEventSeekRequest] = useState<EventSeekRequest>();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoTime, setVideoTime] = useState(
    project.vods[0]?.synchronizationAnchor?.videoTimeSeconds ?? 0,
  );
  const [isMainPlaying, setIsMainPlaying] = useState(false);
  const [hiddenVodIds, setHiddenVodIds] = useState<ReadonlySet<string>>(() => new Set());
  const [performanceWarningDismissed, setPerformanceWarningDismissed] = useState(false);

  const file = activeVod === undefined ? undefined : vodFiles.get(activeVod.id);
  const firstEventId = events[0]?.id;
  const defaultEventId = activeVod?.synchronizationAnchor?.eventId ?? firstEventId;
  const selectedEvent =
    events.find((event) => event.id === (selectedEventId ?? defaultEventId)) ?? events[0];
  const matchingEvents = useMemo(
    () =>
      searchEvents(events, activeVod?.searchTerms ?? []).filter((event) => {
        if (
          activeVod?.synchronizationAnchor === null ||
          activeVod?.synchronizationAnchor === undefined ||
          activeVod.durationSeconds === null
        ) {
          return true;
        }
        const mappedTime = mapSessionTimeToVideoTime(
          activeVod.synchronizationAnchor,
          event.sessionTimeSeconds,
        );
        return mappedTime >= 0 && mappedTime <= activeVod.durationSeconds;
      }),
    [activeVod, events],
  );
  const eventIndexById = useMemo(
    () => new Map(events.map((event, index) => [event.id, index])),
    [events],
  );
  const visibleMatchingEvents = matchingEvents.slice(0, MAX_VISIBLE_EVENTS);
  const previousMatchingEvent = findAdjacentMatchingEvent(
    matchingEvents,
    eventIndexById,
    selectedEvent?.id,
    -1,
  );
  const nextMatchingEvent = findAdjacentMatchingEvent(
    matchingEvents,
    eventIndexById,
    selectedEvent?.id,
    1,
  );

  if (parsedLog === undefined || project.vods.length === 0) {
    return null;
  }
  const estimatedFrameRate = activeVod?.nominalFrameRate ?? 60;
  const canNavigateMatches =
    file !== undefined &&
    activeVod?.synchronizationAnchor !== null &&
    activeVod?.synchronizationAnchor !== undefined;
  const sharedSessionTime =
    activeVod?.synchronizationAnchor === null || activeVod?.synchronizationAnchor === undefined
      ? undefined
      : mapVideoTimeToSessionTime(activeVod.synchronizationAnchor, videoTime);
  const secondaryPerspectives: readonly SecondaryPerspective[] = project.vods
    .filter((vod) => vod.id !== activeVod?.id && !hiddenVodIds.has(vod.id))
    .map((vod) => ({
      file: vodFiles.get(vod.id),
      targetVideoTime:
        sharedSessionTime === undefined || vod.synchronizationAnchor === null
          ? undefined
          : mapSessionTimeToVideoTime(vod.synchronizationAnchor, sharedSessionTime),
      vod,
    }));
  const visibleVodCount = 1 + secondaryPerspectives.length;

  function selectPerspective(vodId: string) {
    const vod = project.vods.find((candidate) => candidate.id === vodId);
    const nextVideoTime =
      vod?.synchronizationAnchor === null || vod?.synchronizationAnchor === undefined
        ? 0
        : sharedSessionTime === undefined
          ? vod.synchronizationAnchor.videoTimeSeconds
          : mapSessionTimeToVideoTime(vod.synchronizationAnchor, sharedSessionTime);
    setActiveVodId(vodId);
    setSelectedEventId(vod?.synchronizationAnchor?.eventId ?? firstEventId);
    setSearchDraft('');
    setSearchSaveState('idle');
    setEventSeekRequest(undefined);
    setSaveState('idle');
    setIsVideoReady(false);
    setVideoTime(clampToVod(nextVideoTime, vod));
    setHiddenVodIds((current) => {
      const next = new Set(current);
      next.delete(vodId);
      return next;
    });
  }

  async function addSearchTerm() {
    const term = searchDraft.trim();
    if (activeVod === undefined || term.length === 0 || activeVod.searchTerms.length >= 50) {
      return;
    }
    const alreadyExists = activeVod.searchTerms.some(
      (candidate) => candidate.toLocaleLowerCase() === term.toLocaleLowerCase(),
    );
    if (alreadyExists) {
      setSearchDraft('');
      return;
    }
    setSearchSaveState('saving');
    const saved = await onSearchTermsChange(activeVod.id, [...activeVod.searchTerms, term]);
    setSearchSaveState(saved ? 'idle' : 'error');
    if (saved) {
      setSearchDraft('');
    }
  }

  async function removeSearchTerm(term: string) {
    if (activeVod === undefined) {
      return;
    }
    setSearchSaveState('saving');
    const saved = await onSearchTermsChange(
      activeVod.id,
      activeVod.searchTerms.filter((candidate) => candidate !== term),
    );
    setSearchSaveState(saved ? 'idle' : 'error');
  }

  function selectOrJumpToEvent(event: BdoEvent) {
    setSelectedEventId(event.id);
    const anchor = activeVod?.synchronizationAnchor;
    if (file === undefined || anchor === null || anchor === undefined) {
      return;
    }
    const targetVideoTime = clampToVod(
      mapSessionTimeToVideoTime(anchor, event.sessionTimeSeconds),
      activeVod,
    );
    setIsMainPlaying(false);
    setVideoTime(targetVideoTime);
    setEventSeekRequest((current) => ({
      sequence: (current?.sequence ?? 0) + 1,
      videoTimeSeconds: targetVideoTime,
    }));
  }

  function setPerspectiveVisible(vodId: string, visible: boolean) {
    setHiddenVodIds((current) => {
      const next = new Set(current);
      if (visible) {
        next.delete(vodId);
      } else {
        next.add(vodId);
      }
      return next;
    });
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
        {project.vods.map((vod) => {
          const isActive = vod.id === activeVod?.id;
          const isVisible = isActive || !hiddenVodIds.has(vod.id);
          const synchronizationStatus =
            vod.synchronizationAnchor === null
              ? t('synchronization.notSynchronized')
              : t('synchronization.synchronized');
          return (
            <div className="perspective-tab-group" key={vod.id}>
              <button
                aria-label={`${vod.displayName}, ${synchronizationStatus}`}
                aria-pressed={isActive}
                className={isActive ? 'perspective-tab perspective-tab--active' : 'perspective-tab'}
                onClick={() => selectPerspective(vod.id)}
                type="button"
              >
                <span>{vod.displayName}</span>
                <small>{synchronizationStatus}</small>
              </button>
              {!isActive && (
                <button
                  aria-pressed={isVisible}
                  className="perspective-visibility"
                  onClick={() => setPerspectiveVisible(vod.id, !isVisible)}
                  type="button"
                >
                  {isVisible
                    ? t('synchronization.hideMiniPlayer')
                    : t('synchronization.showMiniPlayer')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="video-sync__workspace">
        <div className="video-sync__player-column">
          {visibleVodCount > 4 && !performanceWarningDismissed && (
            <div className="perspective-performance-warning" role="status">
              <span>{t('synchronization.performanceWarning', { count: visibleVodCount })}</span>
              <button onClick={() => setPerformanceWarningDismissed(true)} type="button">
                {t('common.dismiss')}
              </button>
            </div>
          )}
          {file === undefined || activeVod === undefined ? (
            <div className="video-unavailable">
              <strong>{t('synchronization.reselectTitle')}</strong>
              <p>{t('synchronization.reselectDescription')}</p>
            </div>
          ) : (
            <SynchronizedVideoPlayer
              estimatedFrameRate={estimatedFrameRate}
              events={events}
              file={file}
              initialTime={videoTime}
              isPlaying={isMainPlaying}
              eventSeekRequest={eventSeekRequest}
              key={`${activeVod.id}-${file.name}-${file.lastModified}-${file.size}`}
              onHidePerspective={(vodId) => setPerspectiveVisible(vodId, false)}
              onPlaybackChange={setIsMainPlaying}
              onPromotePerspective={selectPerspective}
              onReady={setIsVideoReady}
              onSelectEvent={setSelectedEventId}
              onTimeChange={setVideoTime}
              secondaryPerspectives={secondaryPerspectives}
              selectedEvent={selectedEvent}
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

          <p className="sync-event-panel__label">{t('synchronization.searchTerms')}</p>
          {activeVod !== undefined && activeVod.searchTerms.length > 0 && (
            <div className="search-term-list" aria-label={t('synchronization.searchTerms')}>
              {activeVod.searchTerms.map((term) => (
                <span className="search-term" key={term}>
                  {term}
                  <button
                    aria-label={t('synchronization.removeSearchTerm', { term })}
                    disabled={searchSaveState === 'saving'}
                    onClick={() => void removeSearchTerm(term)}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="search-term-entry">
            <label className="search-term-entry__label" htmlFor="sync-event-search">
              {t('synchronization.addSearchTermLabel')}
            </label>
            <input
              id="sync-event-search"
              maxLength={120}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void addSearchTerm();
                }
              }}
              placeholder={t('synchronization.searchPlaceholder')}
              type="search"
              value={searchDraft}
            />
            <button
              disabled={
                searchDraft.trim().length === 0 ||
                searchSaveState === 'saving' ||
                (activeVod?.searchTerms.length ?? 0) >= 50
              }
              onClick={() => void addSearchTerm()}
              type="button"
            >
              {t('synchronization.addSearchTerm')}
            </button>
          </div>
          {searchSaveState === 'error' && (
            <p className="sync-save-state sync-save-state--error">
              {t('synchronization.searchTermsSaveError')}
            </p>
          )}
          <div className="event-match-navigation">
            <span aria-live="polite">
              {t('synchronization.matchCount', { count: matchingEvents.length })}
            </span>
            <div>
              <button
                disabled={!canNavigateMatches || previousMatchingEvent === undefined}
                onClick={() =>
                  previousMatchingEvent !== undefined && selectOrJumpToEvent(previousMatchingEvent)
                }
                type="button"
              >
                {t('synchronization.previousMatch')}
              </button>
              <button
                disabled={!canNavigateMatches || nextMatchingEvent === undefined}
                onClick={() =>
                  nextMatchingEvent !== undefined && selectOrJumpToEvent(nextMatchingEvent)
                }
                type="button"
              >
                {t('synchronization.nextMatch')}
              </button>
            </div>
          </div>
          <div
            className="sync-event-list"
            role="list"
            aria-label={t('synchronization.eventResults')}
          >
            {visibleMatchingEvents.map((event) => (
              <div key={event.id} role="listitem">
                <button
                  aria-pressed={event.id === selectedEvent?.id}
                  onClick={() => selectOrJumpToEvent(event)}
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
  eventSeekRequest,
  events,
  isPlaying: playbackIntent,
  secondaryPerspectives,
  selectedEvent,
  onHidePerspective,
  onPlaybackChange,
  onPromotePerspective,
  onReady,
  onSelectEvent,
  onTimeChange,
}: {
  readonly file: File;
  readonly vod: VodReference;
  readonly initialTime: number;
  readonly estimatedFrameRate: number;
  readonly eventSeekRequest: EventSeekRequest | undefined;
  readonly events: readonly BdoEvent[];
  readonly isPlaying: boolean;
  readonly secondaryPerspectives: readonly SecondaryPerspective[];
  readonly selectedEvent: BdoEvent | undefined;
  readonly onHidePerspective: (vodId: string) => void;
  readonly onPlaybackChange: (isPlaying: boolean) => void;
  readonly onPromotePerspective: (vodId: string) => void;
  readonly onReady: (ready: boolean) => void;
  readonly onSelectEvent: (eventId: string) => void;
  readonly onTimeChange: (time: number) => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoDragRef = useRef<DragState | null>(null);
  const timelineDragRef = useRef<TimelineDragState | null>(null);
  const [displayTime, setDisplayTime] = useState(initialTime);
  const [mediaDuration, setMediaDuration] = useState(vod.durationSeconds ?? 0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [timelineCenter, setTimelineCenter] = useState(initialTime);
  const [videoZoom, setVideoZoom] = useState(1);
  const [videoPan, setVideoPan] = useState<ViewportPoint>({ x: 0, y: 0 });
  const [isVideoPanning, setIsVideoPanning] = useState(false);
  const [isTimelinePanning, setIsTimelinePanning] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const objectUrl = useObjectUrl(file);
  const zoomFactor = zoomLevelToFactor(zoomLevel);
  const timelineWindow = useMemo(
    () => calculateTimelineWindow(mediaDuration, timelineCenter, zoomFactor),
    [mediaDuration, timelineCenter, zoomFactor],
  );
  const frameDuration = 1 / estimatedFrameRate;
  const storedAnchor = vod.synchronizationAnchor;
  const alignmentEventId = storedAnchor?.eventId ?? selectedEvent?.id;
  const alignmentEventTime =
    storedAnchor?.eventSessionTimeSeconds ?? selectedEvent?.sessionTimeSeconds;
  const alignmentVideoTime = storedAnchor?.videoTimeSeconds ?? displayTime;
  const logMarkers = useMemo(() => {
    if (alignmentEventId === undefined || alignmentEventTime === undefined) {
      return [];
    }
    const anchor: SynchronizationAnchorInput = {
      eventId: alignmentEventId,
      eventSessionTimeSeconds: alignmentEventTime,
      videoTimeSeconds: alignmentVideoTime,
    };
    return buildLogTimelineMarkers(
      events,
      (sessionTime) => mapSessionTimeToVideoTime(anchor, sessionTime),
      timelineWindow,
    );
  }, [alignmentEventId, alignmentEventTime, alignmentVideoTime, events, timelineWindow]);

  useEffect(() => {
    if (eventSeekRequest === undefined) {
      return;
    }
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    const safeTime = Math.min(mediaDuration, Math.max(0, eventSeekRequest.videoTimeSeconds));
    video.pause();
    video.currentTime = safeTime;
    setDisplayTime(safeTime);
    setTimelineCenter(safeTime);
  }, [eventSeekRequest, mediaDuration]);

  useEffect(() => {
    const viewport = videoViewportRef.current;
    if (viewport === null) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      const nextZoom = Math.min(
        MAX_VIDEO_ZOOM,
        Math.max(1, videoZoom * Math.exp(-event.deltaY * 0.0015)),
      );
      setVideoPan(
        zoomVideoAtPoint({
          currentZoom: videoZoom,
          nextZoom,
          currentPan: videoPan,
          pointer: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
          viewport: { width: bounds.width, height: bounds.height },
        }),
      );
      setVideoZoom(nextZoom);
    };
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, [videoPan, videoZoom]);

  useEffect(() => {
    const timeline = timelineRef.current;
    if (timeline === null) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (mediaDuration === 0) {
        return;
      }
      const bounds = timeline.getBoundingClientRect();
      const pointerRatio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const nextLevel = Math.min(120, Math.max(1, zoomLevel + (event.deltaY < 0 ? 4 : -4)));
      const anchorTime =
        timelineWindow.startSeconds + timelineWindow.durationSeconds * pointerRatio;
      const nextVisibleDuration = mediaDuration / zoomLevelToFactor(nextLevel);
      const nextStart = anchorTime - nextVisibleDuration * pointerRatio;
      setTimelineCenter(nextStart + nextVisibleDuration / 2);
      setZoomLevel(nextLevel);
    };
    timeline.addEventListener('wheel', handleWheel, { passive: false });
    return () => timeline.removeEventListener('wheel', handleWheel);
  }, [mediaDuration, timelineWindow.durationSeconds, timelineWindow.startSeconds, zoomLevel]);

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
    const targetCenter = Math.min(
      mediaDuration,
      Math.max(0, timelineCenter + timelineWindow.durationSeconds * 0.8 * direction),
    );
    setTimelineCenter(targetCenter);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    if (video.paused) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }

  function resetVideoViewport() {
    setVideoZoom(1);
    setVideoPan({ x: 0, y: 0 });
  }

  function beginVideoPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1 || videoZoom === 1) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    videoDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: videoPan,
    };
    setIsVideoPanning(true);
  }

  function moveVideoPan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = videoDragRef.current;
    const viewport = videoViewportRef.current;
    if (drag === null || drag.pointerId !== event.pointerId || viewport === null) {
      return;
    }
    const bounds = viewport.getBoundingClientRect();
    setVideoPan(
      clampVideoPan(
        {
          x: drag.origin.x + event.clientX - drag.startX,
          y: drag.origin.y + event.clientY - drag.startY,
        },
        { width: bounds.width, height: bounds.height },
        videoZoom,
      ),
    );
  }

  function endVideoPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (videoDragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    videoDragRef.current = null;
    setIsVideoPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginTimelinePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 1 || zoomLevel === 1) {
      return;
    }
    const timeline = timelineRef.current;
    if (timeline === null) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    timelineDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      originCenter: timelineCenter,
      secondsPerPixel: timelineWindow.durationSeconds / timeline.getBoundingClientRect().width,
    };
    setIsTimelinePanning(true);
  }

  function moveTimelinePan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = timelineDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }
    setTimelineCenter(
      Math.min(
        mediaDuration,
        Math.max(0, drag.originCenter - (event.clientX - drag.startX) * drag.secondsPerPixel),
      ),
    );
  }

  function endTimelinePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (timelineDragRef.current?.pointerId !== event.pointerId) {
      return;
    }
    timelineDragRef.current = null;
    setIsTimelinePanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function activateLogMarker(marker: LogTimelineMarker) {
    if (marker.eventCount > 1) {
      setTimelineCenter(marker.videoTimeSeconds);
      setZoomLevel(Math.min(120, zoomLevel + 12));
      return;
    }
    const eventId = marker.eventIds[0];
    if (eventId === undefined) {
      return;
    }
    onSelectEvent(eventId);
    seekTo(marker.videoTimeSeconds);
  }

  return (
    <>
      <div
        className={`perspective-stage perspective-stage--${secondaryPerspectives.length === 0 ? 'single' : secondaryPerspectives.length === 1 ? 'split' : 'multi'}`}
      >
        <div
          aria-label={t('synchronization.videoViewport')}
          className={`video-viewport${isVideoPanning ? ' video-viewport--panning' : ''}`}
          onDoubleClick={resetVideoViewport}
          onPointerCancel={endVideoPan}
          onPointerDown={beginVideoPan}
          onPointerMove={moveVideoPan}
          onPointerUp={endVideoPan}
          ref={videoViewportRef}
        >
          <video
            aria-label={t('synchronization.videoLabel', { name: vod.displayName })}
            onClick={togglePlayback}
            onError={() => onReady(false)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                stepFrame(event.key === 'ArrowLeft' ? -1 : 1);
              } else if (event.key === ' ') {
                event.preventDefault();
                togglePlayback();
              }
            }}
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
              if (playbackIntent) {
                void event.currentTarget.play().catch(() => undefined);
              }
            }}
            onPause={(event) => {
              setIsPlaying(false);
              onPlaybackChange(false);
              updateTime(event.currentTarget.currentTime, true);
            }}
            onPlay={() => {
              setIsPlaying(true);
              onPlaybackChange(true);
            }}
            onTimeUpdate={(event) => updateTime(event.currentTarget.currentTime, true)}
            ref={videoRef}
            src={objectUrl}
            style={{
              transform: `translate3d(${videoPan.x}px, ${videoPan.y}px, 0) scale(${videoZoom})`,
            }}
            tabIndex={0}
          />
          <span className="video-viewport__zoom" aria-live="polite">
            {t('synchronization.videoZoom', { factor: formatZoom(videoZoom) })}
          </span>
          <span className="video-viewport__hint">{t('synchronization.videoViewportHint')}</span>
          <div
            className="video-viewport__controls"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button onClick={togglePlayback} type="button">
              {isPlaying ? t('synchronization.pause') : t('synchronization.play')}
            </button>
            <button
              onClick={() => {
                const video = videoRef.current;
                if (video !== null) {
                  video.muted = !isMuted;
                  setIsMuted(video.muted);
                }
              }}
              type="button"
            >
              {isMuted ? t('synchronization.unmute') : t('synchronization.mute')}
            </button>
            <button disabled={videoZoom === 1} onClick={resetVideoViewport} type="button">
              {t('synchronization.resetView')}
            </button>
            <button
              onClick={() => void videoViewportRef.current?.requestFullscreen?.()}
              type="button"
            >
              {t('synchronization.fullscreen')}
            </button>
          </div>
        </div>
        {secondaryPerspectives.length > 0 && (
          <div className="perspective-mini-grid">
            {secondaryPerspectives.map((perspective) => (
              <SecondaryPerspectivePreview
                isPlaying={playbackIntent}
                key={perspective.vod.id}
                onHide={() => onHidePerspective(perspective.vod.id)}
                onPromote={() => onPromotePerspective(perspective.vod.id)}
                perspective={perspective}
              />
            ))}
          </div>
        )}
      </div>
      <div
        aria-label={t('synchronization.timelineControls')}
        className={`video-timeline${isTimelinePanning ? ' video-timeline--panning' : ''}`}
        onDoubleClick={() => {
          setZoomLevel(1);
          setTimelineCenter(displayTime);
        }}
        onPointerCancel={endTimelinePan}
        onPointerDown={beginTimelinePan}
        onPointerMove={moveTimelinePan}
        onPointerUp={endTimelinePan}
        ref={timelineRef}
      >
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

        <div className="log-timeline" aria-label={t('synchronization.logTimeline')}>
          <div className="log-timeline__heading">
            <span>{t('synchronization.logEvents')}</span>
            <small>
              {storedAnchor === null
                ? t('synchronization.previewAlignment')
                : t('synchronization.storedAlignment')}
            </small>
          </div>
          <div className="log-timeline__track">
            {logMarkers.length === 0 ? (
              <span className="log-timeline__empty">{t('synchronization.noVisibleEvents')}</span>
            ) : (
              logMarkers.map((marker) => {
                const onlyEvent =
                  marker.eventCount === 1
                    ? events.find((event) => event.id === marker.eventIds[0])
                    : undefined;
                const label =
                  onlyEvent === undefined
                    ? t('synchronization.eventBundle', {
                        count: marker.eventCount,
                        time: formatTime(marker.videoTimeSeconds),
                      })
                    : `${onlyEvent.clockTime}: ${describeEvent(onlyEvent)}`;
                return (
                  <button
                    aria-label={label}
                    aria-pressed={
                      selectedEvent !== undefined && marker.eventIds.includes(selectedEvent.id)
                    }
                    className={`log-timeline__marker log-timeline__marker--${marker.type}`}
                    key={marker.id}
                    onClick={() => activateLogMarker(marker)}
                    onDoubleClick={(event) => event.stopPropagation()}
                    style={{ left: `${marker.positionRatio * 100}%` }}
                    title={label}
                    type="button"
                  >
                    {marker.eventCount > 1 && <span>{marker.eventCount}</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="video-timeline__zoom">
          <button
            disabled={zoomLevel === 1 || timelineWindow.startSeconds === 0}
            onClick={() => panTimeline(-1)}
            type="button"
          >
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
          <button
            disabled={zoomLevel === 1 || timelineWindow.endSeconds >= mediaDuration}
            onClick={() => panTimeline(1)}
            type="button"
          >
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

function SecondaryPerspectivePreview({
  isPlaying,
  onHide,
  onPromote,
  perspective,
}: {
  readonly isPlaying: boolean;
  readonly onHide: () => void;
  readonly onPromote: () => void;
  readonly perspective: SecondaryPerspective;
}) {
  const { t } = useTranslation();
  const { file, targetVideoTime, vod } = perspective;
  const isOutsideSource =
    targetVideoTime !== undefined &&
    (targetVideoTime < 0 ||
      (vod.durationSeconds !== null && targetVideoTime > vod.durationSeconds));

  if (file !== undefined && targetVideoTime !== undefined && !isOutsideSource) {
    return (
      <SynchronizedMiniPlayer
        file={file}
        isPlaying={isPlaying}
        onHide={onHide}
        onPromote={onPromote}
        targetVideoTime={targetVideoTime}
        vod={vod}
      />
    );
  }

  const state =
    vod.synchronizationAnchor === null
      ? t('synchronization.miniSyncRequired')
      : file === undefined
        ? t('synchronization.miniReselectRequired')
        : isOutsideSource
          ? t('synchronization.outsideSourceRange')
          : t('synchronization.awaitingMainSynchronization');

  return (
    <div className="perspective-mini perspective-mini--placeholder">
      <span className="perspective-mini__name">{vod.displayName}</span>
      <span className="perspective-mini__state">{state}</span>
      <button
        aria-label={t('synchronization.promotePerspective', { name: vod.displayName })}
        className="perspective-mini__promote"
        onClick={onPromote}
        type="button"
      />
      <button
        aria-label={t('synchronization.hidePerspective', { name: vod.displayName })}
        className="perspective-mini__hide"
        onClick={onHide}
        type="button"
      >
        ×
      </button>
    </div>
  );
}

function clampToVod(time: number, vod: VodReference | undefined): number {
  const maximum = vod?.durationSeconds ?? Number.POSITIVE_INFINITY;
  return Math.min(maximum, Math.max(0, time));
}

interface DragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly origin: ViewportPoint;
}

interface TimelineDragState {
  readonly pointerId: number;
  readonly startX: number;
  readonly originCenter: number;
  readonly secondsPerPixel: number;
}

interface SecondaryPerspective {
  readonly file: File | undefined;
  readonly targetVideoTime: number | undefined;
  readonly vod: VodReference;
}

interface EventSeekRequest {
  readonly sequence: number;
  readonly videoTimeSeconds: number;
}

function findAdjacentMatchingEvent(
  matchingEvents: readonly BdoEvent[],
  eventIndexById: ReadonlyMap<string, number>,
  selectedEventId: string | undefined,
  direction: -1 | 1,
): BdoEvent | undefined {
  if (matchingEvents.length === 0) {
    return undefined;
  }
  if (selectedEventId === undefined) {
    return direction === 1 ? matchingEvents[0] : undefined;
  }
  const selectedIndex = eventIndexById.get(selectedEventId) ?? -1;
  if (direction === 1) {
    return matchingEvents.find((event) => (eventIndexById.get(event.id) ?? -1) > selectedIndex);
  }
  for (let index = matchingEvents.length - 1; index >= 0; index -= 1) {
    const event = matchingEvents[index];
    if (
      event !== undefined &&
      (eventIndexById.get(event.id) ?? Number.POSITIVE_INFINITY) < selectedIndex
    ) {
      return event;
    }
  }
  return undefined;
}
