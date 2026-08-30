import { useTranslation } from 'react-i18next';

export function EmptyProjectState() {
  const { t } = useTranslation();

  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state__visual" aria-hidden="true">
        <span className="empty-state__line empty-state__line--video" />
        <span className="empty-state__play">▶</span>
        <span className="empty-state__line empty-state__line--events" />
        <span className="empty-state__event empty-state__event--kill" />
        <span className="empty-state__event empty-state__event--death" />
      </div>

      <div className="empty-state__copy">
        <p className="status-pill">{t('projects.foundationStatus')}</p>
        <h2 id="empty-state-title">{t('projects.emptyTitle')}</h2>
        <p>{t('projects.emptyDescription')}</p>
        <p className="empty-state__note">{t('projects.emptyNote')}</p>
      </div>
    </section>
  );
}
