import { useTranslation } from 'react-i18next';

import type { ProjectRepository } from '../infrastructure/projects';
import { BrandMark } from '../shared/components/BrandMark';
import { ProjectOverview } from '../features/project-overview/ProjectOverview';
import { ProjectStoreProvider } from '../features/project-overview/ProjectStoreProvider';

interface AppProps {
  readonly repository?: ProjectRepository;
}

export function App({ repository }: AppProps) {
  return (
    <ProjectStoreProvider repository={repository}>
      <AppContent />
    </ProjectStoreProvider>
  );
}

function AppContent() {
  const { t } = useTranslation();

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('accessibility.skipToContent')}
      </a>

      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div>
            <p className="brand__eyebrow">{t('app.eyebrow')}</p>
            <p className="brand__name">{t('app.name')}</p>
          </div>
        </div>

        <div className="local-status" aria-label={t('privacy.statusLabel')}>
          <span className="local-status__dot" aria-hidden="true" />
          {t('privacy.localOnly')}
        </div>
      </header>

      <ProjectOverview />

      <footer className="app-footer">
        <span>{t('app.version', { version: '0.0.0' })}</span>
        <span>{t('app.disclaimer')}</span>
      </footer>
    </div>
  );
}
