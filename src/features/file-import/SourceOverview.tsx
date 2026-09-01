import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { parseBdoLog } from '../../domain/events';
import type { PortableProject, VodReference } from '../../domain/projects';
import { TrashIcon } from '../../shared/components/TrashIcon';

interface SourceOverviewProps {
  readonly project: PortableProject;
  readonly linkedVodIds: ReadonlySet<string>;
  readonly onDeleteVod: (vodId: string) => void;
  readonly onRenameVod: (vodId: string, displayName: string) => Promise<boolean>;
}

export function SourceOverview({
  project,
  linkedVodIds,
  onDeleteVod,
  onRenameVod,
}: SourceOverviewProps) {
  const { t } = useTranslation();
  const parsedLog = useMemo(() => {
    if (project.rawLog === null || project.sessionDate === null) {
      return undefined;
    }
    return parseBdoLog(`${project.sessionDate}.log`, project.rawLog);
  }, [project.rawLog, project.sessionDate]);

  if (parsedLog === undefined && project.vods.length === 0) {
    return null;
  }

  return (
    <section className="source-overview" aria-labelledby="source-overview-title">
      <div className="source-overview__heading">
        <div>
          <p className="section-kicker">{t('sources.kicker')}</p>
          <h2 id="source-overview-title">{t('sources.title')}</h2>
        </div>
        <p>{t('sources.privateNote')}</p>
      </div>

      {parsedLog !== undefined && project.sessionDate !== null && (
        <article className="source-card source-card--log">
          <div className="source-card__identity">
            <span aria-hidden="true" className="source-card__type">
              LOG
            </span>
            <div>
              <h3>{project.sessionDate}.log</h3>
              <p>{t('sources.embeddedLog')}</p>
            </div>
          </div>
          <dl className="source-card__facts">
            <Fact label={t('sources.events')} value={String(parsedLog.events.length)} />
            <Fact label={t('sources.date')} value={project.sessionDate} />
            <Fact
              label={t('sources.parseWarnings')}
              value={String(parsedLog.issues.length)}
              warning={parsedLog.issues.length > 0}
            />
          </dl>
        </article>
      )}

      {project.vods.length > 0 && (
        <div className="vod-list">
          {project.vods.map((vod) => (
            <VodCard
              key={vod.id}
              linked={linkedVodIds.has(vod.id)}
              onDelete={() => onDeleteVod(vod.id)}
              onRename={(displayName) => onRenameVod(vod.id, displayName)}
              vod={vod}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VodCard({
  vod,
  linked,
  onDelete,
  onRename,
}: {
  readonly vod: VodReference;
  readonly linked: boolean;
  readonly onDelete: () => void;
  readonly onRename: (displayName: string) => Promise<boolean>;
}) {
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState(vod.displayName);
  const numberFormatter = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    if (await onRename(nameDraft)) {
      setIsEditing(false);
    }
    setIsSaving(false);
  }

  return (
    <article className="source-card source-card--vod">
      <div className="source-card__identity">
        <span aria-hidden="true" className="source-card__type">
          MP4
        </span>
        <div>
          {isEditing ? (
            <form className="vod-rename-form" onSubmit={(event) => void saveName(event)}>
              <label className="visually-hidden" htmlFor={`vod-name-${vod.id}`}>
                {t('sources.vodName')}
              </label>
              <input
                autoFocus
                id={`vod-name-${vod.id}`}
                maxLength={255}
                onChange={(event) => setNameDraft(event.target.value)}
                required
                value={nameDraft}
              />
              <button disabled={isSaving} type="submit">
                {isSaving ? t('sources.savingVodName') : t('sources.saveVodName')}
              </button>
              <button
                disabled={isSaving}
                onClick={() => {
                  setNameDraft(vod.displayName);
                  setIsEditing(false);
                }}
                type="button"
              >
                {t('common.cancel')}
              </button>
            </form>
          ) : (
            <div className="source-card__title-row">
              <h3>{vod.displayName}</h3>
              <button
                aria-label={t('sources.renameVod', { name: vod.displayName })}
                className="vod-rename-button"
                onClick={() => setIsEditing(true)}
                type="button"
              >
                {t('common.rename')}
              </button>
            </div>
          )}
          <p>{vod.fileName}</p>
        </div>
        <span
          className={
            vod.synchronizationAnchor === null ? 'sync-badge' : 'sync-badge sync-badge--complete'
          }
        >
          {vod.synchronizationAnchor === null ? t('sources.syncRequired') : t('sources.synced')}
        </span>
        <button
          aria-label={t('sources.deleteVod', { name: vod.displayName })}
          className="vod-delete-button"
          onClick={onDelete}
          title={t('sources.deleteVod', { name: vod.displayName })}
          type="button"
        >
          <TrashIcon />
        </button>
      </div>
      <dl className="source-card__facts source-card__facts--video">
        <Fact label={t('sources.size')} value={formatBytes(vod.fileSizeBytes, numberFormatter)} />
        <Fact label={t('sources.duration')} value={formatDuration(vod.durationSeconds)} />
        <Fact label={t('sources.resolution')} value={formatResolution(vod)} />
        <Fact
          label={t('sources.frameRate')}
          value={formatFrameRate(vod, numberFormatter, linked, t)}
        />
        <Fact label={t('sources.codecs')} value={formatCodecs(vod, linked, t)} />
        <Fact
          label={t('sources.localFile')}
          value={linked ? t('sources.linked') : t('sources.reselectRequired')}
          warning={!linked}
        />
      </dl>
    </article>
  );
}

function Fact({
  label,
  value,
  warning = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly warning?: boolean;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={warning ? 'fact-warning' : undefined}>{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number, formatter: Intl.NumberFormat): string {
  if (bytes < 1_000_000) {
    return `${formatter.format(bytes / 1_000)} KB`;
  }
  if (bytes < 1_000_000_000) {
    return `${formatter.format(bytes / 1_000_000)} MB`;
  }
  return `${formatter.format(bytes / 1_000_000_000)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) {
    return '—';
  }
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatResolution(vod: VodReference): string {
  return vod.width === null || vod.height === null ? '—' : `${vod.width} × ${vod.height}`;
}

function formatFrameRate(
  vod: VodReference,
  formatter: Intl.NumberFormat,
  linked: boolean,
  t: (key: string) => string,
): string {
  if (vod.nominalFrameRate === null) {
    return t(linked ? 'sources.metadataInspectionFailed' : 'sources.metadataReselectRequired');
  }
  return `${formatter.format(vod.nominalFrameRate)} FPS${vod.variableFrameRate === true ? ' VFR' : ''}`;
}

function formatCodecs(vod: VodReference, linked: boolean, t: (key: string) => string): string {
  const codecs = [vod.videoCodec, vod.audioCodec].filter(
    (codec): codec is string => codec !== null,
  );
  return codecs.length === 0
    ? t(linked ? 'sources.metadataInspectionFailed' : 'sources.metadataReselectRequired')
    : codecs.join(' / ');
}
