import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { VodReference } from '../../domain/projects';
import { useObjectUrl } from './useObjectUrl';

const MAXIMUM_PASSIVE_DRIFT_SECONDS = 0.12;

export function SynchronizedMiniPlayer({
  file,
  isPlaying,
  onHide,
  onPromote,
  targetVideoTime,
  vod,
}: {
  readonly file: File;
  readonly isPlaying: boolean;
  readonly onHide: () => void;
  readonly onPromote: () => void;
  readonly targetVideoTime: number;
  readonly vod: VodReference;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const objectUrl = useObjectUrl(file);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || !isReady || hasError) {
      return;
    }
    if (Math.abs(video.currentTime - targetVideoTime) > MAXIMUM_PASSIVE_DRIFT_SECONDS) {
      video.currentTime = targetVideoTime;
    }
    if (isPlaying) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [hasError, isPlaying, isReady, targetVideoTime]);

  return (
    <div className="perspective-mini">
      <video
        aria-label={t('synchronization.miniPlayerLabel', { name: vod.displayName })}
        muted
        onError={() => setHasError(true)}
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = targetVideoTime;
          setIsReady(true);
        }}
        playsInline
        preload="metadata"
        ref={videoRef}
        src={objectUrl}
      />
      {hasError && (
        <span className="perspective-mini__state">{t('synchronization.playbackError')}</span>
      )}
      <span className="perspective-mini__name">{vod.displayName}</span>
      <button
        aria-label={t('synchronization.promotePerspective', { name: vod.displayName })}
        className="perspective-mini__promote"
        onClick={onPromote}
        type="button"
      />
      <button
        aria-label={t('synchronization.hidePerspective', { name: vod.displayName })}
        className="perspective-mini__hide"
        onClick={onHide}
        type="button"
      >
        ×
      </button>
    </div>
  );
}
