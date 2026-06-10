export type VoiceCallStatus = 'dialing' | 'in_progress' | 'completed' | 'failed';

export type VoiceCall = {
  id: number;
  restaurantId: number;
  questionForRestaurant: string;
  status: VoiceCallStatus;
  vapiCallId?: string | null;
  answerSummary?: string | null;
  transcript?: string | null;
  waitMinutes?: number | null;
  errorMessage?: string | null;
  deviceId?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type CreateVoiceCallPayload = {
  restaurantId: number;
  questionForRestaurant: string;
  deviceId?: string;
  pushToken?: string;
};
