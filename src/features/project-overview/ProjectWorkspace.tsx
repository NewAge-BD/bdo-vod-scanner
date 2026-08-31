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
import { VideoSynchronization } from '../video-synchronization';
import { VodDeleteDialog } from './VodDeleteDialog';

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
  const saveSynchronization = useProjectStore((state) => state.saveSynchronization);
  const saveVodSearchTerms = useProjectStore((state) => state.saveVodSearchTerms);
  const saveVodSplitSearchTerms = useProjectStore((state) => state.saveVodSplitSearchTerms);
  const createClip = useProjectStore((state) => state.createClip);
  const updateClip = useProjectStore((state) => state.updateClip);
  const deleteClip = useProjectStore((state) => state.deleteClip);
  const reorderClips = useProjectStore((state) => state.reorderClips);
  const saveDavinciDefaults = useProjectStore((state) => state.saveDavinciDefaults);
  const deleteVod = useProjectStore((state) => state.deleteVod);
  const renameVod = useProjectStore((state) => state.renameVod);
  const setClipPanelCollapsed = useProjectStore((state) => state.setClipPanelCollapsed);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<
    SourceImportErrorCode | 'saveFailed' | 'unexpected'
  >();
  const [lastImport, setLastImport] = useState<SourceImportResult>();
  const [isClipping, setIsClipping] = useState(false);
  const [pendingVodDeletion, setPendingVodDeletion] = useState<PendingVodDeletion>();
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

  async function handleDeleteVod(vodId: string): Promise<boolean> {
    const vod = project.vods.find((candidate) => candidate.id === vodId);
    if (vod === undefined) {
      return false;
    }
    const clipCount = project.clips.filter((clip) => clip.vodId === vodId).length;
    return new Promise((resolve) => {
      setPendingVodDeletion({
        message: t('sources.deleteVodConfirmation', {
          count: clipCount,
          name: vod.displayName,
        }),
        resolve,
        vodId,
      });
    });
  }

  function cancelVodDeletion() {
    pendingVodDeletion?.resolve(false);
    setPendingVodDeletion(undefined);
  }

  async function confirmVodDeletion() {
    if (pendingVodDeletion === undefined) {
      return;
    }
    const request = pendingVodDeletion;
    const deleted = await deleteVod(project.id, request.vodId);
    request.resolve(deleted);
    setPendingVodDeletion(undefined);
  }

  function handleClippingModeChange(active: boolean) {
    if (active) {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
    setIsClipping(active);
  }

  return (
    <main
      className={`project-workspace${isClipping ? ' project-workspace--clipping' : ''}`}
      id="main-content"
    >
      {!isClipping && (
        <>
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
          <SourceOverview
            linkedVodIds={linkedVodIds}
            onDeleteVod={(vodId) => void handleDeleteVod(vodId)}
            onRenameVod={(vodId, displayName) => renameVod(project.id, vodId, displayName)}
            project={project}
          />
        </>
      )}
      <VideoSynchronization
        onClipPanelCollapsedChange={(collapsed) => setClipPanelCollapsed(project.id, collapsed)}
        onCreateClip={(vodId, input) => createClip(project.id, vodId, input)}
        onDeleteClip={(clipId) => deleteClip(project.id, clipId)}
        onDavinciDefaultsChange={(defaults) => saveDavinciDefaults(project.id, defaults)}
        onReorderClips={(clipOrder) => reorderClips(project.id, clipOrder)}
        onDeleteVod={handleDeleteVod}
        onClippingModeChange={handleClippingModeChange}
        onSearchTermsChange={(vodId, searchTerms) =>
          saveVodSearchTerms(project.id, vodId, searchTerms)
        }
        onSplitSearchTermsChange={(vodId, splitSearchTerms) =>
          saveVodSplitSearchTerms(project.id, vodId, splitSearchTerms)
        }
        onSynchronize={(vodId, anchor) => saveSynchronization(project.id, vodId, anchor)}
        onUpdateClip={(clipId, input) => updateClip(project.id, clipId, input)}
        project={project}
        vodFiles={vodFiles}
      />
      {pendingVodDeletion !== undefined && (
        <VodDeleteDialog
          message={pendingVodDeletion.message}
          onCancel={cancelVodDeletion}
          onConfirm={confirmVodDeletion}
        />
      )}
    </main>
  );
}

interface PendingVodDeletion {
  readonly message: string;
  readonly resolve: (deleted: boolean) => void;
  readonly vodId: string;
}
