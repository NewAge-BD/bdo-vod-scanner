import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Clip, PortableProject } from '../../domain/projects';
import {
  createClipExportFileName,
  exportLosslessClip,
  LosslessClipExportError,
  reserveUniqueOutputFile,
  supportsLosslessClipExport,
} from './losslessClipExporter';
import type { ClipExportErrorCode, LosslessClipExportResult } from './types';

interface LosslessClipExportPanelProps {
  readonly project: PortableProject;
  readonly selectedClipIds: ReadonlySet<string>;
  readonly vodFiles: ReadonlyMap<string, File>;
}

interface ExportItemResult {
  readonly clipId: string;
  readonly clipTitle: string;
  readonly fileName?: string;
  readonly result?: LosslessClipExportResult;
  readonly errorCode?: ClipExportErrorCode | 'sourceMissing';
}

type ExportPhase = 'selectingFolder' | 'preparing' | 'analyzing' | 'writing';

export function LosslessClipExportPanel({
  project,
  selectedClipIds,
  vodFiles,
}: LosslessClipExportPanelProps) {
  const { t } = useTranslation();
  const supported = supportsLosslessClipExport();
  const orderedClips = project.clipOrder
    .map((id) => project.clips.find((clip) => clip.id === id))
    .filter((clip): clip is Clip => clip !== undefined);
  const [state, setState] = useState<'idle' | 'selecting' | 'exporting' | 'complete' | 'error'>(
    'idle',
  );
  const [phase, setPhase] = useState<ExportPhase>();
  const [folderMessage, setFolderMessage] = useState<'cancelled' | 'error'>();
  const [activeClipTitle, setActiveClipTitle] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [exportCount, setExportCount] = useState(0);
  const [results, setResults] = useState<readonly ExportItemResult[]>([]);
  const activeController = useRef<AbortController | undefined>(undefined);

  const selectedClips = orderedClips.filter((clip) => selectedClipIds.has(clip.id));

  async function exportClips(clips: readonly Clip[]) {
    if (!supported || window.showDirectoryPicker === undefined || clips.length === 0) {
      return;
    }

    setState('selecting');
    setPhase('selectingFolder');
    setFolderMessage(undefined);
    setResults([]);
    setExportCount(clips.length);

    let directory;
    try {
      directory = await window.showDirectoryPicker({
        id: 'bdo-vod-scanner-clips',
        mode: 'readwrite',
        startIn: 'videos',
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setFolderMessage('cancelled');
        setState('idle');
        setPhase(undefined);
        return;
      }
      setFolderMessage('error');
      setState('error');
      setPhase(undefined);
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    setState('exporting');
    setPhase('preparing');
    setCompletedCount(0);
    setProgress(0);
    setResults([]);
    const nextResults: ExportItemResult[] = [];

    for (const [index, clip] of clips.entries()) {
      if (controller.signal.aborted) {
        break;
      }
      setActiveClipTitle(clip.title);
      setCompletedCount(index);
      setProgress(0);
      setPhase('preparing');
      const source = vodFiles.get(clip.vodId);
      if (source === undefined) {
        nextResults.push({ clipId: clip.id, clipTitle: clip.title, errorCode: 'sourceMissing' });
        setResults([...nextResults]);
        continue;
      }

      let fileName: string | undefined;
      try {
        const output = await reserveUniqueOutputFile(
          directory,
          createClipExportFileName(project.sessionDate, clip.title, clip.matchingEventIds.length),
        );
        fileName = output.fileName;
        const result = await exportLosslessClip(
          {
            source,
            destination: output.handle,
            requestedInSeconds: clip.inPointSeconds,
            requestedOutSeconds: clip.outPointSeconds,
          },
          {
            signal: controller.signal,
            onPhase: setPhase,
            onProgress: setProgress,
          },
        );
        nextResults.push({ clipId: clip.id, clipTitle: clip.title, fileName, result });
      } catch (error: unknown) {
        if (fileName !== undefined) {
          await directory.removeEntry(fileName).catch(() => undefined);
        }
        nextResults.push({
          clipId: clip.id,
          clipTitle: clip.title,
          fileName,
          errorCode: error instanceof LosslessClipExportError ? error.code : 'unexpected',
        });
      }
      setResults([...nextResults]);
    }

    activeController.current = undefined;
    setActiveClipTitle(undefined);
    setPhase(undefined);
    setCompletedCount(nextResults.length);
    setProgress(1);
    setState(nextResults.some((result) => result.errorCode !== undefined) ? 'error' : 'complete');
  }

  const successfulCount = results.filter((result) => result.result !== undefined).length;

  return (
    <section className="lossless-export" aria-labelledby="lossless-export-title">
      <div className="lossless-export__heading">
        <div>
          <p className="section-kicker">{t('clipExport.kicker')}</p>
          <h3 id="lossless-export-title">{t('clipExport.title')}</h3>
        </div>
        <span className="lossless-export__badge">{t('clipExport.experimental')}</span>
      </div>
      <p className="lossless-export__summary">{t('clipExport.summary')}</p>
      <p className="lossless-export__boundary-note">{t('clipExport.boundaryNote')}</p>
      {!supported && <p className="lossless-export__unsupported">{t('clipExport.unsupported')}</p>}
      <div className="lossless-export__actions">
        <button
          className="lossless-export__button lossless-export__button--selected"
          disabled={
            !supported ||
            selectedClips.length === 0 ||
            state === 'selecting' ||
            state === 'exporting'
          }
          onClick={() => void exportClips(selectedClips)}
          type="button"
        >
          {t('clipExport.exportSelected', { count: selectedClips.length })}
        </button>
        <button
          className="lossless-export__button lossless-export__button--all"
          disabled={
            !supported ||
            orderedClips.length === 0 ||
            state === 'selecting' ||
            state === 'exporting'
          }
          onClick={() => void exportClips(orderedClips)}
          type="button"
        >
          {t('clipExport.exportAll')}
        </button>
        {state === 'exporting' && (
          <button onClick={() => activeController.current?.abort()} type="button">
            {t('common.cancel')}
          </button>
        )}
      </div>
      {(state === 'selecting' || state === 'exporting') && phase !== undefined && (
        <div className="lossless-export__progress" role="status">
          <label>
            <span>
              {t(`clipExport.phases.${phase}`, {
                completed: completedCount,
                count: exportCount,
                title: activeClipTitle,
              })}
            </span>
            {phase === 'writing' ? (
              <progress aria-label={t('clipExport.writeProgress')} max="1" value={progress} />
            ) : (
              <progress aria-label={t('clipExport.analysisProgress')} />
            )}
          </label>
        </div>
      )}
      {folderMessage !== undefined && (
        <p className="lossless-export__unsupported" role="status">
          {t(`clipExport.folder.${folderMessage}`)}
        </p>
      )}
      {state === 'error' && results.length === 0 && folderMessage === undefined && (
        <p className="lossless-export__unsupported" role="alert">
          {t('clipExport.setupError')}
        </p>
      )}
      {(state === 'complete' || (state === 'error' && results.length > 0)) && (
        <p className="lossless-export__result-summary" role="status">
          {t('clipExport.resultSummary', {
            count: exportCount,
            failed: exportCount - successfulCount,
            successful: successfulCount,
          })}
        </p>
      )}
      {results.length > 0 && (
        <ul className="lossless-export__results">
          {results.map((item) => (
            <li key={item.clipId}>
              <strong>{item.clipTitle}</strong>
              {item.result !== undefined && item.fileName !== undefined ? (
                <span>
                  {t('clipExport.completedItem', {
                    effectiveIn: formatSeconds(item.result.effectiveInSeconds),
                    effectiveOut: formatSeconds(item.result.effectiveOutSeconds),
                    fileName: item.fileName,
                  })}
                </span>
              ) : (
                <span className="lossless-export__item-error">
                  {t(`clipExport.errors.${item.errorCode ?? 'unexpected'}`)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(3)} s`;
}
