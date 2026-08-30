import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PortableProject } from '../../domain/projects';
import type { VideoMetadataInspector } from '../../infrastructure/media';
import { EmptyProjectState } from './EmptyProjectState';
import { ProjectCard } from './ProjectCard';
import { ProjectNameDialog } from './ProjectNameDialog';
import { ProjectWorkspace } from './ProjectWorkspace';
import { useProjectStore } from './useProjectStore';

interface ProjectOverviewProps {
  readonly metadataInspector?: VideoMetadataInspector;
}

export function ProjectOverview({ metadataInspector }: ProjectOverviewProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const status = useProjectStore((state) => state.status);
  const errorMessage = useProjectStore((state) => state.errorMessage);
  const loadProjects = useProjectStore((state) => state.load);
  const createProject = useProjectStore((state) => state.create);
  const importProject = useProjectStore((state) => state.importProject);
  const renameProject = useProjectStore((state) => state.rename);
  const deleteProject = useProjectStore((state) => state.delete);
  const openProject = useProjectStore((state) => state.open);
  const closeProject = useProjectStore((state) => state.close);
  const dismissError = useProjectStore((state) => state.dismissError);
  const [dialog, setDialog] = useState<
    { readonly mode: 'create' } | { readonly mode: 'rename'; readonly project: PortableProject }
  >();

  useEffect(() => {
    if (status === 'idle') {
      void loadProjects();
    }
  }, [loadProjects, status]);

  const activeProject = projects.find((project) => project.id === activeProjectId);
  if (activeProject !== undefined) {
    return (
      <ProjectWorkspace
        metadataInspector={metadataInspector}
        onBack={closeProject}
        project={activeProject}
      />
    );
  }

  async function handleImport(file: File | undefined) {
    if (file === undefined) {
      return;
    }

    await importProject(await file.text());
    if (fileInputRef.current !== null) {
      fileInputRef.current.value = '';
    }
  }

  async function handleDelete(project: PortableProject) {
    if (window.confirm(t('projects.deleteConfirmation', { name: project.name }))) {
      await deleteProject(project.id);
    }
  }

  return (
    <main className="project-overview" id="main-content">
      <div className="project-overview__heading">
        <div>
          <p className="section-kicker">{t('projects.kicker')}</p>
          <h1>{t('projects.title')}</h1>
          <p className="project-overview__summary">{t('projects.summary')}</p>
        </div>

        <div className="project-overview__actions" aria-label={t('projects.actionsLabel')}>
          <input
            accept=".json,application/json"
            className="visually-hidden"
            onChange={(event) => void handleImport(event.target.files?.[0])}
            ref={fileInputRef}
            type="file"
          />
          <button
            className="button button--secondary"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            {t('projects.import')}
          </button>
          <button
            className="button button--primary"
            onClick={() => setDialog({ mode: 'create' })}
            type="button"
          >
            <span aria-hidden="true">+</span>
            {t('projects.create')}
          </button>
        </div>
      </div>

      {errorMessage !== undefined && (
        <div className="error-banner" role="alert">
          <span>{t(errorMessage)}</span>
          <button onClick={dismissError} type="button">
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {status === 'loading' ? (
        <p className="loading-state" role="status">
          {t('projects.loading')}
        </p>
      ) : projects.length === 0 ? (
        <EmptyProjectState />
      ) : (
        <section className="project-grid" aria-label={t('projects.listLabel')}>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              onDelete={handleDelete}
              onOpen={openProject}
              onRename={(selectedProject) =>
                setDialog({ mode: 'rename', project: selectedProject })
              }
              project={project}
            />
          ))}
        </section>
      )}

      {dialog?.mode === 'create' && (
        <ProjectNameDialog
          mode="create"
          onCancel={() => setDialog(undefined)}
          onSubmit={async (name) => {
            await createProject(name);
            setDialog(undefined);
          }}
        />
      )}
      {dialog?.mode === 'rename' && (
        <ProjectNameDialog
          initialName={dialog.project.name}
          mode="rename"
          onCancel={() => setDialog(undefined)}
          onSubmit={async (name) => {
            await renameProject(dialog.project.id, name);
            setDialog(undefined);
          }}
        />
      )}
    </main>
  );
}
