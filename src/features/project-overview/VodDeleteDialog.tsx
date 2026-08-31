import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface VodDeleteDialogProps {
  readonly message: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => Promise<void>;
}

export function VodDeleteDialog({ message, onCancel, onConfirm }: VodDeleteDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog className="project-dialog" onCancel={onCancel} ref={dialogRef}>
      <div className="vod-delete-dialog">
        <p className="section-kicker">{t('sources.deleteVodKicker')}</p>
        <h2>{t('sources.deleteVodTitle')}</h2>
        <p>{message}</p>
        <div className="project-dialog__actions">
          <button
            className="button button--secondary"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            {t('common.cancel')}
          </button>
          <button
            className="button vod-delete-dialog__confirm"
            disabled={isDeleting}
            onClick={() => {
              setIsDeleting(true);
              void onConfirm();
            }}
            type="button"
          >
            {isDeleting ? t('sources.deletingVod') : t('sources.confirmDeleteVod')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
