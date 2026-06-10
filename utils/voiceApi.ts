import { Platform } from 'react-native';
import { CreateVoiceCallPayload, VoiceCall } from './voiceTypes';

const DEV_QUEUE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:5001' : 'http://localhost:5001';

const VOICE_API_BASE_URL =
  process.env.EXPO_PUBLIC_QUEUE_API_URL?.replace(/\/$/, '') ||
  (__DEV__ ? DEV_QUEUE_URL : '');

function getConfigError(): string | null {
  if (VOICE_API_BASE_URL) return null;
  return 'Set EXPO_PUBLIC_QUEUE_API_URL in .env to your Railway service URL';
}

async function voiceFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const configError = getConfigError();
  if (configError) throw new Error(configError);

  const response = await fetch(`${VOICE_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  let data: Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    let msg =
      (typeof data.error === 'string' && data.error) ||
      `Request failed (${response.status})`;

    const vapiDetails = data.vapiDetails as Record<string, unknown> | undefined;
    if (vapiDetails) {
      const vapiMessage = vapiDetails.message;
      if (Array.isArray(vapiMessage)) {
        msg = vapiMessage.join('; ');
      } else if (typeof vapiMessage === 'string' && vapiMessage.trim()) {
        msg = vapiMessage;
      }
    }

    throw new Error(msg);
  }

  return data as T;
}

export async function createRestaurantCall(
  payload: CreateVoiceCallPayload
): Promise<VoiceCall> {
  return voiceFetch<VoiceCall>('/calls', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchVoiceCall(callId: number): Promise<VoiceCall> {
  return voiceFetch<VoiceCall>(`/calls/${callId}`);
}

export async function pollVoiceCallUntilDone(
  callId: number,
  options?: { timeoutMs?: number; intervalMs?: number }
): Promise<VoiceCall> {
  const timeoutMs = options?.timeoutMs ?? 180_000;
  const intervalMs = options?.intervalMs ?? 3_000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const call = await fetchVoiceCall(callId);
    if (call.status === 'completed' || call.status === 'failed') {
      return call;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Still waiting for an answer. Check back in a moment.');
}
