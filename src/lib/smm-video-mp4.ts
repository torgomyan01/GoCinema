type Mp4Result = { blob: Blob; mime: string };

const CORE_BASE =
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';

let ffmpegLoader: Promise<import('@ffmpeg/ffmpeg').FFmpeg> | null = null;

function isMp4(mime: string): boolean {
  return mime.includes('mp4');
}

async function getFfmpeg(): Promise<import('@ffmpeg/ffmpeg').FFmpeg> {
  if (!ffmpegLoader) {
    ffmpegLoader = (async () => {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      const ffmpeg = new FFmpeg();
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${CORE_BASE}/ffmpeg-core.js`,
          'text/javascript'
        ),
        wasmURL: await toBlobURL(
          `${CORE_BASE}/ffmpeg-core.wasm`,
          'application/wasm'
        ),
      });
      return ffmpeg;
    })();
  }
  return ffmpegLoader;
}

/** If the blob is already MP4, return it. Otherwise convert WebM → H.264 MP4. */
export async function ensureMp4Blob(
  blob: Blob,
  mime: string,
  onProgress?: (ratio: number) => void
): Promise<Mp4Result> {
  if (isMp4(mime) || isMp4(blob.type)) {
    return { blob, mime: blob.type || 'video/mp4' };
  }

  const { fetchFile } = await import('@ffmpeg/util');
  const ffmpeg = await getFfmpeg();
  const onFfmpegProgress = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(1, Math.max(0, progress)));
  };
  ffmpeg.on('progress', onFfmpegProgress);

  const inputName = 'input.webm';
  try {
    await ffmpeg.writeFile(inputName, await fetchFile(blob));
    const code = await ffmpeg.exec([
      '-i',
      inputName,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      'output.mp4',
    ]);
    if (code !== 0) {
      throw new Error('MP4 փոխակերպումը չհաջողվեց');
    }
    const data = await ffmpeg.readFile('output.mp4');
    if (!(data instanceof Uint8Array)) {
      throw new Error('MP4 փոխակերպումը չհաջողվեց');
    }
    const bytes = new Uint8Array(data.byteLength);
    bytes.set(data);
    const out = new Blob([bytes], { type: 'video/mp4' });
    if (out.size < 1000) {
      throw new Error('MP4 ֆայլը դատարկ է');
    }
    return { blob: out, mime: 'video/mp4' };
  } finally {
    ffmpeg.off('progress', onFfmpegProgress);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile('output.mp4').catch(() => undefined);
  }
}
