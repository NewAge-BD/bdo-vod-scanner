import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PortableProject } from '../../domain/projects';
import {
  FileDropZone,
  importSourceFiles,
  SourceImportError,
  SourceOverview,
  type SourceImportErrorCode,
  type SourceImportResult,
} from '../file-import';
import {
  NativeVideoMetadataInspector,
  type VideoMetadataInspector,
} from '../../infrastructure/media';
import { useProjectStore } from './useProjectStore';

const defaultMetadataInspector = new NativeVideoMetadataInspector();

interface ProjectWorkspaceProps {
  readonly project: PortableProject;
  readonly onBack: () => void;
  readonly metadataInspector?: VideoMetadataInspector;
}

export function ProjectWorkspace({
  project,
  onBack,
  metadataInspector = defaultMetadataInspector,
}: ProjectWorkspaceProps) {
  const { t } = useTranslation();
  const vodFiles = useProjectStore((state) => state.vodFiles);
  const saveSourceImport = useProjectStore((state) => state.saveSourceImport);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<
    SourceImportErrorCode | 'saveFailed' | 'unexpected'
  >();
  const [lastImport, setLastImport] = useState<SourceImportResult>();
  const linkedVodIds = useMemo(() => new Set(vodFiles.keys()), [vodFiles]);

  async function handleFiles(files: readonly File[]) {
    setIsImporting(true);
    setImportError(undefined);
    setLastImport(undefined);

    try {
      const result = await importSourceFiles(
        project,
        files,
        metadataInspector,
        new Date(),
        linkedVodIds,
      );
      if (await saveSourceImport(result.project, result.vodFiles)) {
        setLastImport(result);
      } else {
        setImportError('saveFailed');
      }
    } catch (error: unknown) {
      setImportError(error instanceof SourceImportError ? error.code : 'unexpected');
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <main className="project-workspace" id="main-content">
      <button className="back-button" onClick={onBack} type="button">
        <span aria-hidden="true">←</span> {t('projects.back')}
      </button>
      <p className="section-kicker">{t('projects.workspaceKicker')}</p>
      <h1>{project.name}</h1>

      {importError !== undefined && (
        <div className="import-message import-message--error" role="alert">
          <strong>{t('sourceImport.errorTitle')}</strong>
          <span>{t(`sourceImport.errors.${importError}`)}</span>
        </div>
      )}

      {lastImport !== undefined && (
        <div className="import-results" role="status">
          <p>
            {t('sourceImport.success', {
              events: lastImport.importedLog ? lastImport.eventCount : 0,
              vods: lastImport.importedVodCount,
              relinked: lastImport.relinkedVodCount,
            })}
          </p>
          {lastImport.logIssueCount > 0 && (
            <p className="import-results__warning">
              {t('sourceImport.logWarnings', { count: lastImport.logIssueCount })}
            </p>
          )}
          {lastImport.issues.length > 0 && (
            <ul>
              {lastImport.issues.map((issue, index) => (
                <li key={`${issue.code}-${issue.fileName ?? 'project'}-${index}`}>
                  {t(`sourceImport.issues.${issue.code}`, { fileName: issue.fileName })}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <FileDropZone disabled={isImporting} onFiles={handleFiles} />
      <SourceOverview linkedVodIds={linkedVodIds} project={project} />
    </main>
  );
}
