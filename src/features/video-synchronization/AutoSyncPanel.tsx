import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AutoSyncRegion } from '../../domain/auto-sync';
import type { BdoEvent } from '../../domain/events';
import {
  scanVideoForSynchronization,
  type AutoSyncScanProgress,
  type AutoSyncScanResult,
} from '../../infrastructure/ocr';

export function AutoSyncPanel({
  events,
  file,
  isSelectingRegion,
  onRegionSelectionChange,
  onUseSuggestion,
  region,
  startTimeSeconds,
}: {
  readonly events: readonly BdoEvent[];
  readonly file: File;
  readonly isSelectingRegion: boolean;
  readonly onRegionSelectionChange: (selecting: boolean) => void;
  readonly onUseSuggestion: (result: AutoSyncScanResult) => void;
  readonly region: AutoSyncRegion | undefined;
  readonly startTimeSeconds: number;
}) {
  const { t } = useTranslation();
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const [progress, setProgress] = useState<AutoSyncScanProgress>();
  const [result, setResult] = useState<AutoSyncScanResult>();
  const [status, setStatus] = useState<'idle' | 'scanning' | 'not-found' | 'error'>('idle');

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    [],
  );

  async function startScan() {
    if (region === undefined || status === 'scanning') {
      return;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setResult(undefined);
    setProgress(undefined);
    setStatus('scanning');
    try {
      const nextResult = await scanVideoForSynchronization({
        events,
        file,
        onProgress: setProgress,
        region,
        signal: controller.signal,
        startTimeSeconds,
      });
      if (controller.signal.aborted) {
        setStatus('idle');
        return;
      }
      setResult(nextResult);
      if (nextResult !== undefined) {
        onUseSuggestion(nextResult);
      }
      setStatus(nextResult === undefined ? 'not-found' : 'idle');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setStatus('idle');
      } else {
        setStatus('error');
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = undefined;
      }
    }
  }

  function cancelScan() {
    abortControllerRef.current?.abort();
  }

  function toggleRegionSelection() {
    setResult(undefined);
    setStatus('idle');
    onRegionSelectionChange(!isSelectingRegion);
  }

  const percentage =
    progress === undefined || progress.total === 0
      ? 0
      : Math.round((progress.completed / progress.total) * 100);

  return (
    <section className="auto-sync-panel" aria-labelledby="auto-sync-title" data-guide="auto-sync">
      <div className="auto-sync-panel__heading">
        <div>
          <span>{t('autoSync.experimental')}</span>
          <h3 id="auto-sync-title">{t('autoSync.title')}</h3>
        </div>
        <span>{t('autoSync.localOnly')}</span>
      </div>
      <p>{t('autoSync.description')}</p>
      <div className="auto-sync-panel__actions">
        <button
          aria-pressed={isSelectingRegion}
          disabled={status === 'scanning'}
          onClick={toggleRegionSelection}
          type="button"
        >
          {region === undefined ? t('autoSync.defineRegion') : t('autoSync.redrawRegion')}
        </button>
        <button
          className="button button--primary"
          disabled={region === undefined || status === 'scanning' || isSelectingRegion}
          onClick={() => void startScan()}
          type="button"
        >
          {t('autoSync.start')}
        </button>
      </div>
      {isSelectingRegion && <p className="auto-sync-panel__notice">{t('autoSync.drawHint')}</p>}
      {region !== undefined && !isSelectingRegion && status === 'idle' && result === undefined && (
        <p className="auto-sync-panel__notice auto-sync-panel__notice--ready">
          {t('autoSync.regionReady')}
        </p>
      )}
      {status === 'scanning' && (
        <div className="auto-sync-progress" aria-live="polite">
          <div>
            <span>{t(`autoSync.phases.${progress?.phase ?? 'loading'}`)}</span>
            <strong>{percentage}%</strong>
          </div>
          <progress max={100} value={percentage} />
          <button onClick={cancelScan} type="button">
            {t('autoSync.cancel')}
          </button>
        </div>
      )}
      {status === 'not-found' && (
        <p className="auto-sync-panel__notice auto-sync-panel__notice--error">
          {t('autoSync.notFound')}
        </p>
      )}
      {status === 'error' && (
        <p className="auto-sync-panel__notice auto-sync-panel__notice--error">
          {t('autoSync.error')}
        </p>
      )}
      {result !== undefined && (
        <div className="auto-sync-result">
          <img alt={t('autoSync.previewAlt')} src={result.previewDataUrl} />
          <div>
            <strong>{t('autoSync.matchFound')}</strong>
            <p>{result.event.rawLine}</p>
            <span>
              {t('autoSync.confidence', { confidence: Math.round(result.confidence * 100) })}
            </span>
            <p className="auto-sync-result__fine-tune">{t('autoSync.fineTune')}</p>
            <button onClick={() => onUseSuggestion(result)} type="button">
              {t('autoSync.showDetectedFrameAgain')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
