export interface TranscribeResult {
  text: string;
  lang?: string;
  provider?: string;
  error?: string;
}

function apiBaseUrl(): string {
  return import.meta.env.VITE_VITRINA_API_URL || '/api';
}

export async function transcribeAudio(blob: Blob, opts?: { polish?: boolean }): Promise<TranscribeResult> {
  const polish = opts?.polish ?? false;
  const mime = blob.type || 'audio/webm';
  const filename = `recording.${mime.includes('webm') ? 'webm' : 'ogg'}`;
  const paths = [
    `${apiBaseUrl()}/transcribe?polish=${polish ? 'true' : 'false'}&provider=auto`,
    `${apiBaseUrl()}/api/transcribe?polish=${polish ? 'true' : 'false'}&provider=auto`,
  ];

  for (const path of paths) {
    const fd = new FormData();
    fd.append('audio', blob, filename);
    try {
      const res = await fetch(path, {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as TranscribeResult;
      if (!res.ok) {
        if (res.status === 404) continue;
        return { text: '', error: data.error || `HTTP ${res.status}` };
      }
      return { ...data, text: (data.text || '').trim() };
    } catch (e) {
      if (path !== paths[paths.length - 1]) continue;
      return { text: '', error: e instanceof Error ? e.message : 'network error' };
    }
  }
  return { text: '', error: 'Voice transcription is unavailable on this preview.' };
}
