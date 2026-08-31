import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

const COMPLETION_KEY = 'bdo-vod-scanner:guided-tour:v1';

interface GuideStep {
  readonly descriptionKey: string;
  readonly target?: string;
  readonly titleKey: string;
}

const steps: readonly GuideStep[] = [
  { titleKey: 'guidedTour.steps.welcome.title', descriptionKey: 'guidedTour.steps.welcome.body' },
  {
    titleKey: 'guidedTour.steps.projects.title',
    descriptionKey: 'guidedTour.steps.projects.body',
    target: 'project-actions',
  },
  {
    titleKey: 'guidedTour.steps.sources.title',
    descriptionKey: 'guidedTour.steps.sources.body',
    target: 'source-import',
  },
  {
    titleKey: 'guidedTour.steps.syncPerspective.title',
    descriptionKey: 'guidedTour.steps.syncPerspective.body',
    target: 'sync-perspectives',
  },
  {
    titleKey: 'guidedTour.steps.syncNavigate.title',
    descriptionKey: 'guidedTour.steps.syncNavigate.body',
    target: 'sync-video',
  },
  {
    titleKey: 'guidedTour.steps.syncChatArea.title',
    descriptionKey: 'guidedTour.steps.syncChatArea.body',
    target: 'auto-sync',
  },
  {
    titleKey: 'guidedTour.steps.syncScan.title',
    descriptionKey: 'guidedTour.steps.syncScan.body',
    target: 'auto-sync',
  },
  {
    titleKey: 'guidedTour.steps.syncFineTune.title',
    descriptionKey: 'guidedTour.steps.syncFineTune.body',
    target: 'sync-fine-tune',
  },
  {
    titleKey: 'guidedTour.steps.syncManual.title',
    descriptionKey: 'guidedTour.steps.syncManual.body',
    target: 'sync-manual-search',
  },
  {
    titleKey: 'guidedTour.steps.syncSave.title',
    descriptionKey: 'guidedTour.steps.syncSave.body',
    target: 'sync-confirm',
  },
  {
    titleKey: 'guidedTour.steps.startClipping.title',
    descriptionKey: 'guidedTour.steps.startClipping.body',
    target: 'start-clipping',
  },
  {
    titleKey: 'guidedTour.steps.find.title',
    descriptionKey: 'guidedTour.steps.find.body',
    target: 'clipping-workspace',
  },
  {
    titleKey: 'guidedTour.steps.clipPerspectives.title',
    descriptionKey: 'guidedTour.steps.clipPerspectives.body',
    target: 'clipping-perspectives',
  },
  {
    titleKey: 'guidedTour.steps.clipPlayer.title',
    descriptionKey: 'guidedTour.steps.clipPlayer.body',
    target: 'clipping-player',
  },
  {
    titleKey: 'guidedTour.steps.clipTransport.title',
    descriptionKey: 'guidedTour.steps.clipTransport.body',
    target: 'clipping-transport',
  },
  {
    titleKey: 'guidedTour.steps.clipVisibleTimeline.title',
    descriptionKey: 'guidedTour.steps.clipVisibleTimeline.body',
    target: 'clipping-visible-timeline',
  },
  {
    titleKey: 'guidedTour.steps.clipOverview.title',
    descriptionKey: 'guidedTour.steps.clipOverview.body',
    target: 'clipping-overview',
  },
  {
    titleKey: 'guidedTour.steps.clipBuilder.title',
    descriptionKey: 'guidedTour.steps.clipBuilder.body',
    target: 'clip-builder',
  },
  {
    titleKey: 'guidedTour.steps.clipEvents.title',
    descriptionKey: 'guidedTour.steps.clipEvents.body',
    target: 'clipping-event-lanes',
  },
  {
    titleKey: 'guidedTour.steps.clipNames.title',
    descriptionKey: 'guidedTour.steps.clipNames.body',
    target: 'clipping-name-search',
  },
  {
    titleKey: 'guidedTour.steps.clipNameLanes.title',
    descriptionKey: 'guidedTour.steps.clipNameLanes.body',
    target: 'clipping-event-lanes',
  },
  {
    titleKey: 'guidedTour.steps.clipNavigation.title',
    descriptionKey: 'guidedTour.steps.clipNavigation.body',
    target: 'clipping-timeline-navigation',
  },
  {
    titleKey: 'guidedTour.steps.markedClips.title',
    descriptionKey: 'guidedTour.steps.markedClips.body',
    target: 'marked-clips',
  },
  {
    titleKey: 'guidedTour.steps.export.title',
    descriptionKey: 'guidedTour.steps.export.body',
    target: 'clip-export',
  },
];

