'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Download, Loader2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import {
  getInstagramStoryMovies,
  type InstagramStoryMovie,
} from '@/app/actions/instagram-story';
import {
  STORY_HEIGHT,
  STORY_WIDTH,
  downloadCanvasPng,
  renderInstagramStory,
} from '@/lib/instagram-story-render';

const MAX_MOVIES = 5;

type Props = {
  initialMovies: InstagramStoryMovie[];
  initialError: string | null;
};

export default function AdminInstagramClient({
  initialMovies,
  initialError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);
  const [movies, setMovies] = useState(initialMovies);
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    initialMovies.slice(0, MAX_MOVIES).map((movie) => movie.id)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const applyMovies = (next: InstagramStoryMovie[]) => {
    setMovies(next);
    setSelectedIds((prev) => {
      const valid = prev.filter((id) => next.some((movie) => movie.id === id));
      if (valid.length > 0) return valid.slice(0, MAX_MOVIES);
      return next.slice(0, MAX_MOVIES).map((movie) => movie.id);
    });
  };

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getInstagramStoryMovies();
      if (!res.success) {
        setError(res.error || 'Չհաջողվեց բեռնել');
        setMovies([]);
        return;
      }
      applyMovies(res.movies);
    } catch {
      setError('Չհաջողվեց բեռնել');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selected = selectedIds
    .map((id) => movies.find((movie) => movie.id === id))
    .filter((movie): movie is InstagramStoryMovie => Boolean(movie));

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    const chosen = selectedIds
      .map((id) => movies.find((movie) => movie.id === id))
      .filter((movie): movie is InstagramStoryMovie => Boolean(movie));
    if (!canvas || chosen.length === 0) return;

    let cancelled = false;
    renderingRef.current = true;
    overlay?.removeAttribute('hidden');

    void renderInstagramStory(canvas, chosen)
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
  }, [movies, selectedIds]);

  const toggleMovie = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_MOVIES) return prev;
      return [...prev, id];
    });
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || selected.length === 0 || renderingRef.current) return;
    const stamp = new Date();
    const name = `gocinema-story-${stamp.getFullYear()}-${String(stamp.getMonth() + 1).padStart(2, '0')}-${String(stamp.getDate()).padStart(2, '0')}.png`;
    downloadCanvasPng(canvas, name);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/smm"
            className="rounded-lg border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-50"
            aria-label="Վերադառնալ SMM"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs font-medium text-fuchsia-700">SMM գործիք</p>
            <h1 className="text-2xl font-bold text-gray-900">Ժամանակացույց</h1>
            <p className="text-sm text-gray-600">
              9:16 նկար · մինչև {MAX_MOVIES} ֆիլմ · այսօրվանից հետո բոլոր
              սեանսները
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Թարմացնել
          </button>
          <button
            type="button"
            onClick={handleDownload}
            disabled={selected.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Ներբեռնել PNG
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Ֆիլմեր այսօրվանից</h2>
            <span className="text-sm text-gray-500">
              Ընտրված {selectedIds.length} / {MAX_MOVIES}
            </span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Բեռնվում է…
            </div>
          ) : movies.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Այսօրվանից հետո ցուցադրություն չկա։
            </p>
          ) : (
            <ul className="space-y-2">
              {movies.map((movie) => {
                const checked = selectedIds.includes(movie.id);
                const disabled = !checked && selectedIds.length >= MAX_MOVIES;
                return (
                  <li key={movie.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        checked
                          ? 'border-fuchsia-200 bg-fuchsia-50'
                          : disabled
                            ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-50'
                            : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleMovie(movie.id)}
                        className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
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
                          {movie.screenings.length} սեանս այսօրվանից
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-gray-950 p-4 shadow-sm">
          <p className="mb-3 text-center text-xs font-medium text-gray-400">
            Նախադիտում · {STORY_WIDTH}×{STORY_HEIGHT}
          </p>
          <div className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl border border-white/10 bg-black">
            <div
              ref={overlayRef}
              hidden
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/40"
            >
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
            <canvas
              ref={canvasRef}
              className="block h-auto w-full"
              style={{ aspectRatio: `${STORY_WIDTH} / ${STORY_HEIGHT}` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
