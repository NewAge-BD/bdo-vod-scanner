import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createDaVinciTimeline, type DaVinciTimelineSettings } from '../../domain/davinci-export';
import type { PortableProject } from '../../domain/projects';

interface DavinciExportPanelProps {
  readonly project: PortableProject;
  readonly onDefaultsChange: (settings: DaVinciTimelineSettings) => Promise<boolean>;
}

export function DavinciExportPanel({ project, onDefaultsChange }: DavinciExportPanelProps) {
  const { t } = useTranslation();
  const [settings, setSettings] = useState(project.davinciDefaults);
  const [exportState, setExportState] = useState<'idle' | 'saving' | 'error'>('idle');

  async function exportTimeline() {
    if (!settingsAreValid(settings)) {
      setExportState('error');
      return;
    }
    setExportState('saving');
    if (!(await onDefaultsChange(settings))) {
      setExportState('error');
      return;
    }
    try {
      const timeline = createDaVinciTimeline(project, settings);
      const blob = new Blob([timeline.content], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = timeline.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState('idle');
    } catch {
      setExportState('error');
    }
  }

  return (
    <section className="davinci-export" aria-labelledby="davinci-export-title">
      <div className="davinci-export__heading">
        <div>
          <p className="section-kicker">{t('davinci.kicker')}</p>
          <h3 id="davinci-export-title">{t('davinci.title')}</h3>
        </div>
        <p>{t('davinci.summary')}</p>
      </div>
      <div className="davinci-export__controls">
        <label>
          <span>{t('davinci.frameRate')}</span>
          <input
            aria-label={t('davinci.frameRate')}
            max="240"
            min="1"
            onChange={(event) =>
              setSettings((current) => ({ ...current, frameRate: Number(event.target.value) }))
            }
            step="0.001"
            type="number"
            value={settings.frameRate}
          />
        </label>
        <label>
          <span>{t('davinci.width')}</span>
          <input
            aria-label={t('davinci.width')}
            max="16384"
            min="1"
            onChange={(event) =>
              setSettings((current) => ({ ...current, width: Number(event.target.value) }))
            }
            step="1"
            type="number"
            value={settings.width}
          />
        </label>
        <label>
          <span>{t('davinci.height')}</span>
          <input
            aria-label={t('davinci.height')}
            max="16384"
            min="1"
            onChange={(event) =>
              setSettings((current) => ({ ...current, height: Number(event.target.value) }))
            }
            step="1"
            type="number"
            value={settings.height}
          />
        </label>
        <button
          className="davinci-export__button"
          disabled={project.clips.length === 0 || exportState === 'saving'}
          onClick={() => void exportTimeline()}
          type="button"
        >
          {exportState === 'saving' ? t('davinci.exporting') : t('davinci.export')}
        </button>
      </div>
      <p className="davinci-export__relink-note">{t('davinci.relinkNote')}</p>
      <details className="davinci-export__how-to">
        <summary>{t('davinci.howToTitle')}</summary>
        <ol>
          <li>{t('davinci.howToPrepare')}</li>
          <li>{t('davinci.howToExport')}</li>
          <li>{t('davinci.howToImport')}</li>
          <li>{t('davinci.howToSelect')}</li>
          <li>{t('davinci.howToRelink')}</li>
        </ol>
      </details>
      {exportState === 'error' && (
        <p className="davinci-export__error" role="alert">
          {t('davinci.error')}
        </p>
      )}
    </section>
  );
}

function settingsAreValid(settings: DaVinciTimelineSettings): boolean {
  return (
    Number.isFinite(settings.frameRate) &&
    settings.frameRate > 0 &&
    settings.frameRate <= 240 &&
    Number.isInteger(settings.width) &&
    settings.width > 0 &&
    settings.width <= 16_384 &&
    Number.isInteger(settings.height) &&
    settings.height > 0 &&
    settings.height <= 16_384
  );
}
