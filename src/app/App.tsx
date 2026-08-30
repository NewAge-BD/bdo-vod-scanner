import { useTranslation } from 'react-i18next';

import { BrandMark } from '../shared/components/BrandMark';
import { EmptyProjectState } from '../features/project-overview/EmptyProjectState';

export function App() {
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

      <main className="project-overview" id="main-content">
        <div className="project-overview__heading">
          <div>
            <p className="section-kicker">{t('projects.kicker')}</p>
            <h1>{t('projects.title')}</h1>
            <p className="project-overview__summary">{t('projects.summary')}</p>
          </div>

          <div className="project-overview__actions" aria-label={t('projects.actionsLabel')}>
            <button className="button button--secondary" disabled type="button">
              {t('projects.import')}
            </button>
            <button className="button button--primary" disabled type="button">
              <span aria-hidden="true">+</span>
              {t('projects.create')}
            </button>
          </div>
        </div>

        <EmptyProjectState />
      </main>

      <footer className="app-footer">
        <span>{t('app.version', { version: '0.0.0' })}</span>
        <span>{t('app.disclaimer')}</span>
      </footer>
    </div>
  );
}
