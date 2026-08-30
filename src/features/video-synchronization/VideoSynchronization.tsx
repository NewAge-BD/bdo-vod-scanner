import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';

import type { CreateClipInput, UpdateClipInput } from '../../domain/clips';
import type { DaVinciTimelineSettings } from '../../domain/davinci-export';
import { parseBdoLog, searchEvents, type BdoEvent } from '../../domain/events';
import type { Clip, PortableProject, VodReference } from '../../domain/projects';
import {
  mapSessionTimeToVideoTime,
  mapVideoTimeToSessionTime,
  type SynchronizationAnchorInput,
} from '../../domain/synchronization';
import {
  buildLogTimelineMarkers,
  calculatePointerAnchoredZoomCenter,
  calculateTimelineWindow,
  zoomLevelToFactor,
  type LogTimelineMarker,
  type TimelineWindow,
} from '../../domain/timeline';
import { clampVideoPan, zoomVideoAtPoint, type ViewportPoint } from '../../domain/viewport';
import { SplitTimelineIcon } from '../../shared/components/SplitTimelineIcon';
import { TrashIcon } from '../../shared/components/TrashIcon';
import { ClipPanel } from '../clip-editor';
import { useObjectUrl } from './useObjectUrl';

const MAX_VISIBLE_EVENTS = 50;
const MAX_VIDEO_ZOOM = 8;
const FRAME_REPEAT_INTERVAL_MS = 80;
const EMPTY_EVENTS: readonly BdoEvent[] = [];

interface VideoSynchronizationProps {
  readonly project: PortableProject;
  readonly vodFiles: ReadonlyMap<string, File>;
  readonly onClipPanelCollapsedChange: (collapsed: boolean) => Promise<boolean>;
  readonly onCreateClip: (vodId: string, input: CreateClipInput) => Promise<boolean>;
  readonly onDavinciDefaultsChange: (settings: DaVinciTimelineSettings) => Promise<boolean>;
  readonly onDeleteClip: (clipId: string) => Promise<boolean>;
  readonly onReorderClips: (clipOrder: readonly string[]) => Promise<boolean>;
  readonly onDeleteVod: (vodId: string) => Promise<boolean>;
  readonly onClippingModeChange: (isClipping: boolean) => void;
  readonly onSearchTermsChange: (vodId: string, searchTerms: readonly string[]) => Promise<boolean>;
  readonly onSplitSearchTermsChange: (
    vodId: string,
    splitSearchTerms: readonly string[],
  ) => Promise<boolean>;
  readonly onSynchronize: (vodId: string, anchor: SynchronizationAnchorInput) => Promise<boolean>;
  readonly onUpdateClip: (clipId: string, input: UpdateClipInput) => Promise<boolean>;
}

