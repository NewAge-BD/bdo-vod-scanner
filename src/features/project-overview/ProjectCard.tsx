import { useTranslation } from 'react-i18next';

import {
  getProjectExportFileName,
  serializeProject,
  type PortableProject,
} from '../../domain/projects';

interface ProjectCardProps {
  readonly project: PortableProject;
  readonly onDelete: (project: PortableProject) => Promise<void>;
  readonly onOpen: (id: string) => void;
  readonly onRename: (project: PortableProject) => void;
}

export function ProjectCard({ project, onDelete, onOpen, onRename }: ProjectCardProps) {
  const { t, i18n } = useTranslation();
  const updatedAt = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(project.updatedAt));

  function exportProject() {
    const blob = new Blob([serializeProject(project)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = getProjectExportFileName(project);
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <article className="project-card">
      <button className="project-card__open" onClick={() => onOpen(project.id)} type="button">
        <span className="project-card__icon" aria-hidden="true">
          ◫
        </span>
        <span>
          <strong>{project.name}</strong>
          <small>{t('projects.updated', { date: updatedAt })}</small>
        </span>
      </button>

      <div className="project-card__metadata">
        <span>{t('projects.vodCount', { count: project.vods.length })}</span>
        <span>{t('projects.clipCount', { count: project.clips.length })}</span>
      </div>

      <div
        className="project-card__actions"
        aria-label={t('projects.cardActions', { name: project.name })}
      >
        <button onClick={() => onRename(project)} type="button">
          {t('common.rename')}
        </button>
        <button onClick={exportProject} type="button">
          {t('common.export')}
        </button>
        <button className="danger-action" onClick={() => void onDelete(project)} type="button">
          {t('common.delete')}
        </button>
      </div>
    </article>
  );
}
