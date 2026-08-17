const ELEVEN_BASE = 'https://api.elevenlabs.io';
export const SMM_VIDEO_MAX_SECONDS = 15;

function apiKey(): string {
  return (process.env.ELEVENLABS_API_KEY || '').trim();
}

export function hasElevenLabsConfig(): boolean {
  return Boolean(apiKey());
}

function voiceId(): string {
  return (
    (process.env.ELEVENLABS_VOICE_ID || '').trim() ||
    'nPczCjzI2devNBz1zQrb'
  );
}

function modelId(): string {
  return 'eleven_v3';
}

/** v3: Robust 1 — հայերեն արտասանությունն ավելի կայուն է */
function v3VoiceSettings() {
  return {
    stability: 1,
    similarity_boost: 0.75,
  };
}

function ttsPayload(text: string) {
  return {
    text: text.trim(),
    model_id: modelId(),
    language_code: 'hy',
    voice_settings: v3VoiceSettings(),
    apply_text_normalization: 'off' as const,
  };
}

function elevenErrorMessage(status: number, body: string): string {
  const snippet = body.replace(/\s+/g, ' ').trim().slice(0, 180);
  const blockedByCloudflare =
    status === 403 &&
    /just a moment|cf-ray|cloudflare|<!doctype html|<html/i.test(body);

  if (blockedByCloudflare) {
    return 'ElevenLabs TTS սխալ (403). Cloudflare-ը արգելափակել է սերվերի IP-ն, ոչ API key-ը։ VPS-ից ստուգիր՝ curl -I https://api.elevenlabs.io/v1/user -H "xi-api-key: $ELEVENLABS_API_KEY"';
  }

  return `ElevenLabs TTS սխալ (${status})${snippet ? `: ${snippet}` : ''}`;
}

async function elevenFetch(path: string, init: RequestInit): Promise<Response> {
  const key = apiKey();
  if (!key) {
    throw new Error('ELEVENLABS_API_KEY բացակայում է');
  }
  return fetch(`${ELEVEN_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'User-Agent': 'GoCinema/1.0 (+https://gocinema.am)',
      'xi-api-key': key,
      ...(init.headers || {}),
    },
  });
}

export async function elevenLabsTextToSpeech(
  text: string
): Promise<{ mime: string; bytes: Buffer }> {
  const body = ttsPayload(text);

  const res = await elevenFetch(
    `/v1/text-to-speech/${voiceId()}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(elevenErrorMessage(res.status, detail));
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  return { mime: 'audio/mpeg', bytes };
}

/** Կինո-թրեյլեր ֆոնային sound. Եթե հաշիվը չի աջակցում՝ null */
export async function elevenLabsTrailerSound(
  durationSeconds: number
): Promise<{ mime: string; bytes: Buffer } | null> {
  const duration = Math.min(
    SMM_VIDEO_MAX_SECONDS,
    Math.max(6, Math.round(durationSeconds))
  );
  const res = await elevenFetch('/v1/sound-generation', {
    method: 'POST',
    headers: {
      Accept: 'audio/mpeg',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: 'cinematic movie trailer rumble, soft whoosh, no speech, no vocals',
      duration_seconds: duration,
      prompt_influence: 0.35,
    }),
  });

  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length < 100) return null;
  return { mime: 'audio/mpeg', bytes };
}

export function toDataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

export type ElevenLabsAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export async function elevenLabsTextToSpeechWithAlignment(
  text: string
): Promise<{
  mime: string;
  bytes: Buffer;
  alignment: ElevenLabsAlignment | null;
}> {
  const body = ttsPayload(text);

  const res = await elevenFetch(
    `/v1/text-to-speech/${voiceId()}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (res.ok) {
    const json = (await res.json()) as {
      audio_base64?: string;
      alignment?: ElevenLabsAlignment;
    };
    if (json.audio_base64) {
      return {
        mime: 'audio/mpeg',
        bytes: Buffer.from(json.audio_base64, 'base64'),
        alignment: json.alignment ?? null,
      };
    }
  }

  const fallback = await elevenLabsTextToSpeech(text);
  return { ...fallback, alignment: null };
}
