import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Clip, PortableProject } from '../../domain/projects';

interface ClipPanelProps {
  readonly project: PortableProject;
  readonly onCollapsedChange: (collapsed: boolean) => Promise<boolean>;
  readonly onDeleteClip: (clipId: string) => Promise<boolean>;
  readonly onRenameClip: (clipId: string, title: string) => Promise<boolean>;
}

export function ClipPanel({
  project,
  onCollapsedChange,
  onDeleteClip,
  onRenameClip,
}: ClipPanelProps) {
  const { t } = useTranslation();
  const orderedClips = project.clipOrder
    .map((id) => project.clips.find((clip) => clip.id === id))
    .filter((clip): clip is Clip => clip !== undefined);
  const collapsed = project.uiState.clipPanelCollapsed;

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

      {!collapsed &&
        (orderedClips.length === 0 ? (
          <p className="clip-panel__empty">{t('clips.empty')}</p>
        ) : (
          <div className="clip-list">
            {orderedClips.map((clip) => (
              <ClipCard
                clip={clip}
                key={clip.id}
                onDelete={onDeleteClip}
                onRename={onRenameClip}
                perspectiveName={
                  project.vods.find((vod) => vod.id === clip.vodId)?.displayName ??
                  t('clips.missingPerspective')
                }
              />
            ))}
          </div>
        ))}
    </section>
  );
}

function ClipCard({
  clip,
  perspectiveName,
  onDelete,
  onRename,
}: {
  readonly clip: Clip;
  readonly perspectiveName: string;
  readonly onDelete: (clipId: string) => Promise<boolean>;
  readonly onRename: (clipId: string, title: string) => Promise<boolean>;
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
    <article className="clip-card">
      <div className="clip-card__title-row">
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
