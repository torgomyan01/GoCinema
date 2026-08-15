'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SmmPremiere } from '@/app/actions/instagram-story';
import { getSmmPremieres } from '@/app/actions/instagram-story';
import SmmCanvasPreview from '@/components/admin/smm-canvas-preview';
import SmmToolShell from '@/components/admin/smm-tool-shell';
import {
  STORY_HEIGHT,
  STORY_WIDTH,
  downloadCanvasPng,
  fullDateLabel,
  premiereCountdown,
  smmPngName,
} from '@/lib/smm-canvas';
import { renderPremiereStory } from '@/lib/smm-premiere-render';

type Props = {
  initialPremieres: SmmPremiere[];
  initialError: string | null;
};

export default function AdminSmmPremiereClient({
  initialPremieres,
  initialError,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const renderingRef = useRef(false);
  const [premieres, setPremieres] = useState(initialPremieres);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialPremieres[0]?.id ?? null
  );
  const [error, setError] = useState<string | null>(initialError);

  const selected =
    premieres.find((row) => row.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getSmmPremieres();
      if (!res.success) {
        setError(res.error || 'Չհաջողվեց բեռնել');
        setPremieres([]);
        return;
      }
      setPremieres(res.premieres);
      setSelectedId((prev) =>
        prev && res.premieres.some((row) => row.id === prev)
          ? prev
          : (res.premieres[0]?.id ?? null)
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

    void renderPremiereStory(canvas, selected)
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
  }, [selected]);

  return (
    <SmmToolShell
      title="Պրեմիերա"
      subtitle="9:16 նկար · ամսաթիվ և countdown"
      error={error}
      onRefresh={() => void load()}
      onDownload={() => {
        const canvas = canvasRef.current;
        if (!canvas || !selected || renderingRef.current) return;
        downloadCanvasPng(canvas, smmPngName(`premiere-${selected.id}`));
      }}
      downloadDisabled={!selected}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-gray-900">
            Առաջիկա պրեմիերաներ
          </h2>
          {premieres.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">
              Ակտիվ պրեմիերա չկա։
            </p>
          ) : (
            <ul className="space-y-2">
              {premieres.map((row) => {
                const checked = row.id === selectedId;
                const date = new Date(row.premiereDate);
                return (
                  <li key={row.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        checked
                          ? 'border-fuchsia-200 bg-fuchsia-50'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="smm-premiere"
                        checked={checked}
                        onChange={() => setSelectedId(row.id)}
                        className="h-4 w-4 border-gray-300 text-fuchsia-600 focus:ring-fuchsia-500"
                      />
                      {row.movie.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.movie.image}
                          alt=""
                          className="h-12 w-9 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-9 rounded bg-gray-200" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-gray-900">
                          {row.movie.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {premiereCountdown(date)} · {fullDateLabel(date)}
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
          width={STORY_WIDTH}
          height={STORY_HEIGHT}
        />
      </div>
    </SmmToolShell>
  );
}
