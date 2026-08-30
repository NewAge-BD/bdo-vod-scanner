import { useState, type DragEvent as ReactDragEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { DaVinciTimelineSettings } from '../../domain/davinci-export';
import type { Clip, PortableProject } from '../../domain/projects';
import { DavinciExportPanel } from '../davinci-export';

interface ClipPanelProps {
  readonly linkedVodIds: ReadonlySet<string>;
  readonly project: PortableProject;
  readonly onCollapsedChange: (collapsed: boolean) => Promise<boolean>;
  readonly onDavinciDefaultsChange: (settings: DaVinciTimelineSettings) => Promise<boolean>;
  readonly onDeleteClip: (clipId: string) => Promise<boolean>;
  readonly onPreviewClip: (clip: Clip) => void;
  readonly onReorderClips: (clipOrder: readonly string[]) => Promise<boolean>;
  readonly onRenameClip: (clipId: string, title: string) => Promise<boolean>;
}

export function ClipPanel({
  linkedVodIds,
  project,
  onCollapsedChange,
  onDavinciDefaultsChange,
  onDeleteClip,
  onPreviewClip,
  onReorderClips,
  onRenameClip,
}: ClipPanelProps) {
  const { t } = useTranslation();
  const orderedClips = project.clipOrder
    .map((id) => project.clips.find((clip) => clip.id === id))
    .filter((clip): clip is Clip => clip !== undefined);
  const collapsed = project.uiState.clipPanelCollapsed;
  const [draggedClipId, setDraggedClipId] = useState<string>();
  const [dropTargetClipId, setDropTargetClipId] = useState<string>();
  const [reorderState, setReorderState] = useState<'idle' | 'saving' | 'error'>('idle');

  async function saveOrder(clipOrder: readonly string[]) {
    setReorderState('saving');
    const saved = await onReorderClips(clipOrder);
    setReorderState(saved ? 'idle' : 'error');
  }

  function moveClip(clipId: string, direction: -1 | 1) {
    const currentIndex = orderedClips.findIndex((clip) => clip.id === clipId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedClips.length) {
      return;
    }
    const nextOrder = orderedClips.map((clip) => clip.id);
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex]!,
      nextOrder[currentIndex]!,
    ];
    void saveOrder(nextOrder);
  }

  function dropClip(targetClipId: string) {
    if (draggedClipId === undefined || draggedClipId === targetClipId) {
      setDraggedClipId(undefined);
      setDropTargetClipId(undefined);
      return;
    }
    const nextOrder = orderedClips.map((clip) => clip.id);
    const sourceIndex = nextOrder.indexOf(draggedClipId);
    const targetIndex = nextOrder.indexOf(targetClipId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    nextOrder.splice(sourceIndex, 1);
    nextOrder.splice(targetIndex, 0, draggedClipId);
    setDraggedClipId(undefined);
    setDropTargetClipId(undefined);
    void saveOrder(nextOrder);
  }

  return (
    <section className="clip-panel" aria-labelledby="clip-panel-title">
      <div className="clip-panel__heading">
        <div>
          <p className="section-kicker">{t('clips.kicker')}</p>
          <h3 id="clip-panel-title">{t('clips.title')}</h3>
        </div>
        <div className="clip-panel__heading-actions">
          <span>{t('clips.count', { count: orderedClips.length })}</span>
          <button onClick={() => void onCollapsedChange(!collapsed)} type="button">
            {collapsed ? t('clips.expand') : t('clips.collapse')}
          </button>
        </div>
      </div>
      {reorderState === 'saving' && (
        <p className="clip-panel__reorder-state" role="status">
          {t('clips.reorderSaving')}
        </p>
      )}
      {reorderState === 'error' && (
        <p className="clip-panel__reorder-state clip-panel__reorder-state--error" role="alert">
          {t('clips.reorderError')}
        </p>
      )}

      {!collapsed &&
        (orderedClips.length === 0 ? (
          <p className="clip-panel__empty">{t('clips.empty')}</p>
        ) : (
          <div className="clip-list" role="list">
            {orderedClips.map((clip, index) => (
              <ClipCard
                clip={clip}
                dragDisabled={reorderState === 'saving'}
                dragging={clip.id === draggedClipId}
                dropTarget={clip.id === dropTargetClipId && clip.id !== draggedClipId}
                key={clip.id}
                moveDownDisabled={index === orderedClips.length - 1 || reorderState === 'saving'}
                moveUpDisabled={index === 0 || reorderState === 'saving'}
                onDragEnd={() => {
                  setDraggedClipId(undefined);
                  setDropTargetClipId(undefined);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDropTargetClipId(clip.id);
                }}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', clip.id);
                  setDraggedClipId(clip.id);
                  setReorderState('idle');
                }}
                onDelete={onDeleteClip}
                onDrop={() => dropClip(clip.id)}
                onMoveDown={() => moveClip(clip.id, 1)}
                onMoveUp={() => moveClip(clip.id, -1)}
                onPreview={() => onPreviewClip(clip)}
                onRename={onRenameClip}
                perspectiveName={
                  project.vods.find((vod) => vod.id === clip.vodId)?.displayName ??
                  t('clips.missingPerspective')
                }
                previewDisabled={!linkedVodIds.has(clip.vodId)}
              />
            ))}
          </div>
        ))}
      {!collapsed && (
        <DavinciExportPanel onDefaultsChange={onDavinciDefaultsChange} project={project} />
      )}
    </section>
  );
}