export function VideoSynchronization({
  project,
  vodFiles,
  onClipPanelCollapsedChange,
  onCreateClip,
  onDavinciDefaultsChange,
  onDeleteClip,
  onReorderClips,
  onDeleteVod,
  onClippingModeChange,
  onSearchTermsChange,
  onSplitSearchTermsChange,
  onSynchronize,
  onUpdateClip,
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
  const [syncSearchDraft, setSyncSearchDraft] = useState('');
  const [syncSearchTermsByVod, setSyncSearchTermsByVod] = useState<
    ReadonlyMap<string, readonly string[]>
  >(() => new Map());
  const [clipSearchDraft, setClipSearchDraft] = useState('');
  const [clipSearchSaveState, setClipSearchSaveState] = useState<'idle' | 'saving' | 'error'>(
    'idle',
  );
  const [eventSeekRequest, setEventSeekRequest] = useState<EventSeekRequest>();
  const clippingPlayerRef = useRef<HTMLDivElement>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoTime, setVideoTime] = useState(
    project.vods[0]?.synchronizationAnchor?.videoTimeSeconds ?? 0,
  );
  const [isMainPlaying, setIsMainPlaying] = useState(false);
  const [clipDraft, setClipDraft] = useState<ClipDraftRange>({});
  const [clipSaveState, setClipSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [workspaceMode, setWorkspaceMode] = useState<'synchronization' | 'clipping'>(
    'synchronization',
  );

  const file = activeVod === undefined ? undefined : vodFiles.get(activeVod.id);
  const firstEventId = events[0]?.id;
  const defaultEventId = activeVod?.synchronizationAnchor?.eventId ?? firstEventId;
  const selectedEvent =
    events.find((event) => event.id === (selectedEventId ?? defaultEventId)) ?? events[0];
  const syncSearchTerms = useMemo(
    () => (activeVod === undefined ? [] : (syncSearchTermsByVod.get(activeVod.id) ?? [])),
    [activeVod, syncSearchTermsByVod],
  );
  const syncMatchingEvents = useMemo(
    () =>
      searchEvents(events, syncSearchTerms).filter((event) => {
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
    [activeVod, events, syncSearchTerms],
  );
  const clipMatchingEvents = useMemo(
    () => searchEvents(events, activeVod?.searchTerms ?? []),
    [activeVod?.searchTerms, events],
  );
  const eventIndexById = useMemo(
    () => new Map(events.map((event, index) => [event.id, index])),
    [events],
  );
  const visibleMatchingEvents = syncMatchingEvents.slice(0, MAX_VISIBLE_EVENTS);
  const previousMatchingEvent = findAdjacentMatchingEvent(
    syncMatchingEvents,
    eventIndexById,
    selectedEvent?.id,
    -1,
  );
  const nextMatchingEvent = findAdjacentMatchingEvent(
    syncMatchingEvents,
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
    setSyncSearchDraft('');
    setClipSearchDraft('');
    setClipSearchSaveState('idle');
    setEventSeekRequest(undefined);
    setClipDraft({});
    setClipSaveState('idle');
    setSaveState('idle');
    setIsVideoReady(false);
    setVideoTime(clampToVod(nextVideoTime, vod));
  }

  function previewClip(clip: Clip) {
    const vod = project.vods.find((candidate) => candidate.id === clip.vodId);
    if (vod === undefined || !vodFiles.has(vod.id)) {
      return;
    }
    if (vod.id !== activeVod?.id) {
      selectPerspective(vod.id);
    }
    setIsMainPlaying(true);
    setVideoTime(clip.inPointSeconds);
    setEventSeekRequest((current) => ({
      playUntilSeconds: clip.outPointSeconds,
      sequence: (current?.sequence ?? 0) + 1,
      videoTimeSeconds: clip.inPointSeconds,
    }));
    requestAnimationFrame(() =>
      clippingPlayerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }),
    );
  }

  function addSyncSearchTerm() {
    const term = syncSearchDraft.trim();
    if (activeVod === undefined || term.length === 0 || syncSearchTerms.length >= 50) {
      return;
    }
    const alreadyExists = syncSearchTerms.some(
      (candidate) => candidate.toLocaleLowerCase() === term.toLocaleLowerCase(),
    );
    if (!alreadyExists) {
      setSyncSearchTermsByVod((current) => {
        const next = new Map(current);
        next.set(activeVod.id, [...syncSearchTerms, term]);
        return next;
      });
    }
    setSyncSearchDraft('');
  }

  function removeSyncSearchTerm(term: string) {
    if (activeVod === undefined) {
      return;
    }
    setSyncSearchTermsByVod((current) => {
      const next = new Map(current);
      next.set(
        activeVod.id,
        syncSearchTerms.filter((candidate) => candidate !== term),
      );
      return next;
    });
  }

  async function addClipSearchTerm() {
    const term = clipSearchDraft.trim();
    if (activeVod === undefined || term.length === 0 || activeVod.searchTerms.length >= 50) {
      return;
    }
    const alreadyExists = activeVod.searchTerms.some(
      (candidate) => candidate.toLocaleLowerCase() === term.toLocaleLowerCase(),
    );
    if (alreadyExists) {
      setClipSearchDraft('');
      return;
    }
    setClipSearchSaveState('saving');
    const saved = await onSearchTermsChange(activeVod.id, [...activeVod.searchTerms, term]);
    setClipSearchSaveState(saved ? 'idle' : 'error');
    if (saved) {
      setClipSearchDraft('');
    }
  }

  async function removeClipSearchTerm(term: string) {
    if (activeVod === undefined) {
      return;
    }
    setClipSearchSaveState('saving');
    const saved = await onSearchTermsChange(
      activeVod.id,
      activeVod.searchTerms.filter((candidate) => candidate !== term),
    );
    setClipSearchSaveState(saved ? 'idle' : 'error');
  }

  async function toggleClipSearchTermSplit(term: string) {
    if (activeVod === undefined) {
      return;
    }
    const storedSplitSearchTerms = activeVod.splitSearchTerms ?? [];
    const isSplit = storedSplitSearchTerms.some(
      (candidate) => candidate.toLocaleLowerCase() === term.toLocaleLowerCase(),
    );
    const nextSplitSearchTerms = isSplit
      ? storedSplitSearchTerms.filter(
          (candidate) => candidate.toLocaleLowerCase() !== term.toLocaleLowerCase(),
        )
      : [...storedSplitSearchTerms, term];
    setClipSearchSaveState('saving');
    const saved = await onSplitSearchTermsChange(activeVod.id, nextSplitSearchTerms);
    setClipSearchSaveState(saved ? 'idle' : 'error');
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

  function markClipBoundary(boundary: 'in' | 'out', time: number) {
    setIsMainPlaying(false);
    setClipSaveState('idle');
    setClipDraft((current) =>
      boundary === 'in'
        ? {
            ...current,
            inPointSeconds: time,
            outPointSeconds:
              current.outPointSeconds !== undefined && current.outPointSeconds < time
                ? time
                : current.outPointSeconds,
          }
        : {
            ...current,
            inPointSeconds:
              current.inPointSeconds !== undefined && current.inPointSeconds > time
                ? time
                : current.inPointSeconds,
            outPointSeconds: time,
          },
    );
  }

  async function saveMarkedClip() {
    const inPointSeconds = clipDraft.inPointSeconds;
    const outPointSeconds = clipDraft.outPointSeconds;
    const anchor = activeVod?.synchronizationAnchor;
    if (
      activeVod === undefined ||
      anchor === null ||
      anchor === undefined ||
      inPointSeconds === undefined ||
      outPointSeconds === undefined ||
      outPointSeconds <= inPointSeconds
    ) {
      return;
    }
    const matchingEventIds = clipMatchingEvents
      .filter((event) => {
        const eventVideoTime = mapSessionTimeToVideoTime(anchor, event.sessionTimeSeconds);
        return eventVideoTime >= inPointSeconds && eventVideoTime <= outPointSeconds;
      })
      .map((event) => event.id);
    setClipSaveState('saving');
    const saved = await onCreateClip(activeVod.id, {
      inPointSeconds,
      outPointSeconds,
      matchingEventIds,
    });
    setClipSaveState(saved ? 'saved' : 'error');
    if (saved) {
      setClipDraft({});
    }
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

  async function deleteVod(vodId: string) {
    if (!(await onDeleteVod(vodId))) {
      return;
    }
    if (vodId === activeVod?.id) {
      const nextVod = project.vods.find((vod) => vod.id !== vodId);
      setActiveVodId(nextVod?.id);
      setWorkspaceMode('synchronization');
      onClippingModeChange(false);
      setSelectedEventId(nextVod?.synchronizationAnchor?.eventId ?? firstEventId);
      setClipDraft({});
      setClipSaveState('idle');
      setSaveState('idle');
      setIsVideoReady(false);
      setVideoTime(nextVod?.synchronizationAnchor?.videoTimeSeconds ?? 0);
    }
  }

  function renderPerspectiveTabs(clippingMode: boolean) {
    return (
      <div className="perspective-tabs" role="group" aria-label={t('synchronization.perspectives')}>
        {project.vods.map((vod) => {
          const isActive = vod.id === activeVod?.id;
          const synchronizationStatus =
            vod.synchronizationAnchor === null
              ? t('synchronization.notSynchronized')
              : t('synchronization.synchronized');
          return (
            <div className="perspective-tab-group" key={vod.id}>
              <button
                aria-label={`${vod.displayName}, ${synchronizationStatus}`}
                aria-pressed={isActive}
                className={`perspective-tab perspective-tab--${vod.synchronizationAnchor === null ? 'sync-required' : 'synchronized'}${isActive ? ' perspective-tab--active' : ''}`}
                disabled={clippingMode && vod.synchronizationAnchor === null}
                onClick={() => selectPerspective(vod.id)}
                type="button"
              >
                <span>{vod.displayName}</span>
                <small>{synchronizationStatus}</small>
              </button>
              <div className="perspective-tab-actions">
                <button
                  aria-label={t('sources.deleteVod', { name: vod.displayName })}
                  className="perspective-delete"
                  onClick={() => void deleteVod(vod.id)}
                  title={t('sources.deleteVod', { name: vod.displayName })}
                  type="button"
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderPlayer(clippingMode: boolean) {
    if (file === undefined || activeVod === undefined) {
      return (
        <div className="video-unavailable">
          <strong>{t('synchronization.reselectTitle')}</strong>
          <p>{t('synchronization.reselectDescription')}</p>
        </div>
      );
    }
    return (
      <SynchronizedVideoPlayer
        clippingMode={clippingMode}
        estimatedFrameRate={estimatedFrameRate}
        events={events}
        file={file}
        initialTime={videoTime}
        isPlaying={isMainPlaying}
        eventSeekRequest={eventSeekRequest}
        clipDraft={clipDraft}
        clipSaveState={clipSaveState}
        key={`${activeVod.id}-${file.name}-${file.lastModified}-${file.size}-${clippingMode ? 'clips' : 'sync'}`}
        onClipRangeChange={(range) => {
          setClipDraft(range);
          setClipSaveState('idle');
        }}
        onMarkClipBoundary={markClipBoundary}
        onPlaybackChange={setIsMainPlaying}
        onPreviewComplete={(sequence) =>
          setEventSeekRequest((current) => (current?.sequence === sequence ? undefined : current))
        }
        onReady={setIsVideoReady}
        onRemoveSearchTerm={(term) => void removeClipSearchTerm(term)}
        onSearchDraftChange={setClipSearchDraft}
        onAddSearchTerm={() => void addClipSearchTerm()}
        onToggleSearchTermSplit={(term) => void toggleClipSearchTermSplit(term)}
        onSelectEvent={setSelectedEventId}
        onTimeChange={setVideoTime}
        onSaveClip={() => void saveMarkedClip()}
        searchDraft={clipSearchDraft}
        searchSaveState={clipSearchSaveState}
        searchTerms={activeVod.searchTerms}
        splitSearchTerms={activeVod.splitSearchTerms ?? []}
        selectedEvent={selectedEvent}
        vod={activeVod}
      />
    );
  }

  if (workspaceMode === 'clipping') {
    return (
      <section className="video-sync clipping-workspace" aria-labelledby="clipping-workspace-title">
        <div className="video-sync__heading clipping-workspace__heading">
          <div>
            <p className="section-kicker">{t('clipping.kicker')}</p>
            <h2 id="clipping-workspace-title">{t('clipping.title')}</h2>
          </div>
          <button
            className="button clipping-workspace__back"
            onClick={() => {
              setWorkspaceMode('synchronization');
              onClippingModeChange(false);
            }}
            type="button"
          >
            {t('clipping.back')}
          </button>
        </div>
        <p className="clipping-workspace__description">{t('clipping.description')}</p>
        {renderPerspectiveTabs(true)}
        <div className="clipping-workspace__player" ref={clippingPlayerRef}>
          {renderPlayer(true)}
        </div>
        <ClipPanel
          onCollapsedChange={onClipPanelCollapsedChange}
          onDavinciDefaultsChange={onDavinciDefaultsChange}
          onDeleteClip={onDeleteClip}
          onPreviewClip={previewClip}
          onReorderClips={onReorderClips}
          onRenameClip={(clipId, title) => onUpdateClip(clipId, { title })}
          project={project}
          vodFiles={vodFiles}
        />
      </section>
    );
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

      {renderPerspectiveTabs(false)}

      <div className="video-sync__workspace">
        <div className="video-sync__player-column">{renderPlayer(false)}</div>

        <div className="sync-event-panel">
          <p className="sync-event-panel__label">{t('synchronization.selectedEvent')}</p>
          {selectedEvent !== undefined && (
            <div className={`selected-event selected-event--${selectedEvent.verb}`}>
              <time>{selectedEvent.clockTime}</time>
              <p>{selectedEvent.rawLine}</p>
            </div>
          )}

          <p className="sync-event-panel__label">{t('synchronization.searchTerms')}</p>
          <p className="sync-event-panel__hint">{t('synchronization.temporarySearchHint')}</p>
          {syncSearchTerms.length > 0 && (
            <div className="search-term-list" aria-label={t('synchronization.searchTerms')}>
              {syncSearchTerms.map((term) => (
                <span className="search-term" key={term}>
                  {term}
                  <button
                    aria-label={t('synchronization.removeSearchTerm', { term })}
                    onClick={() => removeSyncSearchTerm(term)}
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
              onChange={(event) => setSyncSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addSyncSearchTerm();
                }
              }}
              placeholder={t('synchronization.searchPlaceholder')}
              type="search"
              value={syncSearchDraft}
            />
            <button
              disabled={syncSearchDraft.trim().length === 0 || syncSearchTerms.length >= 50}
              onClick={addSyncSearchTerm}
              type="button"
            >
              {t('synchronization.addSearchTerm')}
            </button>
          </div>
          <div className="event-match-navigation">
            <span aria-live="polite">
              {t('synchronization.matchCount', { count: syncMatchingEvents.length })}
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
          <button
            className="button clipping-start"
            disabled={activeVod?.synchronizationAnchor === null || file === undefined}
            onClick={() => {
              setWorkspaceMode('clipping');
              onClippingModeChange(true);
            }}
            type="button"
          >
            {t('clipping.start')}
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
  clippingMode,
  file,
  vod,
  initialTime,
  estimatedFrameRate,
  eventSeekRequest,
  clipDraft,
  clipSaveState,
  events,
  isPlaying: playbackIntent,
  searchDraft,
  searchSaveState,
  searchTerms,
  splitSearchTerms,
  selectedEvent,
  onClipRangeChange,
  onMarkClipBoundary,
  onPlaybackChange,
  onPreviewComplete,
  onReady,
  onRemoveSearchTerm,
  onSearchDraftChange,
  onAddSearchTerm,
  onToggleSearchTermSplit,
  onSelectEvent,
  onTimeChange,
  onSaveClip,
}: {
  readonly clippingMode: boolean;
  readonly file: File;
  readonly vod: VodReference;
  readonly initialTime: number;
  readonly estimatedFrameRate: number;
  readonly eventSeekRequest: EventSeekRequest | undefined;
  readonly clipDraft: ClipDraftRange;
  readonly clipSaveState: 'idle' | 'saving' | 'saved' | 'error';
  readonly events: readonly BdoEvent[];
  readonly isPlaying: boolean;
  readonly searchDraft: string;
  readonly searchSaveState: 'idle' | 'saving' | 'error';
  readonly searchTerms: readonly string[];
  readonly splitSearchTerms: readonly string[];
  readonly selectedEvent: BdoEvent | undefined;
  readonly onClipRangeChange: (range: ClipDraftRange) => void;
  readonly onMarkClipBoundary: (boundary: 'in' | 'out', time: number) => void;
  readonly onPlaybackChange: (isPlaying: boolean) => void;
  readonly onPreviewComplete: (sequence: number) => void;
  readonly onReady: (ready: boolean) => void;
  readonly onRemoveSearchTerm: (term: string) => void;
  readonly onSearchDraftChange: (value: string) => void;
  readonly onAddSearchTerm: () => void;
  readonly onToggleSearchTermSplit: (term: string) => void;
  readonly onSelectEvent: (eventId: string) => void;
  readonly onTimeChange: (time: number) => void;
  readonly onSaveClip: () => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoViewportRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineScaleRef = useRef<HTMLDivElement>(null);
  const videoDragRef = useRef<DragState | null>(null);
  const timelineDragRef = useRef<TimelineDragState | null>(null);
  const clipHandleDragRef = useRef<{ pointerId: number; returnTime: number } | null>(null);
  const lastFrameStepAtRef = useRef(0);
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
  const killMarkers = useMemo(
    () =>
      buildAlignedMarkers(
        events.filter((event) => event.verb === 'killed'),
        alignmentEventId,
        alignmentEventTime,
        alignmentVideoTime,
        timelineWindow,
      ),
    [alignmentEventId, alignmentEventTime, alignmentVideoTime, events, timelineWindow],
  );
  const deathMarkers = useMemo(
    () =>
      buildAlignedMarkers(
        events.filter((event) => event.verb === 'diedTo'),
        alignmentEventId,
        alignmentEventTime,
        alignmentVideoTime,
        timelineWindow,
      ),
    [alignmentEventId, alignmentEventTime, alignmentVideoTime, events, timelineWindow],
  );
  const nameMarkerGroups = useMemo(
    () =>
      searchTerms.map((term) => {
        const matchingEvents = searchEvents(events, [term]);
        return {
          deathMarkers: buildAlignedMarkers(
            matchingEvents.filter((event) => event.verb === 'diedTo'),
            alignmentEventId,
            alignmentEventTime,
            alignmentVideoTime,
            timelineWindow,
          ),
          killMarkers: buildAlignedMarkers(
            matchingEvents.filter((event) => event.verb === 'killed'),
            alignmentEventId,
            alignmentEventTime,
            alignmentVideoTime,
            timelineWindow,
            true,
          ),
          markers: buildAlignedMarkers(
            matchingEvents,
            alignmentEventId,
            alignmentEventTime,
            alignmentVideoTime,
            timelineWindow,
            true,
          ),
          term,
        };
      }),
    [alignmentEventId, alignmentEventTime, alignmentVideoTime, events, searchTerms, timelineWindow],
  );

  const handleGlobalVideoKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      isTextEntryTarget(event.target)
    ) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) {
        togglePlayback();
      }
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const now = performance.now();
      if (!event.repeat || now - lastFrameStepAtRef.current >= FRAME_REPEAT_INTERVAL_MS) {
        lastFrameStepAtRef.current = now;
        stepFrame(event.key === 'ArrowLeft' ? -1 : 1);
      }
      return;
    }
    if (clippingMode && event.key.toLocaleLowerCase() === 'i') {
      event.preventDefault();
      markClipBoundary('in');
      return;
    }
    if (clippingMode && event.key.toLocaleLowerCase() === 'o') {
      event.preventDefault();
      markClipBoundary('out');
    }
  });

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalVideoKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalVideoKeyDown);
  }, []);

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
    if (eventSeekRequest.playUntilSeconds !== undefined) {
      void video.play().catch(() => undefined);
    }
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
    const timelineScale = timelineScaleRef.current;
    if (timeline === null || timelineScale === null) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (mediaDuration === 0) {
        return;
      }
      const bounds = timelineScale.getBoundingClientRect();
      const pointerRatio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
      const nextLevel = Math.min(120, Math.max(1, zoomLevel + (event.deltaY < 0 ? 4 : -4)));
      setTimelineCenter(
        calculatePointerAnchoredZoomCenter(
          mediaDuration,
          timelineWindow,
          zoomLevelToFactor(nextLevel),
          pointerRatio,
        ),
      );
      setZoomLevel(nextLevel);
    };
    timeline.addEventListener('wheel', handleWheel, { passive: false });
    return () => timeline.removeEventListener('wheel', handleWheel);
  }, [mediaDuration, timelineWindow, zoomLevel]);

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

  function handleTimeUpdate(video: HTMLVideoElement) {
    if (clipHandleDragRef.current !== null) {
      setDisplayTime(video.currentTime);
      return;
    }
    const previewEnd = eventSeekRequest?.playUntilSeconds;
    const previewSequence = eventSeekRequest?.sequence;
    if (
      previewEnd !== undefined &&
      previewSequence !== undefined &&
      video.currentTime >= previewEnd
    ) {
      video.currentTime = previewEnd;
      video.pause();
      updateTime(previewEnd, true);
      onPreviewComplete(previewSequence);
      return;
    }
    updateTime(video.currentTime, true);
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

  function markClipBoundary(boundary: 'in' | 'out') {
    videoRef.current?.pause();
    onMarkClipBoundary(boundary, displayTime);
  }

  function beginClipHandlePreview(event: ReactPointerEvent<HTMLInputElement>) {
    if (event.button !== 0) {
      return;
    }
    const video = videoRef.current;
    if (video === null) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clipHandleDragRef.current = { pointerId: event.pointerId, returnTime: displayTime };
    video.pause();
  }

  function previewClipHandle(time: number) {
    const video = videoRef.current;
    if (video === null || clipHandleDragRef.current === null) {
      return;
    }
    const safeTime = Math.min(mediaDuration, Math.max(0, time));
    video.currentTime = safeTime;
    setDisplayTime(safeTime);
  }

  function endClipHandlePreview(event: ReactPointerEvent<HTMLInputElement>) {
    const drag = clipHandleDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) {
      return;
    }
    clipHandleDragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    seekTo(drag.returnTime);
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
    onSelectEvent(marker.representativeEventId);
    setTimelineCenter(marker.videoTimeSeconds);
    seekTo(marker.videoTimeSeconds);
  }

  return (
    <>
      <div className="perspective-stage perspective-stage--single">
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
            onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget)}
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
      </div>
      <div
        aria-label={t('synchronization.timelineControls')}
        className={`video-timeline${clippingMode ? ' video-timeline--clipping' : ''}${isTimelinePanning ? ' video-timeline--panning' : ''}`}
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
        <div className="video-timeline__scrubber" ref={timelineScaleRef}>
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
          {clippingMode &&
            clipDraft.inPointSeconds !== undefined &&
            clipDraft.outPointSeconds !== undefined &&
            clipDraft.inPointSeconds >= timelineWindow.startSeconds &&
            clipDraft.outPointSeconds <= timelineWindow.endSeconds && (
              <div className="clip-range-editor">
                <span
                  className="clip-range-editor__selection"
                  style={{
                    left: `${((clipDraft.inPointSeconds - timelineWindow.startSeconds) / timelineWindow.durationSeconds) * 100}%`,
                    width: `${((clipDraft.outPointSeconds - clipDraft.inPointSeconds) / timelineWindow.durationSeconds) * 100}%`,
                  }}
                />
                <input
                  aria-label={t('clips.rangeHandleIn')}
                  className="clip-range-editor__handle clip-range-editor__handle--in"
                  max={timelineWindow.endSeconds}
                  min={timelineWindow.startSeconds}
                  onChange={(event) => {
                    const inPointSeconds = Math.min(
                      Number(event.target.value),
                      clipDraft.outPointSeconds! - frameDuration,
                    );
                    onClipRangeChange({
                      ...clipDraft,
                      inPointSeconds,
                    });
                    previewClipHandle(inPointSeconds);
                  }}
                  onPointerCancel={endClipHandlePreview}
                  onPointerDown={beginClipHandlePreview}
                  onPointerUp={endClipHandlePreview}
                  step={frameDuration}
                  type="range"
                  value={clipDraft.inPointSeconds}
                />
                <input
                  aria-label={t('clips.rangeHandleOut')}
                  className="clip-range-editor__handle clip-range-editor__handle--out"
                  max={timelineWindow.endSeconds}
                  min={timelineWindow.startSeconds}
                  onChange={(event) => {
                    const outPointSeconds = Math.max(
                      Number(event.target.value),
                      clipDraft.inPointSeconds! + frameDuration,
                    );
                    onClipRangeChange({
                      ...clipDraft,
                      outPointSeconds,
                    });
                    previewClipHandle(outPointSeconds);
                  }}
                  onPointerCancel={endClipHandlePreview}
                  onPointerDown={beginClipHandlePreview}
                  onPointerUp={endClipHandlePreview}
                  step={frameDuration}
                  type="range"
                  value={clipDraft.outPointSeconds}
                />
              </div>
            )}
        </div>

        {clippingMode && (
          <div className="clip-mark-controls" aria-label={t('clips.kicker')}>
            <button onClick={() => markClipBoundary('in')} type="button">
              {t('clips.markIn')}
            </button>
            <span>
              {t('clips.inPoint')}: {formatOptionalTime(clipDraft.inPointSeconds)}
            </span>
            <button onClick={() => markClipBoundary('out')} type="button">
              {t('clips.markOut')}
            </button>
            <span>
              {t('clips.outPoint')}: {formatOptionalTime(clipDraft.outPointSeconds)}
            </span>
            <button
              className="clip-mark-controls__add"
              disabled={
                storedAnchor === null ||
                clipDraft.inPointSeconds === undefined ||
                clipDraft.outPointSeconds === undefined ||
                clipDraft.outPointSeconds <= clipDraft.inPointSeconds ||
                clipSaveState === 'saving'
              }
              onClick={onSaveClip}
              type="button"
            >
              {t('clips.add')}
            </button>
          </div>
        )}
        {clippingMode && clipSaveState === 'saved' && (
          <p className="clip-save-state">{t('clips.saved')}</p>
        )}
        {clippingMode && clipSaveState === 'error' && (
          <p className="clip-save-state clip-save-state--error">{t('clips.saveError')}</p>
        )}

        {clippingMode ? (
          <div className="clipping-timeline" aria-label={t('clipping.timeline')}>
            <EventTimelineLane
              emptyLabel={t('synchronization.noVisibleEvents')}
              events={events}
              label={t('clipping.kills')}
              markers={killMarkers}
              onActivate={activateLogMarker}
              selectedEvent={selectedEvent}
            />
            <EventTimelineLane
              emptyLabel={t('synchronization.noVisibleEvents')}
              events={events}
              label={t('clipping.deaths')}
              markers={deathMarkers}
              onActivate={activateLogMarker}
              selectedEvent={selectedEvent}
            />
            <div className="clipping-timeline__lane clipping-timeline__lane--name-entry">
              <label className="clipping-timeline__label" htmlFor={`clip-name-search-${vod.id}`}>
                {t('clipping.selectedNames')}
              </label>
              <div className="name-timeline-entry">
                <input
                  id={`clip-name-search-${vod.id}`}
                  maxLength={120}
                  onChange={(event) => onSearchDraftChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onAddSearchTerm();
                    }
                  }}
                  placeholder={t('clipping.namePlaceholder')}
                  type="search"
                  value={searchDraft}
                />
                <button
                  disabled={
                    searchDraft.trim().length === 0 ||
                    searchSaveState === 'saving' ||
                    searchTerms.length >= 50
                  }
                  onClick={onAddSearchTerm}
                  type="button"
                >
                  {t('clipping.addNameTimeline')}
                </button>
              </div>
            </div>
            {searchSaveState === 'error' && (
              <p className="name-timeline-error">{t('clipping.nameSaveError')}</p>
            )}
            {nameMarkerGroups.map(
              ({ deathMarkers: nameDeaths, killMarkers: nameKills, markers, term }) => {
                const timelineKey = term.toLocaleLowerCase();
                const isSplit = splitSearchTerms.some(
                  (candidate) => candidate.toLocaleLowerCase() === timelineKey,
                );
                if (!isSplit) {
                  return (
                    <EventTimelineLane
                      emptyLabel={t('clipping.noVisibleNameEvents', { name: term })}
                      events={events}
                      key={timelineKey}
                      label={term}
                      markers={markers}
                      onActivate={activateLogMarker}
                      onRemove={() => onRemoveSearchTerm(term)}
                      onToggleSplit={() => onToggleSearchTermSplit(term)}
                      selectedEvent={selectedEvent}
                      split={false}
                      splitDisabled={searchSaveState === 'saving'}
                    />
                  );
                }
                return (
                  <div className="name-timeline-group" key={timelineKey}>
                    <EventTimelineLane
                      actionLabel={term}
                      emptyLabel={t('clipping.noVisibleNameKills', { name: term })}
                      events={events}
                      label={t('clipping.nameKillTimeline', { name: term })}
                      markers={nameKills}
                      onActivate={activateLogMarker}
                      onRemove={() => onRemoveSearchTerm(term)}
                      onToggleSplit={() => onToggleSearchTermSplit(term)}
                      selectedEvent={selectedEvent}
                      split
                      splitDisabled={searchSaveState === 'saving'}
                    />
                    <EventTimelineLane
                      emptyLabel={t('clipping.noVisibleNameDeaths', { name: term })}
                      events={events}
                      label={t('clipping.nameDeathTimeline', { name: term })}
                      markers={nameDeaths}
                      onActivate={activateLogMarker}
                      selectedEvent={selectedEvent}
                    />
                  </div>
                );
              },
            )}
          </div>
        ) : (
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
                    marker.killStreakTier !== null
                      ? t('synchronization.killStreakAnnouncement', {
                          count: marker.killStreakCount,
                          title: t(`synchronization.killStreakTitles.${marker.killStreakTier}`),
                          time: formatTime(marker.videoTimeSeconds),
                        })
                      : onlyEvent === undefined
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
                      className={`log-timeline__marker log-timeline__marker--${marker.type}${marker.killStreakTier === null ? '' : ` log-timeline__marker--streak log-timeline__marker--streak-${marker.killStreakTier}`}`}
                      key={marker.id}
                      onClick={() => activateLogMarker(marker)}
                      onDoubleClick={(event) => event.stopPropagation()}
                      style={{ left: `${marker.positionRatio * 100}%` }}
                      title={label}
                      type="button"
                    >
                      {marker.killStreakTier !== null ? (
                        <span className="log-timeline__streak-label">
                          {t(`synchronization.killStreakTitles.${marker.killStreakTier}`)}
                        </span>
                      ) : (
                        marker.eventCount > 1 && <span>{marker.eventCount}</span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

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

function buildAlignedMarkers(
  events: readonly BdoEvent[],
  eventId: string | undefined,
  eventSessionTimeSeconds: number | undefined,
  videoTimeSeconds: number,
  timelineWindow: TimelineWindow,
  includeKillStreaks = false,
): readonly LogTimelineMarker[] {
  if (eventId === undefined || eventSessionTimeSeconds === undefined) {
    return [];
  }
  const anchor: SynchronizationAnchorInput = {
    eventId,
    eventSessionTimeSeconds,
    videoTimeSeconds,
  };
  return buildLogTimelineMarkers(
    events,
    (sessionTime) => mapSessionTimeToVideoTime(anchor, sessionTime),
    timelineWindow,
    48,
    includeKillStreaks,
  );
}

function EventTimelineLane({
  actionLabel,
  emptyLabel,
  events,
  label,
  markers,
  onActivate,
  onRemove,
  onToggleSplit,
  selectedEvent,
  split,
  splitDisabled,
}: {
  readonly actionLabel?: string;
  readonly emptyLabel: string;
  readonly events: readonly BdoEvent[];
  readonly label: string;
  readonly markers: readonly LogTimelineMarker[];
  readonly onActivate: (marker: LogTimelineMarker) => void;
  readonly onRemove?: () => void;
  readonly onToggleSplit?: () => void;
  readonly selectedEvent: BdoEvent | undefined;
  readonly split?: boolean;
  readonly splitDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const accessibleLabel = actionLabel ?? label;
  return (
    <div className="clipping-timeline__lane">
      <div className="clipping-timeline__name-label">
        <span className="clipping-timeline__label" title={label}>
          {label}
        </span>
        {onToggleSplit !== undefined && (
          <button
            aria-label={
              split
                ? t('clipping.mergeNameTimeline', { name: accessibleLabel })
                : t('clipping.splitNameTimeline', { name: accessibleLabel })
            }
            aria-pressed={split}
            className="timeline-split-toggle"
            disabled={splitDisabled}
            onClick={onToggleSplit}
            title={split ? t('clipping.mergeTimelineTooltip') : t('clipping.splitTimelineTooltip')}
            type="button"
          >
            <SplitTimelineIcon />
          </button>
        )}
        {onRemove !== undefined && (
          <button
            aria-label={t('clipping.removeNameTimeline', { name: accessibleLabel })}
            className="timeline-remove"
            onClick={onRemove}
            title={t('clipping.removeNameTimeline', { name: accessibleLabel })}
            type="button"
          >
            ×
          </button>
        )}
      </div>
      <div className="log-timeline__track">
        {markers.length === 0 ? (
          <span className="log-timeline__empty">{emptyLabel}</span>
        ) : (
          markers.map((marker) => {
            const onlyEvent =
              marker.eventCount === 1
                ? events.find((event) => event.id === marker.eventIds[0])
                : undefined;
            const markerLabel =
              marker.killStreakTier !== null
                ? t('synchronization.killStreakAnnouncement', {
                    count: marker.killStreakCount,
                    title: t(`synchronization.killStreakTitles.${marker.killStreakTier}`),
                    time: formatTime(marker.videoTimeSeconds),
                  })
                : onlyEvent === undefined
                  ? t('synchronization.eventBundle', {
                      count: marker.eventCount,
                      time: formatTime(marker.videoTimeSeconds),
                    })
                  : `${onlyEvent.clockTime}: ${describeEvent(onlyEvent)}`;
            return (
              <button
                aria-label={markerLabel}
                aria-pressed={
                  selectedEvent !== undefined && marker.eventIds.includes(selectedEvent.id)
                }
                className={`log-timeline__marker log-timeline__marker--${marker.type}${marker.killStreakTier === null ? '' : ` log-timeline__marker--streak log-timeline__marker--streak-${marker.killStreakTier}`}`}
                key={marker.id}
                onClick={() => onActivate(marker)}
                onDoubleClick={(event) => event.stopPropagation()}
                style={{ left: `${marker.positionRatio * 100}%` }}
                title={markerLabel}
                type="button"
              >
                {marker.killStreakTier !== null ? (
                  <span className="log-timeline__streak-label">
                    {t(`synchronization.killStreakTitles.${marker.killStreakTier}`)}
                  </span>
                ) : (
                  marker.eventCount > 1 && <span>{marker.eventCount}</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
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

function formatOptionalTime(seconds: number | undefined): string {
  return seconds === undefined ? '—' : formatTime(seconds);
}

function formatSignedTime(seconds: number): string {
  return `${seconds < 0 ? '−' : '+'}${formatTime(Math.abs(seconds))}`;
}

function formatZoom(factor: number): string {
  return factor < 10 ? factor.toFixed(1) : factor.toFixed(0);
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target instanceof HTMLTextAreaElement || target.isContentEditable) {
    return true;
  }
  if (target.closest('[contenteditable="true"]') !== null) {
    return true;
  }
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }
  return ![
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ].includes(target.type);
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

interface EventSeekRequest {
  readonly playUntilSeconds?: number;
  readonly sequence: number;
  readonly videoTimeSeconds: number;
}

interface ClipDraftRange {
  readonly inPointSeconds?: number;
  readonly outPointSeconds?: number;
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
