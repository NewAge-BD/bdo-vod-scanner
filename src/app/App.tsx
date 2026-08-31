import { useTranslation } from 'react-i18next';

import type { ProjectRepository } from '../infrastructure/projects';
import type { VideoMetadataInspector } from '../infrastructure/media';
import { BrandMark } from '../shared/components/BrandMark';
import { ProjectOverview } from '../features/project-overview/ProjectOverview';
import { ProjectStoreProvider } from '../features/project-overview/ProjectStoreProvider';

interface AppProps {
  readonly repository?: ProjectRepository;
  readonly metadataInspector?: VideoMetadataInspector;
}

export function App({ repository, metadataInspector }: AppProps) {
  return (
    <ProjectStoreProvider repository={repository}>
      <AppContent metadataInspector={metadataInspector} />
    </ProjectStoreProvider>
  );
}

function AppContent({
  metadataInspector,
}: {
  readonly metadataInspector?: VideoMetadataInspector;
}) {
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

      <ProjectOverview metadataInspector={metadataInspector} />

      <footer className="app-footer">
        <span>{t('app.version', { version: '0.1.1' })}</span>
        <span>{t('app.disclaimer')}</span>
        <a href="https://github.com/NewAge-BD/bdo-vod-scanner" rel="noreferrer" target="_blank">
          {t('app.sourceCode')}
        </a>
      </footer>
    </div>
  );
}
