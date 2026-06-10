import { query } from './db.js';
import { formatPhoneE164 } from './phone.js';

const VAPI_API_URL = 'https://api.vapi.ai/call';
const MAX_QUESTION_LENGTH = 500;
const MIN_QUESTION_LENGTH = 3;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function cleanEnvValue(value) {
  return value?.trim().replace(/\.+$/, '') ?? '';
}

function formatVapiError(data) {
  if (Array.isArray(data?.message)) return data.message.join('; ');
  if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  try {
    return JSON.stringify(data);
  } catch {
    return 'Unknown Vapi error';
  }
}

function mapVoiceCall(row) {
  if (!row) return null;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    questionForRestaurant: row.question_for_restaurant,
    status: row.status,
    vapiCallId: row.vapi_call_id,
    answerSummary: row.answer_summary,
    transcript: row.transcript,
    waitMinutes: row.wait_minutes,
    errorMessage: row.error_message,
    deviceId: row.device_id,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function getVapiConfig() {
  const apiKey = cleanEnvValue(process.env.VAPI_API_KEY);
  const assistantId = cleanEnvValue(process.env.VAPI_ASSISTANT_ID);
  const phoneNumberId = cleanEnvValue(process.env.VAPI_PHONE_NUMBER_ID);

  const missing = [];
  if (!apiKey) missing.push('VAPI_API_KEY');
  if (!assistantId) missing.push('VAPI_ASSISTANT_ID');
  if (!phoneNumberId) missing.push('VAPI_PHONE_NUMBER_ID');
  if (missing.length) {
    throw new Error(`Voice calling is not configured (${missing.join(', ')})`);
  }

  if (!UUID_RE.test(assistantId)) {
    throw new Error(
      'VAPI_ASSISTANT_ID looks invalid — copy the full UUID from Vapi (no trailing ...)'
    );
  }
  if (!UUID_RE.test(phoneNumberId)) {
    throw new Error(
      'VAPI_PHONE_NUMBER_ID looks invalid — copy the full UUID from Vapi (no trailing ...)'
    );
  }

  return { apiKey, assistantId, phoneNumberId };
}

function normalizeQuestion(text) {
  return text?.trim().replace(/\s+/g, ' ') ?? '';
}

function extractWaitMinutes(question, summary) {
  if (!/wait/i.test(question) || !summary) return null;
  const match = summary.match(/(\d+)\s*(?:min(?:ute)?s?|m\b)/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes >= 0 && minutes <= 600 ? minutes : null;
}

async function getRestaurantById(restaurantId) {
  const { rows } = await query('SELECT id, name, phone FROM restaurants WHERE id = $1', [
    restaurantId,
  ]);
  return rows[0] ?? null;
}

export async function getVoiceCall(callId) {
  const { rows } = await query('SELECT * FROM voice_calls WHERE id = $1', [callId]);
  if (!rows[0]) return null;

  let row = rows[0];
  if (row.status === 'dialing' || row.status === 'in_progress') {
    row = (await syncVoiceCallFromVapi(row)) ?? row;
  }

  return mapVoiceCall(row);
}

async function fetchVapiCallRecord(vapiCallId) {
  const { apiKey } = getVapiConfig();
  const response = await fetch(`https://api.vapi.ai/call/${vapiCallId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildAnswerFromMessages(messages) {
  if (!Array.isArray(messages)) return null;

  const userLines = messages
    .filter((m) => m.role === 'user')
    .map((m) => (m.message || m.content || m.text || '').trim())
    .filter(Boolean);

  if (userLines.length === 0) return null;
  return userLines.slice(-4).join(' ');
}

function buildAnswerFromTranscript(transcript) {
  if (!transcript?.trim()) return null;

  const lines = transcript.split('\n').filter(Boolean);
  const userLines = lines
    .map((line) => {
      const match = line.match(/^(?:user|customer)\s*:\s*(.+)$/i);
      return match?.[1]?.trim() ?? null;
    })
    .filter(Boolean);

  if (userLines.length > 0) return userLines.slice(-4).join(' ');

  return lines.slice(-4).join(' ').trim().slice(0, 600) || null;
}

function extractAnswerFromVapiPayload(vapiCall, question) {
  const analysisSummary = vapiCall.analysis?.summary;
  if (typeof analysisSummary === 'string' && analysisSummary.trim()) {
    return analysisSummary.trim();
  }

  const topSummary = vapiCall.summary;
  if (typeof topSummary === 'string' && topSummary.trim()) return topSummary.trim();

  const structured = vapiCall.analysis?.structuredData;
  if (structured && typeof structured === 'object') {
    if (typeof structured.answer === 'string' && structured.answer.trim()) {
      return structured.answer.trim();
    }
    if (typeof structured.answerSummary === 'string' && structured.answerSummary.trim()) {
      return structured.answerSummary.trim();
    }
  }

  const fromMessages = buildAnswerFromMessages(vapiCall.artifact?.messages || vapiCall.messages);
  if (fromMessages) return fromMessages;

  const transcript = vapiCall.artifact?.transcript || vapiCall.transcript;
  const fromTranscript = buildAnswerFromTranscript(transcript);
  if (fromTranscript) return fromTranscript;

  if (/wait/i.test(question)) {
    return 'The call finished, but no wait time was captured. Try asking again.';
  }

  return 'The call finished, but no clear answer was captured. Try asking again.';
}

function pickTranscriptFromVapi(vapiCall) {
  if (typeof vapiCall.artifact?.transcript === 'string') return vapiCall.artifact.transcript;
  if (typeof vapiCall.transcript === 'string') return vapiCall.transcript;
  return pickTranscript(vapiCall);
}

function isVapiCallEnded(vapiCall) {
  return vapiCall.status === 'ended' || Boolean(vapiCall.endedAt);
}

function isVapiCallFailureReason(endedReason) {
  if (!endedReason) return false;
  const reason = String(endedReason).toLowerCase();
  return (
    reason.includes('fail') ||
    reason.includes('error') ||
    reason.includes('busy') ||
    reason.includes('no-answer') ||
    reason.includes('no answer') ||
    reason.includes('voicemail') ||
    reason.includes('machine') ||
    reason.includes('unanswered')
  );
}

async function finalizeVoiceCallRecord(callRecord, { answerSummary, transcript, failed, errorMessage }) {
  const waitMinutes = extractWaitMinutes(callRecord.question_for_restaurant, answerSummary);

  const { rows } = await query(
    `UPDATE voice_calls
     SET status = $2,
         answer_summary = $3,
         transcript = COALESCE($4, transcript),
         wait_minutes = $5,
         error_message = $6,
         completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      callRecord.id,
      failed ? 'failed' : 'completed',
      answerSummary,
      transcript,
      waitMinutes,
      errorMessage ?? null,
    ]
  );

  if (waitMinutes !== null) {
    await query(
      `UPDATE restaurants
       SET wait_minutes = $2,
           last_called_at = NOW()
       WHERE id = $1`,
      [callRecord.restaurant_id, waitMinutes]
    );
  } else {
    await query(`UPDATE restaurants SET last_called_at = NOW() WHERE id = $1`, [
      callRecord.restaurant_id,
    ]);
  }

  return rows[0];
}

async function syncVoiceCallFromVapi(callRecord) {
  if (!callRecord.vapi_call_id) return callRecord;
  if (callRecord.status === 'completed' || callRecord.status === 'failed') return callRecord;

  const callAgeMs = Date.now() - new Date(callRecord.created_at).getTime();
  if (callAgeMs < 10_000) return callRecord;

  try {
    const vapiCall = await fetchVapiCallRecord(callRecord.vapi_call_id);
    if (!vapiCall || !isVapiCallEnded(vapiCall)) return callRecord;

    const transcript = pickTranscriptFromVapi(vapiCall);
    const endedReason = vapiCall.endedReason || vapiCall.endReason;
    const failed = isVapiCallFailureReason(endedReason);

    const answerSummary = failed
      ? `Call ended (${endedReason}). No answer was captured.`
      : extractAnswerFromVapiPayload(vapiCall, callRecord.question_for_restaurant);

    return (
      (await finalizeVoiceCallRecord(callRecord, {
        answerSummary,
        transcript,
        failed,
        errorMessage: failed ? String(endedReason) : null,
      })) ?? callRecord
    );
  } catch (err) {
    console.error('Vapi sync failed:', err.message);
    return callRecord;
  }
}

export async function createVoiceCall({
  restaurantId,
  questionForRestaurant,
  deviceId,
  pushToken,
}) {
  const vapiConfig = getVapiConfig();

  const question = normalizeQuestion(questionForRestaurant);
  if (question.length < MIN_QUESTION_LENGTH) {
    throw new Error('Please enter a question (at least 3 characters)');
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new Error(`Question is too long (max ${MAX_QUESTION_LENGTH} characters)`);
  }

  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) throw new Error('Restaurant not found');
  const destinationPhone = formatPhoneE164(restaurant.phone);
  if (!destinationPhone) {
    throw new Error('Restaurant phone number is missing or invalid');
  }

  const { rows } = await query(
    `INSERT INTO voice_calls
     (restaurant_id, question_for_restaurant, status, device_id, push_token)
     VALUES ($1, $2, 'dialing', $3, $4)
     RETURNING *`,
    [restaurantId, question, deviceId || null, pushToken || null]
  );
  const callRecord = rows[0];

  const payload = {
    assistantId: vapiConfig.assistantId,
    phoneNumberId: vapiConfig.phoneNumberId,
    customer: { number: destinationPhone },
    assistantOverrides: {
      variableValues: {
        restaurant_name: restaurant.name,
        user_question: question,
      },
    },
  };

  const response = await fetch(VAPI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${vapiConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const message = formatVapiError(data) || `Vapi request failed (${response.status})`;
    const err = new Error(message);
    err.vapiStatus = response.status;
    err.vapiDetails = data;

    await query(
      `UPDATE voice_calls
       SET status = 'failed', error_message = $2, completed_at = NOW()
       WHERE id = $1`,
      [callRecord.id, message]
    );
    throw err;
  }

  const vapiCallId = data.id || data.call?.id;
  if (!vapiCallId) {
    await query(
      `UPDATE voice_calls
       SET status = 'failed', error_message = $2, completed_at = NOW()
       WHERE id = $1`,
      [callRecord.id, 'Vapi did not return a call id']
    );
    throw new Error('Call was not placed. No confirmation from Vapi.');
  }

  if (data.status === 'ended') {
    const reason = data.endedReason || data.endReason || 'unknown';
    const message = `Call could not connect (${reason})`;
    await query(
      `UPDATE voice_calls
       SET status = 'failed', error_message = $2, vapi_call_id = $3, completed_at = NOW()
       WHERE id = $1`,
      [callRecord.id, message, vapiCallId]
    );
    throw new Error(message);
  }

  const { rows: updatedRows } = await query(
    `UPDATE voice_calls
     SET vapi_call_id = $2, status = 'in_progress'
     WHERE id = $1
     RETURNING *`,
    [callRecord.id, vapiCallId]
  );

  return mapVoiceCall(updatedRows[0]);
}

function pickTranscript(message) {
  if (typeof message.transcript === 'string') return message.transcript;
  if (typeof message.artifact?.transcript === 'string') return message.artifact.transcript;
  if (Array.isArray(message.messages)) {
    return message.messages
      .map((m) => {
        const role = m.role || m.type || 'unknown';
        const text = m.message || m.content || m.text || '';
        return `${role}: ${text}`.trim();
      })
      .filter(Boolean)
      .join('\n');
  }
  return null;
}

function pickSummary(message) {
  if (typeof message.summary === 'string' && message.summary.trim()) return message.summary.trim();
  if (typeof message.analysis?.summary === 'string' && message.analysis.summary.trim()) {
    return message.analysis.summary.trim();
  }
  if (typeof message.artifact?.summary === 'string' && message.artifact.summary.trim()) {
    return message.artifact.summary.trim();
  }
  if (typeof message.call?.analysis?.summary === 'string' && message.call.analysis.summary.trim()) {
    return message.call.analysis.summary.trim();
  }
  return null;
}

function buildAnswerFromWebhook(message, question) {
  const summary = pickSummary(message);
  if (summary) return summary;

  const transcript = pickTranscript(message);
  const fromTranscript = buildAnswerFromTranscript(transcript);
  if (fromTranscript) return fromTranscript;

  const fromMessages = buildAnswerFromMessages(message.artifact?.messages || message.messages);
  if (fromMessages) return fromMessages;

  if (/wait/i.test(question)) {
    return 'The call finished, but no wait time was captured. Try asking again.';
  }

  return 'The call finished, but no clear answer was captured. Try asking again.';
}

export async function handleVapiWebhook(body) {
  const message = body?.message ?? body;
  const type = message?.type;

  if (!type) return { handled: false };

  const vapiCallId = message.call?.id || message.callId || body?.call?.id;
  if (!vapiCallId) return { handled: false, reason: 'missing call id' };

  const { rows } = await query('SELECT * FROM voice_calls WHERE vapi_call_id = $1', [vapiCallId]);
  const callRecord = rows[0];
  if (!callRecord) return { handled: false, reason: 'unknown call' };

  if (type === 'status-update') {
    const status = message.status || message.call?.status;
    if (status === 'ended' || status === 'completed') {
      // Final details usually arrive in end-of-call-report; mark progress only.
      await query(
        `UPDATE voice_calls SET status = 'in_progress' WHERE id = $1 AND status = 'dialing'`,
        [callRecord.id]
      );
    }
    return { handled: true, type };
  }

  if (type === 'end-of-call-report') {
    const transcript = pickTranscript(message);
    const endedReason = message.endedReason || message.call?.endedReason;
    const failed = isVapiCallFailureReason(endedReason);

    const answerSummary = failed
      ? `Call ended (${endedReason}). No answer was captured.`
      : buildAnswerFromWebhook(message, callRecord.question_for_restaurant);

    const updated = await finalizeVoiceCallRecord(callRecord, {
      answerSummary,
      transcript,
      failed,
      errorMessage: failed ? String(endedReason) : null,
    });

    return { handled: true, type, callId: updated.id };
  }

  return { handled: true, type, ignored: true };
}
