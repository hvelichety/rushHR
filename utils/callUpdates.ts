import { VoiceCall } from './voiceTypes';

export type CallUpdateDisplayStatus = 'calling' | 'ready' | 'failed';

export type CallUpdate = {
  callId: number;
  restaurantId: number;
  restaurantName: string;
  question: string;
  status: CallUpdateDisplayStatus;
  answerSummary?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
  isUnread: boolean;
};

export function voiceCallToUpdate(call: VoiceCall, isUnread = false): CallUpdate {
  const restaurantName = call.restaurantName?.trim() || 'Restaurant';
  const status = mapVoiceStatus(call.status);

  return {
    callId: call.id,
    restaurantId: call.restaurantId,
    restaurantName,
    question: call.questionForRestaurant,
    status,
    answerSummary: call.answerSummary,
    errorMessage: call.errorMessage,
    createdAt: call.createdAt,
    completedAt: call.completedAt ?? null,
    isUnread,
  };
}

function mapVoiceStatus(status: VoiceCall['status']): CallUpdateDisplayStatus {
  if (status === 'completed') return 'ready';
  if (status === 'failed') return 'failed';
  return 'calling';
}

export function isActiveCallStatus(status: VoiceCall['status']) {
  return status === 'dialing' || status === 'in_progress';
}

export function formatUpdateTime(iso: string | null | undefined): string {
  if (!iso) return 'Just now';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'Just now';

  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
