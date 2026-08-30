import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface ProjectNameDialogProps {
  readonly initialName?: string;
  readonly mode: 'create' | 'rename';
  readonly onCancel: () => void;
  readonly onSubmit: (name: string) => Promise<void>;
}

export function ProjectNameDialog({
  initialName = '',
  mode,
  onCancel,
  onSubmit,
}: ProjectNameDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return;
    }

    await onSubmit(trimmedName);
  }

  return (
    <dialog className="project-dialog" onCancel={onCancel} ref={dialogRef}>
      <form method="dialog" onSubmit={(event) => void handleSubmit(event)}>
        <p className="section-kicker">
          {t(mode === 'create' ? 'projects.dialog.createKicker' : 'projects.dialog.renameKicker')}
        </p>
        <h2>
          {t(mode === 'create' ? 'projects.dialog.createTitle' : 'projects.dialog.renameTitle')}
        </h2>
        <label htmlFor="project-name">{t('projects.dialog.nameLabel')}</label>
        <input
          autoFocus
          id="project-name"
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          required
          type="text"
          value={name}
        />
        <div className="project-dialog__actions">
          <button className="button button--secondary" onClick={onCancel} type="button">
            {t('common.cancel')}
          </button>
          <button
            className="button button--primary"
            disabled={name.trim().length === 0}
            type="submit"
          >
            {t(mode === 'create' ? 'projects.dialog.createAction' : 'projects.dialog.renameAction')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
