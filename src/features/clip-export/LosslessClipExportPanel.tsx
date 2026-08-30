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
  readonly vodFiles: ReadonlyMap<string, File>;
}

interface ExportItemResult {
  readonly clipId: string;
  readonly clipTitle: string;
  readonly fileName?: string;
  readonly result?: LosslessClipExportResult;
  readonly errorCode?: ClipExportErrorCode | 'sourceMissing';
}

export function LosslessClipExportPanel({ project, vodFiles }: LosslessClipExportPanelProps) {
  const { t } = useTranslation();
  const supported = supportsLosslessClipExport();
  const orderedClips = project.clipOrder
    .map((id) => project.clips.find((clip) => clip.id === id))
    .filter((clip): clip is Clip => clip !== undefined);
  const [state, setState] = useState<'idle' | 'exporting' | 'complete' | 'error'>('idle');
  const [activeClipTitle, setActiveClipTitle] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [results, setResults] = useState<readonly ExportItemResult[]>([]);
  const activeController = useRef<AbortController | undefined>(undefined);

  async function exportAllClips() {
    if (!supported || window.showDirectoryPicker === undefined || orderedClips.length === 0) {
      return;
    }

    let directory;
    try {
      directory = await window.showDirectoryPicker({
        id: 'bdo-vod-scanner-clips',
        mode: 'readwrite',
        startIn: 'videos',
      });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      setState('error');
      return;
    }

    const controller = new AbortController();
    activeController.current = controller;
    setState('exporting');
    setCompletedCount(0);
    setProgress(0);
    setResults([]);
    const nextResults: ExportItemResult[] = [];

    for (const [index, clip] of orderedClips.entries()) {
      if (controller.signal.aborted) {
        break;
      }
      setActiveClipTitle(clip.title);
      setCompletedCount(index);
      setProgress(0);
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
          { signal: controller.signal, onProgress: setProgress },
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
          className="lossless-export__button"
          disabled={!supported || orderedClips.length === 0 || state === 'exporting'}
          onClick={() => void exportAllClips()}
          type="button"
        >
          {state === 'exporting' ? t('clipExport.exporting') : t('clipExport.exportAll')}
        </button>
        {state === 'exporting' && (
          <button onClick={() => activeController.current?.abort()} type="button">
            {t('common.cancel')}
          </button>
        )}
      </div>
      {state === 'exporting' && (
        <div className="lossless-export__progress" role="status">
          <label>
            <span>
              {t('clipExport.progress', {
                completed: completedCount,
                count: orderedClips.length,
                title: activeClipTitle,
              })}
            </span>
            <progress max="1" value={progress} />
          </label>
        </div>
      )}
      {state === 'error' && results.length === 0 && (
        <p className="lossless-export__unsupported" role="alert">
          {t('clipExport.setupError')}
        </p>
      )}
      {(state === 'complete' || (state === 'error' && results.length > 0)) && (
        <p className="lossless-export__result-summary" role="status">
          {t('clipExport.resultSummary', {
            count: orderedClips.length,
            failed: orderedClips.length - successfulCount,
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
