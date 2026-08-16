'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminRole } from '@/lib/roles';
import { getSmmPremieres } from '@/app/actions/instagram-story';
import {
  SMM_VIDEO_MAX_SECONDS,
  elevenLabsTextToSpeechWithAlignment,
  elevenLabsTrailerSound,
  hasElevenLabsConfig,
  toDataUrl,
} from '@/lib/elevenlabs';
import {
  salesCaptionForPremiere,
  salesVoiceoverForPremiere,
  subtitleCuesFromVoiceover,
  toMovieTrailerTts,
  type SubtitleCue,
} from '@/lib/smm-premiere-voiceover';

function requireAdmin() {
  return getServerSession(authOptions).then((session) => {
    const user = session?.user as { id?: string; role?: string } | undefined;
    return Boolean(user?.id && isAdminRole(user.role));
  });
}

export async function getPremiereSalesScript(premiereId: number): Promise<{
  success: boolean;
  error?: string;
  voiceover?: string;
  caption?: string;
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }

  const data = await getSmmPremieres();
  const premiere = data.premieres.find((row) => row.id === premiereId);
  if (!premiere) {
    return { success: false, error: 'Պրեմիերան չի գտնվել' };
  }

  return {
    success: true,
    voiceover: salesVoiceoverForPremiere(premiere),
    caption: salesCaptionForPremiere(premiere),
  };
}

export async function generatePremiereVideoAudio(data: {
  premiereId: number;
  voiceover?: string;
}): Promise<{
  success: boolean;
  error?: string;
  voiceover?: string;
  caption?: string;
  voiceDataUrl?: string;
  soundDataUrl?: string | null;
  maxSeconds?: number;
  cues?: SubtitleCue[];
}> {
  if (!(await requireAdmin())) {
    return { success: false, error: 'Մուտքն արգելված է' };
  }
  if (!hasElevenLabsConfig()) {
    return {
      success: false,
      error: 'ElevenLabs API key-ը բացակայում է (.env)',
    };
  }

  const list = await getSmmPremieres();
  const premiere = list.premieres.find((row) => row.id === data.premiereId);
  if (!premiere) {
    return { success: false, error: 'Պրեմիերան չի գտնվել' };
  }

  const voiceover = (data.voiceover || salesVoiceoverForPremiere(premiere))
    .trim()
    .slice(0, 500);
  if (!voiceover) {
    return { success: false, error: 'Տեքստը դատարկ է' };
  }

  try {
    const ttsText = toMovieTrailerTts(voiceover);
    const voice = await elevenLabsTextToSpeechWithAlignment(ttsText);
    const sound = await elevenLabsTrailerSound(SMM_VIDEO_MAX_SECONDS).catch(
      () => null
    );
    const cues = subtitleCuesFromVoiceover(ttsText, voice.alignment);

    return {
      success: true,
      voiceover,
      caption: salesCaptionForPremiere(premiere),
      voiceDataUrl: toDataUrl(voice.mime, voice.bytes),
      soundDataUrl: sound ? toDataUrl(sound.mime, sound.bytes) : null,
      maxSeconds: SMM_VIDEO_MAX_SECONDS,
      cues,
    };
  } catch (error) {
    console.error('[generatePremiereVideoAudio]', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Ձայնը գեներացնելիս սխալ է տեղի ունեցել',
    };
  }
}
