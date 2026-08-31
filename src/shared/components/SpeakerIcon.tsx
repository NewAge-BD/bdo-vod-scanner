interface SpeakerIconProps {
  readonly muted: boolean;
}

export function SpeakerIcon({ muted }: SpeakerIconProps) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path d="M5 9h4l5-4v14l-5-4H5z" />
      {muted ? (
        <>
          <path d="m17 9 4 4" />
          <path d="m21 9-4 4" />
        </>
      ) : (
        <>
          <path d="M17 9.5c1.3 1.4 1.3 3.6 0 5" />
          <path d="M19.5 7c2.7 2.8 2.7 7.2 0 10" />
        </>
      )}
    </svg>
  );
}