interface TargetRect {
  readonly height: number;
  readonly left: number;
  readonly target: string;
  readonly top: number;
  readonly width: number;
}

function shouldOpenOnFirstVisit(): boolean {
  try {
    return window.localStorage.getItem(COMPLETION_KEY) !== 'complete';
  } catch {
    return true;
  }
}

function rememberCompletion() {
  try {
    window.localStorage.setItem(COMPLETION_KEY, 'complete');
  } catch {
    // The guide still works when browser storage is unavailable.
  }
}

export function GuidedTour() {
  const { t } = useTranslation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isOpen, setIsOpen] = useState(shouldOpenOnFirstVisit);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect>();
  const step = steps[stepIndex]!;
  const visibleTargetRect = targetRect?.target === step.target ? targetRect : undefined;

  useEffect(() => {
    if (isOpen) titleRef.current?.focus();
  }, [isOpen, stepIndex]);

  useEffect(() => {
    if (!isOpen || step.target === undefined) {
      return;
    }

    let currentTarget: HTMLElement | null = null;
    let hasScrolled = false;
    let animationFrame = 0;

    function updateTarget() {
      const nextTarget = document.querySelector<HTMLElement>(`[data-guide="${step.target}"]`);
      if (nextTarget !== currentTarget) {
        currentTarget = nextTarget;
        hasScrolled = false;
      }
      if (nextTarget === null) {
        setTargetRect(undefined);
        return;
      }
      if (!hasScrolled) {
        nextTarget.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        hasScrolled = true;
      }
      const bounds = nextTarget.getBoundingClientRect();
      setTargetRect({
        height: bounds.height,
        left: bounds.left,
        target: step.target!,
        top: bounds.top,
        width: bounds.width,
      });
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(updateTarget);
    }

    scheduleUpdate();
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
    };
  }, [isOpen, step.target]);

  function openGuide() {
    setTargetRect(undefined);
    setStepIndex(0);
    setIsOpen(true);
  }

  function closeGuide() {
    rememberCompletion();
    setTargetRect(undefined);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function showNextStep() {
    if (stepIndex === steps.length - 1) {
      closeGuide();
    } else {
      setTargetRect(undefined);
      setStepIndex((current) => current + 1);
    }
  }

  return (
    <>
      <button
        aria-expanded={isOpen}
        className="guide-trigger"
        onClick={isOpen ? closeGuide : openGuide}
        ref={triggerRef}
        type="button"
      >
        <span aria-hidden="true">?</span>
        {t('guidedTour.open')}
      </button>
      {isOpen &&
        createPortal(
          <>
            {visibleTargetRect !== undefined && (
              <div
                aria-hidden="true"
                className="guided-tour__spotlight"
                style={{
                  height: visibleTargetRect.height,
                  left: visibleTargetRect.left,
                  top: visibleTargetRect.top,
                  width: visibleTargetRect.width,
                }}
              />
            )}
            <aside
              aria-describedby="guided-tour-description"
              aria-labelledby="guided-tour-title"
              className="guided-tour"
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeGuide();
              }}
              role="region"
            >
              <div className="guided-tour__topline">
                <span>{t('guidedTour.kicker')}</span>
                <button aria-label={t('guidedTour.close')} onClick={closeGuide} type="button">
                  ×
                </button>
              </div>
              <p className="guided-tour__progress" role="status">
                {t('guidedTour.progress', { current: stepIndex + 1, total: steps.length })}
              </p>
              <h2 id="guided-tour-title" ref={titleRef} tabIndex={-1}>
                {t(step.titleKey)}
              </h2>
              <p id="guided-tour-description">{t(step.descriptionKey)}</p>
              {step.target !== undefined && visibleTargetRect === undefined && (
                <p className="guided-tour__waiting">{t('guidedTour.waiting')}</p>
              )}
              <div className="guided-tour__dots" aria-hidden="true">
                {steps.map((_, index) => (
                  <span
                    className={index === stepIndex ? 'guided-tour__dot--active' : ''}
                    key={index}
                  />
                ))}
              </div>
              <div className="guided-tour__actions">
                <button
                  className="button"
                  disabled={stepIndex === 0}
                  onClick={() => {
                    setTargetRect(undefined);
                    setStepIndex((current) => Math.max(0, current - 1));
                  }}
                  type="button"
                >
                  {t('guidedTour.back')}
                </button>
                <button className="button button--primary" onClick={showNextStep} type="button">
                  {t(stepIndex === steps.length - 1 ? 'guidedTour.finish' : 'guidedTour.next')}
                </button>
              </div>
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}

export { COMPLETION_KEY as GUIDED_TOUR_COMPLETION_KEY };
