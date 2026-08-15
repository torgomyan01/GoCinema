'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { InstagramStoryMovie } from '@/app/actions/instagram-story';
import { getInstagramStoryMovies } from '@/app/actions/instagram-story';
import SmmCanvasPreview from '@/components/admin/smm-canvas-preview';
import SmmToolShell from '@/components/admin/smm-tool-shell';
import {
  STORY_HEIGHT,
  STORY_WIDTH,
  downloadCanvasPng,
  smmPngName,
} from '@/lib/smm-canvas';
import {
  moviesPlayingToday,
  renderTodayStory,
} from '@/lib/smm-today-render';

type Props = {
  initialMovies: InstagramStoryMovie[];
  initialError: string | null;
};

export default function AdminSmmTodayClient({
  initialMovies,
  initialError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);
  const [movies, setMovies] = useState(initialMovies);
  const [error, setError] = useState<string | null>(initialError);

  const todayMovies = useMemo(() => moviesPlayingToday(movies), [movies]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getInstagramStoryMovies();
      if (!res.success) {
        setError(res.error || 'Չհաջողվեց բեռնել');
        setMovies([]);
        return;
      }
      setMovies(res.movies);
    } catch {
      setError('Չհաջողվեց բեռնել');
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || todayMovies.length === 0) return;

    let cancelled = false;
    renderingRef.current = true;
    overlay?.removeAttribute('hidden');

    void renderTodayStory(canvas, todayMovies)
      .catch(() => {
        if (!cancelled) setError('Նկարը չհաջողվեց գծել');
      })
      .finally(() => {
        renderingRef.current = false;
        if (!cancelled) overlay?.setAttribute('hidden', '');
      });

    return () => {
      cancelled = true;
    };
  }, [todayMovies]);

  return (
    <SmmToolShell
      title="Այսօր կինոյում"
      subtitle="9:16 նկար · միայն այսօրվա սեանսները"
      error={error}
      onRefresh={() => void load()}
      onDownload={() => {
        const canvas = canvasRef.current;
        if (!canvas || todayMovies.length === 0 || renderingRef.current) return;
        downloadCanvasPng(canvas, smmPngName('today'));
      }}
      downloadDisabled={todayMovies.length === 0}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">Այսօրվա ֆիլմեր</h2>
          {todayMovies.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Այսօր ցուցադրություն չկա։
            </p>
          ) : (
            <ul className="space-y-2">
              {todayMovies.map((movie) => (
                <li
                  key={movie.id}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5"
                >
                  {movie.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={movie.image}
                      alt=""
                      className="h-12 w-9 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-9 rounded bg-gray-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {movie.title}
                      {movie.ageRating ? ` · ${movie.ageRating}` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {movie.screenings.length} սեանս այսօր
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <SmmCanvasPreview
          canvasRef={canvasRef}
          overlayRef={overlayRef}
          width={STORY_WIDTH}
          height={STORY_HEIGHT}
        />
      </div>
    </SmmToolShell>
  );
}
