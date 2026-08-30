import { useEffect, useState } from 'react';

export function useObjectUrl(file: File): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const nextUrl = URL.createObjectURL(file);
    queueMicrotask(() => {
      if (!cancelled) {
        setUrl(nextUrl);
      }
    });

    return () => {
      cancelled = true;
      URL.revokeObjectURL(nextUrl);
    };
  }, [file]);

  return url;
}
