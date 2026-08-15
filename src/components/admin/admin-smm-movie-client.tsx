'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { InstagramStoryMovie } from '@/app/actions/instagram-story';
import { getInstagramStoryMovies } from '@/app/actions/instagram-story';
import SmmCanvasPreview from '@/components/admin/smm-canvas-preview';
import SmmToolShell from '@/components/admin/smm-tool-shell';
import {
  downloadCanvasPng,
  smmPngName,
} from '@/lib/smm-canvas';
import {
  posterSize,
  renderMoviePoster,
  type PosterFormat,
} from '@/lib/smm-movie-poster';

type Props = {
  initialMovies: InstagramStoryMovie[];
  initialError: string | null;
};

export default function AdminSmmMovieClient({
  initialMovies,
  initialError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);
  const [movies, setMovies] = useState(initialMovies);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialMovies[0]?.id ?? null
  );
  const [format, setFormat] = useState<PosterFormat>('story');
  const [error, setError] = useState<string | null>(initialError);

  const selected = movies.find((movie) => movie.id === selectedId) ?? null;
  const size = posterSize(format);

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
      setSelectedId((prev) =>
        prev && res.movies.some((movie) => movie.id === prev)
          ? prev
          : (res.movies[0]?.id ?? null)
      );
    } catch {
      setError('Չհաջողվեց բեռնել');
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !selected) return;

    let cancelled = false;
    renderingRef.current = true;
    overlay?.removeAttribute('hidden');

    void renderMoviePoster(canvas, selected, format)
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
  }, [selected, format]);

  return (
    <SmmToolShell
      title="Ֆիլմի հայտարարություն"
      subtitle="Մեկ ֆիլմ · պոստեր, ժանր, տարիք, սեանսներ"
      error={error}
      onRefresh={() => void load()}
      onDownload={() => {
        const canvas = canvasRef.current;
        if (!canvas || !selected || renderingRef.current) return;
        downloadCanvasPng(
          canvas,
          smmPngName(`movie-${format}-${selected.id}`)
        );
      }}
      downloadDisabled={!selected}
      extraActions={
        <div className="flex overflow-hidden rounded-xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => setFormat('story')}
            className={`px-3 py-2.5 text-sm font-semibold ${
              format === 'story'
                ? 'bg-fuchsia-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            9:16 Stories
          </button>
          <button
            type="button"
            onClick={() => setFormat('feed')}
            className={`px-3 py-2.5 text-sm font-semibold ${
              format === 'feed'
                ? 'bg-fuchsia-600 text-white'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            1:1 Feed
          </button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">Ընտրել ֆիլմ</h2>
          {movies.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Այսօրվանից հետո ցուցադրություն չկա։
            </p>
          ) : (
            <ul className="space-y-2">
              {movies.map((movie) => {
                const checked = movie.id === selectedId;
                return (
                  <li key={movie.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        checked
                          ? 'border-fuchsia-200 bg-fuchsia-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="smm-movie"
                        checked={checked}
                        onChange={() => setSelectedId(movie.id)}
                        className="h-4 w-4 border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                      />
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
                          {movie.genre} · {movie.screenings.length} սեանս
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <SmmCanvasPreview
          canvasRef={canvasRef}
          overlayRef={overlayRef}
          width={size.width}
          height={size.height}
          maxWidthClass={format === 'feed' ? 'max-w-[320px]' : 'max-w-[280px]'}
        />
      </div>
    </SmmToolShell>
  );
}
