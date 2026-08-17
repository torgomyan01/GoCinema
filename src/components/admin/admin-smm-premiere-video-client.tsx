'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Loader2, Video } from 'lucide-react';
import type { SmmPremiere } from '@/app/actions/instagram-story';
import { getSmmPremieres } from '@/app/actions/instagram-story';
import { generatePremiereVideoAudio } from '@/app/actions/smm-video';
import SmmCanvasPreview from '@/components/admin/smm-canvas-preview';
import SmmToolShell from '@/components/admin/smm-tool-shell';
import {
  STORY_HEIGHT,
  STORY_WIDTH,
  fullDateLabel,
  premiereCountdown,
} from '@/lib/smm-canvas';
import { renderPremiereStory } from '@/lib/smm-premiere-render';
import {
  salesCaptionForPremiere,
  salesVoiceoverForPremiere,
} from '@/lib/smm-premiere-voiceover';
import {
  downloadBlob,
  recordKenBurnsVideo,
  videoExtension,
} from '@/lib/smm-video-record';
import { ensureMp4Blob } from '@/lib/smm-video-mp4';

type Props = {
  initialPremieres: SmmPremiere[];
  initialError: string | null;
};

export default function AdminSmmPremiereVideoClient({
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
  const [voiceover, setVoiceover] = useState('');
  const [caption, setCaption] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoMime, setVideoMime] = useState('video/webm');

  const selected =
    premieres.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setVoiceover('');
      setCaption('');
      return;
    }
    setVoiceover(salesVoiceoverForPremiere(selected));
    setCaption(salesCaptionForPremiere(selected));
  }, [selected]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

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

  const handleGenerate = async () => {
    if (!selected || renderingRef.current || busy) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setBusy(true);
    setError(null);
    setProgress(0);
    setStatus('Ձայնը գեներացվում է ElevenLabs-ից…');
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setVideoBlob(null);

    try {
      const audio = await generatePremiereVideoAudio({
        premiereId: selected.id,
        voiceover,
      });
      if (!audio.success || !audio.voiceDataUrl) {
        setError(audio.error || 'Ձայնը չհաջողվեց գեներացնել');
        return;
      }
      if (audio.voiceover) setVoiceover(audio.voiceover);
      if (audio.caption) setCaption(audio.caption);

      setStatus('Վիդեոն հավաքվում է նկարի և ձայնի վրա…');
      const recorded = await recordKenBurnsVideo({
        source: canvas,
        voiceDataUrl: audio.voiceDataUrl,
        soundDataUrl: audio.soundDataUrl,
        cues: audio.cues,
        maxSeconds: audio.maxSeconds ?? 15,
        onProgress: setProgress,
      });

      let result = recorded;
      if (!recorded.mime.includes('mp4')) {
        setStatus('MP4 է փոխակերպվում…');
        setProgress(0);
        try {
          const mp4 = await ensureMp4Blob(
            recorded.blob,
            recorded.mime,
            setProgress
          );
          result = { ...recorded, blob: mp4.blob, mime: mp4.mime };
        } catch (convertError) {
          console.warn('[premiere-video] mp4', convertError);
        }
      }

      const url = URL.createObjectURL(result.blob);
      setVideoBlob(result.blob);
      setVideoMime(result.mime);
      setVideoUrl(url);
      setStatus('Պատրաստ է');
    } catch (err) {
      console.error('[premiere-video]', err);
      setError(
        err instanceof Error ? err.message : 'Վիդեոն չհաջողվեց գեներացնել'
      );
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => {
    if (!videoBlob || !selected) return;
    const ext = videoExtension(videoMime);
    downloadBlob(
      videoBlob,
      `gocinema-premiere-${selected.movie.id}.${ext}`
    );
  };

  return (
    <SmmToolShell
      title="Պրեմիերայի վիդեո"
      subtitle="Վաճառող տեքստ · տղամարդու ձայն · մինչև 15 վայրկյան"
      error={error}
      onRefresh={() => void load()}
      onDownload={handleDownload}
      downloadDisabled={!videoBlob || busy}
      downloadLabel="Ներբեռնել MP4"
      extraActions={
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!selected || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Video className="h-4 w-4" />
          )}
          Գեներացնել վիդեո
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 font-semibold text-gray-900">Ընտրել պրեմիերա</h2>
            {premieres.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
                Ակտիվ պրեմիերա չկա։
              </p>
            ) : (
              <ul className="space-y-2">
                {premieres.map((row) => {
                  const checked = row.id === selectedId;
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
                          name="smm-premiere-video"
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
                            {premiereCountdown(new Date(row.premiereDate))} ·{' '}
                            {fullDateLabel(new Date(row.premiereDate))}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <h2 className="mb-1 font-semibold text-gray-900">
              Վաճառող տեքստ (ձայն)
            </h2>
            <p className="mb-3 text-xs text-gray-500">
              {selected
                ? `${selected.movie.title} · Մարտունիում`
                : 'Ընտրիր պրեմիերա'}
              {' · '}
              Eleven v3 · կայուն հայերեն արտասանություն
            </p>
            <textarea
              value={voiceover}
              onChange={(e) => setVoiceover(e.target.value)}
              rows={5}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-fuchsia-400"
            />
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Instagram caption
                </h3>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(caption)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-700 hover:text-fuchsia-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Պատճենել
                </button>
              </div>
              <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700">
                {caption}
              </pre>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SmmCanvasPreview
            canvasRef={canvasRef}
            overlayRef={overlayRef}
            width={STORY_WIDTH}
            height={STORY_HEIGHT}
          />
          {(busy || status) && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
              <p>{status}</p>
              {busy && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-fuchsia-600 transition-[width]"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
          {videoUrl && (
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-black"
            />
          )}
        </div>
      </div>
    </SmmToolShell>
  );
}
