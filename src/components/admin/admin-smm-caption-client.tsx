'use client';

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type {
  InstagramStoryMovie,
  SmmPremiere,
} from '@/app/actions/instagram-story';
import SmmToolShell from '@/components/admin/smm-tool-shell';
import {
  captionForMovie,
  captionForPremiere,
  captionForSchedule,
  captionForToday,
} from '@/lib/smm-caption';
import { fullDateLabel, premiereCountdown } from '@/lib/smm-canvas';
import { moviesPlayingToday } from '@/lib/smm-today-render';

type Kind = 'movie' | 'today' | 'premiere' | 'schedule';

type Props = {
  initialMovies: InstagramStoryMovie[];
  initialPremieres: SmmPremiere[];
  initialError: string | null;
};

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: 'movie', label: 'Ֆիլմ' },
  { id: 'today', label: 'Այսօր' },
  { id: 'premiere', label: 'Պրեմիերա' },
  { id: 'schedule', label: 'Ժամանակացույց' },
];

export default function AdminSmmCaptionClient({
  initialMovies,
  initialPremieres,
  initialError,
}: Props) {
  const [kind, setKind] = useState<Kind>('movie');
  const [movieId, setMovieId] = useState<number | null>(
    initialMovies[0]?.id ?? null
  );
  const [premiereId, setPremiereId] = useState<number | null>(
    initialPremieres[0]?.id ?? null
  );
  const [copied, setCopied] = useState(false);
  const [edited, setEdited] = useState<string | null>(null);

  const movie = initialMovies.find((row) => row.id === movieId) ?? null;
  const premiere =
    initialPremieres.find((row) => row.id === premiereId) ?? null;
  const todayCount = moviesPlayingToday(initialMovies).length;

  const generated = useMemo(() => {
    if (kind === 'movie' && movie) return captionForMovie(movie);
    if (kind === 'today') return captionForToday(initialMovies);
    if (kind === 'premiere' && premiere) return captionForPremiere(premiere);
    if (kind === 'schedule') {
      return captionForSchedule(initialMovies.slice(0, 5));
    }
    return '';
  }, [kind, movie, premiere, initialMovies]);

  const text = edited ?? generated;

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <SmmToolShell
      title="Տեքստ / caption"
      subtitle="Հայերեն տեքստ, հեշթեգներ և հղում · պատճենել Instagram"
      error={initialError}
      extraActions={
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!text}
          className="inline-flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          {copied ? 'Պատճենվեց' : 'Պատճենել'}
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-900">Տեսակ</h2>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setKind(item.id);
                    setEdited(null);
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                    kind === item.id
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {kind === 'movie' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-900">Ֆիլմ</h2>
              {initialMovies.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  Ֆիլմ չկա։
                </p>
              ) : (
                <ul className="space-y-2">
                  {initialMovies.map((row) => (
                    <li key={row.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                          row.id === movieId
                            ? 'border-fuchsia-200 bg-fuchsia-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="caption-movie"
                          checked={row.id === movieId}
                          onChange={() => {
                            setMovieId(row.id);
                            setEdited(null);
                          }}
                          className="h-4 w-4 border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                        />
                        <span className="truncate font-medium text-gray-900">
                          {row.title}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {kind === 'premiere' && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold text-gray-900">Պրեմիերա</h2>
              {initialPremieres.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">
                  Պրեմիերա չկա։
                </p>
              ) : (
                <ul className="space-y-2">
                  {initialPremieres.map((row) => {
                    const date = new Date(row.premiereDate);
                    return (
                      <li key={row.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                            row.id === premiereId
                              ? 'border-fuchsia-200 bg-fuchsia-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="caption-premiere"
                            checked={row.id === premiereId}
                            onChange={() => {
                              setPremiereId(row.id);
                              setEdited(null);
                            }}
                            className="h-4 w-4 border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-gray-900">
                              {row.movie.title}
                            </span>
                            <span className="text-xs text-gray-500">
                              {premiereCountdown(date)} · {fullDateLabel(date)}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {kind === 'today' && (
            <p className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
              {todayCount > 0
                ? `Այսօր ${todayCount} ֆիլմ է ցուցադրվում։`
                : 'Այսօր ցուցադրություն չկա։'}
            </p>
          )}

          {kind === 'schedule' && (
            <p className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
              Տեքստը կներառի մինչև 5 ֆիլմ այսօրվանից հետո։
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">Տեքստ</h2>
          <textarea
            value={text}
            onChange={(e) => setEdited(e.target.value)}
            rows={22}
            className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 font-mono text-sm leading-6 text-gray-900 outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100"
          />
        </div>
      </div>
    </SmmToolShell>
  );
}
