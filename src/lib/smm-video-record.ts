import { FONT, STORY_HEIGHT, STORY_WIDTH } from '@/lib/smm-canvas';
import type { SubtitleCue } from '@/lib/smm-premiere-voiceover';

const MAX_SECONDS = 15;

function pickMimeType(): string {
  const candidates = [
    'video/mp4;codecs=avc1.64002A,mp4a.40.2',
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4;codecs=avc1.4D0028,mp4a.40.2',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return (
    candidates.find((type) =>
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(type)
    ) || 'video/webm'
  );
}

function createRecorder(stream: MediaStream): {
  recorder: MediaRecorder;
  mime: string;
} {
  const mime = pickMimeType();
  try {
    return {
      recorder: new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 6_000_000,
        audioBitsPerSecond: 160_000,
      }),
      mime,
    };
  } catch {
    return {
      recorder: new MediaRecorder(stream, {
        videoBitsPerSecond: 6_000_000,
      }),
      mime: 'video/webm',
    };
  }
}

async function decodeAudio(
  ctx: AudioContext,
  dataUrl: string
): Promise<AudioBuffer> {
  const res = await fetch(dataUrl);
  const raw = await res.arrayBuffer();
  return ctx.decodeAudioData(raw.slice(0));
}

export async function recordKenBurnsVideo(options: {
  source: HTMLCanvasElement;
  voiceDataUrl: string;
  soundDataUrl?: string | null;
  maxSeconds?: number;
  onProgress?: (ratio: number) => void;
}): Promise<{ blob: Blob; mime: string; durationMs: number }> {
  const maxSeconds = options.maxSeconds ?? MAX_SECONDS;
  const source = options.source;
  const width = source.width;
  const height = source.height;
  if (!width || !height) {
    throw new Error('Նկարը դեռ պատրաստ չէ');
  }

  const poster = document.createElement('canvas');
  poster.width = width;
  poster.height = height;
  const posterCtx = poster.getContext('2d');
  if (!posterCtx) throw new Error('Canvas unavailable');
  posterCtx.drawImage(source, 0, 0);

  const frame = document.createElement('canvas');
  frame.width = width;
  frame.height = height;
  const frameCtx = frame.getContext('2d');
  if (!frameCtx) throw new Error('Canvas unavailable');

  const audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  const voiceBuffer = await decodeAudio(audioCtx, options.voiceDataUrl);
  const voiceDuration = voiceBuffer.duration;
  const duration = Math.min(maxSeconds, Math.max(6, voiceDuration + 0.45));

  let soundBuffer: AudioBuffer | null = null;
  if (options.soundDataUrl) {
    try {
      soundBuffer = await decodeAudio(audioCtx, options.soundDataUrl);
    } catch {
      soundBuffer = null;
    }
  }

  const dest = audioCtx.createMediaStreamDestination();
  const voiceGain = audioCtx.createGain();
  voiceGain.gain.value = 1;
  const soundGain = audioCtx.createGain();
  soundGain.gain.value = soundBuffer ? 0.22 : 0;

  const voiceSource = audioCtx.createBufferSource();
  voiceSource.buffer = voiceBuffer;
  voiceSource.connect(voiceGain);
  voiceGain.connect(dest);
  voiceGain.connect(audioCtx.destination);

  if (soundBuffer) {
    const soundSource = audioCtx.createBufferSource();
    soundSource.buffer = soundBuffer;
    soundSource.loop = soundBuffer.duration + 0.05 < duration;
    soundSource.connect(soundGain);
    soundGain.connect(dest);
    soundGain.connect(audioCtx.destination);
    soundSource.start(0);
    soundSource.stop(duration);
  } else {
    const osc = audioCtx.createOscillator();
    const rumble = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 48;
    rumble.gain.value = 0.04;
    osc.connect(rumble);
    rumble.connect(dest);
    osc.start(0);
    osc.stop(duration);
  }

  voiceSource.start(0);
  voiceSource.stop(duration);

  const stream = frame.captureStream(30);
  dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

  const { recorder, mime } = createRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const started = performance.now();
  const draw = () => {
    const elapsed = (performance.now() - started) / 1000;
    const t = Math.min(1, elapsed / duration);
    const zoom = 1 + t * 0.12;
    const dw = width * zoom;
    const dh = height * zoom;
    const dx = (width - dw) / 2;
    const dy = (height - dh) * 0.35;
    frameCtx.fillStyle = '#09090f';
    frameCtx.fillRect(0, 0, width, height);
    frameCtx.drawImage(poster, dx, dy, dw, dh);
    options.onProgress?.(t);
  };

  await new Promise<void>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('Վիդեոն չհաջողվեց ձայնագրել'));
    recorder.onstop = () => resolve();
    recorder.start(200);
    draw();
    const timer = window.setInterval(() => {
      draw();
      if ((performance.now() - started) / 1000 >= duration) {
        window.clearInterval(timer);
        try {
          recorder.stop();
        } catch {
          resolve();
        }
        stream.getTracks().forEach((track) => track.stop());
      }
    }, 1000 / 30);
  });

  await audioCtx.close().catch(() => undefined);

  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  if (blob.size < 1000) {
    throw new Error('Վիդեոն դատարկ է');
  }
  return { blob, mime: blob.type || mime, durationMs: duration * 1000 };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function videoExtension(mime: string): string {
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

function wrapSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function drawCoverVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number
) {
  const vw = video.videoWidth || width;
  const vh = video.videoHeight || height;
  const scale = Math.max(width / vw, height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
}

function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number
) {
  const maxWidth = width - 160;
  ctx.font = `700 52px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const lines = wrapSubtitle(ctx, text, maxWidth);
  const lineHeight = 64;
  const padY = 28;
  const boxHeight = lines.length * lineHeight + padY * 2;
  const boxWidth = width - 64;
  const top = Math.round(height * 0.16);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  const x = (width - boxWidth) / 2;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, top, boxWidth, boxHeight, 28);
    ctx.fill();
  } else {
    ctx.fillRect(x, top, boxWidth, boxHeight);
  }

  lines.forEach((line, i) => {
    const y = top + padY + i * lineHeight;
    ctx.lineWidth = 8;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.strokeText(line, width / 2, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, width / 2, y);
  });
}

function waitForVideo(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Թրեյլերը չհաջողվեց բացել'));
    };
    const cleanup = () => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('error', onError);
    };
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('error', onError);
  });
}

export async function recordTrailerWithVoiceAndSubtitles(options: {
  trailerUrl: string;
  voiceDataUrl: string;
  cues: SubtitleCue[];
  onProgress?: (ratio: number) => void;
}): Promise<{ blob: Blob; mime: string; durationMs: number }> {
  const video = document.createElement('video');
  video.src = options.trailerUrl;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.muted = false;
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  document.body.appendChild(video);

  try {
    await waitForVideo(video);
    await new Promise<void>((resolve) => {
      if (video.currentTime === 0) {
        resolve();
        return;
      }
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = 0;
    });

    const width = STORY_WIDTH;
    const height = STORY_HEIGHT;
    const frame = document.createElement('canvas');
    frame.width = width;
    frame.height = height;
    const frameCtx = frame.getContext('2d');
    if (!frameCtx) throw new Error('Canvas unavailable');

    const audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    const voiceBuffer = await decodeAudio(audioCtx, options.voiceDataUrl);
    const duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : Math.max(6, voiceBuffer.duration + 0.45);
    const voiceEnd = Math.min(voiceBuffer.duration, duration);

    const dest = audioCtx.createMediaStreamDestination();
    const trailerSource = audioCtx.createMediaElementSource(video);
    const trailerGain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    trailerGain.gain.setValueAtTime(0.18, now);
    trailerGain.gain.setValueAtTime(0.18, now + voiceEnd);
    trailerGain.gain.linearRampToValueAtTime(0.9, now + voiceEnd + 0.45);
    trailerSource.connect(trailerGain);
    trailerGain.connect(dest);

    const voiceGain = audioCtx.createGain();
    voiceGain.gain.value = 1;
    const voiceSource = audioCtx.createBufferSource();
    voiceSource.buffer = voiceBuffer;
    voiceSource.connect(voiceGain);
    voiceGain.connect(dest);
    voiceGain.connect(audioCtx.destination);

    const stream = frame.captureStream(30);
    dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));

    const { recorder, mime } = createRecorder(stream);
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const draw = (t: number) => {
      frameCtx.fillStyle = '#09090f';
      frameCtx.fillRect(0, 0, width, height);
      drawCoverVideo(frameCtx, video, width, height);
      const cue = options.cues.find((item) => t >= item.start && t < item.end);
      if (cue) drawSubtitle(frameCtx, cue.text, width, height);
      options.onProgress?.(Math.min(1, t / duration));
    };

    voiceSource.start(0);
    voiceSource.stop(voiceEnd);
    try {
      await video.play();
    } catch {
      throw new Error('Թրեյլերը չհաջողվեց նվագարկել');
    }

    const started = performance.now();
    await new Promise<void>((resolve, reject) => {
      let finished = false;
      let timer = 0;
      const finish = () => {
        if (finished) return;
        finished = true;
        window.clearInterval(timer);
        video.pause();
        try {
          recorder.stop();
        } catch {
          resolve();
        }
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.onerror = () => reject(new Error('Վիդեոն չհաջողվեց ձայնագրել'));
      recorder.onstop = () => resolve();
      video.addEventListener('ended', finish, { once: true });
      recorder.start(200);
      draw(0);
      timer = window.setInterval(() => {
        const wall = (performance.now() - started) / 1000;
        const t = Math.min(duration, video.currentTime || wall);
        draw(t);
        if (video.ended || t >= duration - 0.04 || wall >= duration + 0.35) {
          finish();
        }
      }, 1000 / 30);
    });

    try {
      trailerSource.disconnect();
      trailerGain.disconnect();
      voiceGain.disconnect();
    } catch {
      /* already closed */
    }
    await audioCtx.close().catch(() => undefined);

    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    if (blob.size < 1000) throw new Error('Վիդեոն դատարկ է');
    return { blob, mime: blob.type || mime, durationMs: duration * 1000 };
  } finally {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}
