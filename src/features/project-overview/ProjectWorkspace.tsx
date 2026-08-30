import { useTranslation } from 'react-i18next';

import type { PortableProject } from '../../domain/projects';

interface ProjectWorkspaceProps {
  readonly project: PortableProject;
  readonly onBack: () => void;
}

export function ProjectWorkspace({ project, onBack }: ProjectWorkspaceProps) {
  const { t } = useTranslation();

  return (
    <main className="project-workspace" id="main-content">
      <button className="back-button" onClick={onBack} type="button">
        <span aria-hidden="true">←</span> {t('projects.back')}
      </button>
      <p className="section-kicker">{t('projects.workspaceKicker')}</p>
      <h1>{project.name}</h1>

      <section className="workspace-ready" aria-labelledby="workspace-ready-title">
        <div aria-hidden="true" className="workspace-ready__icon">
          +
        </div>
        <div>
          <h2 id="workspace-ready-title">{t('projects.workspaceReadyTitle')}</h2>
          <p>{t('projects.workspaceReadyDescription')}</p>
        </div>
      </section>
    </main>
  );
}