function ClipCard({
  clip,
  perspectiveName,
  dragging,
  dragDisabled,
  dropTarget,
  onDelete,
  moveDownDisabled,
  moveUpDisabled,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMoveDown,
  onMoveUp,
  onPreview,
  onRename,
  previewDisabled,
}: {
  readonly clip: Clip;
  readonly perspectiveName: string;
  readonly dragging: boolean;
  readonly dragDisabled: boolean;
  readonly dropTarget: boolean;
  readonly onDelete: (clipId: string) => Promise<boolean>;
  readonly moveDownDisabled: boolean;
  readonly moveUpDisabled: boolean;
  readonly onDragEnd: () => void;
  readonly onDragOver: (event: ReactDragEvent<HTMLElement>) => void;
  readonly onDragStart: (event: ReactDragEvent<HTMLButtonElement>) => void;
  readonly onDrop: () => void;
  readonly onMoveDown: () => void;
  readonly onMoveUp: () => void;
  readonly onPreview: () => void;
  readonly onRename: (clipId: string, title: string) => Promise<boolean>;
  readonly previewDisabled: boolean;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(clip.title);

  function saveTitle() {
    const normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
      setTitle(clip.title);
      return;
    }
    if (normalizedTitle !== clip.title) {
      void onRename(clip.id, normalizedTitle);
    }
  }

  return (
    <article
      aria-label={t('clips.clipCard', { title: clip.title })}
      className={`clip-card${dragging ? ' clip-card--dragging' : ''}${dropTarget ? ' clip-card--drop-target' : ''}`}
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      role="listitem"
    >
      <div className="clip-card__title-row">
        <button
          aria-label={t('clips.dragClip', { title: clip.title })}
          className="clip-card__drag-handle"
          disabled={dragDisabled}
          draggable={!dragDisabled}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          title={t('clips.dragClipTooltip')}
          type="button"
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <label>
          <span>{t('clips.clipTitle')}</span>
          <input
            maxLength={240}
            onBlur={saveTitle}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.currentTarget.blur();
              }
            }}
            value={title}
          />
        </label>
        <div className="clip-card__move-actions">
          <button
            aria-label={t('clips.moveClipUp', { title: clip.title })}
            disabled={moveUpDisabled}
            onClick={onMoveUp}
            title={t('clips.moveUp')}
            type="button"
          >
            ↑
          </button>
          <button
            aria-label={t('clips.moveClipDown', { title: clip.title })}
            disabled={moveDownDisabled}
            onClick={onMoveDown}
            title={t('clips.moveDown')}
            type="button"
          >
            ↓
          </button>
        </div>
        <button
          className="clip-card__preview"
          disabled={previewDisabled}
          onClick={onPreview}
          title={previewDisabled ? t('clips.previewUnavailable') : t('clips.previewTooltip')}
          type="button"
        >
          <span aria-hidden="true">▶</span> {t('clips.preview')}
        </button>
        <button
          className="clip-card__delete"
          onClick={() => {
            if (window.confirm(t('clips.deleteConfirmation', { title: clip.title }))) {
              void onDelete(clip.id);
            }
          }}
          type="button"
        >
          {t('common.delete')}
        </button>
      </div>
      <dl>
        <div>
          <dt>{t('clips.perspective')}</dt>
          <dd>{perspectiveName}</dd>
        </div>
        <div>
          <dt>{t('clips.range')}</dt>
          <dd>
            {formatTime(clip.inPointSeconds)} – {formatTime(clip.outPointSeconds)}
          </dd>
        </div>
        <div>
          <dt>{t('clips.duration')}</dt>
          <dd>{formatDuration(clip.outPointSeconds - clip.inPointSeconds)}</dd>
        </div>
        <div>
          <dt>{t('clips.matchingEvents')}</dt>
          <dd>{clip.matchingEventIds.length}</dd>
        </div>
      </dl>
    </article>
  );
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${remainingSeconds
    .toFixed(3)
    .padStart(6, '0')}`;
}

function formatDuration(seconds: number): string {
  return `${seconds.toFixed(3)} s`;
}
