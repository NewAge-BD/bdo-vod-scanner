import { useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';

interface FileDropZoneProps {
  readonly disabled: boolean;
  readonly onFiles: (files: readonly File[]) => Promise<void>;
}

export function FileDropZone({ disabled, onFiles }: FileDropZoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function submitFiles(files: FileList | null) {
    if (files === null || files.length === 0) {
      return;
    }
    await onFiles(Array.from(files));
    if (inputRef.current !== null) {
      inputRef.current.value = '';
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }

  return (
    <div
      className={`file-drop-zone${isDragging ? ' file-drop-zone--active' : ''}`}
      data-guide="source-import"
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          setIsDragging(false);
        }
      }}
      onDragOver={handleDragOver}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        if (!disabled) {
          void submitFiles(event.dataTransfer.files);
        }
      }}
    >
      <input
        accept=".log,.ikusa.json,.mp4,text/plain,application/json,video/mp4"
        aria-label={t('sourceImport.fileInputLabel')}
        className="visually-hidden"
        disabled={disabled}
        multiple
        onChange={(event) => void submitFiles(event.target.files)}
        ref={inputRef}
        type="file"
      />
      <div aria-hidden="true" className="file-drop-zone__icon">
        ↓
      </div>
      <div>
        <h2>{t('sourceImport.dropTitle')}</h2>
        <p>{t('sourceImport.dropDescription')}</p>
      </div>
      <button
        className="button button--primary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {disabled ? t('sourceImport.inspecting') : t('sourceImport.chooseFiles')}
      </button>
      <details className="log-download-guide">
        <summary>{t('sourceImport.logGuide.title')}</summary>
        <ol>
          <li>
            <a href="https://guildyapper.com/" rel="noreferrer" target="_blank">
              {t('sourceImport.logGuide.visit')}
            </a>
          </li>
          <li>{t('sourceImport.logGuide.hoverName')}</li>
          <li>{t('sourceImport.logGuide.openScores')}</li>
          <li>{t('sourceImport.logGuide.download')}</li>
        </ol>
      </details>
    </div>
  );
}
