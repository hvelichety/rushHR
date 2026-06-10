import { query } from './db.js';

const VAPI_API_URL = 'https://api.vapi.ai/call';
const MAX_QUESTION_LENGTH = 500;
const MIN_QUESTION_LENGTH = 3;

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

function assertVapiConfigured() {
  const missing = [];
  if (!process.env.VAPI_API_KEY) missing.push('VAPI_API_KEY');
  if (!process.env.VAPI_ASSISTANT_ID) missing.push('VAPI_ASSISTANT_ID');
  if (!process.env.VAPI_PHONE_NUMBER_ID) missing.push('VAPI_PHONE_NUMBER_ID');
  if (missing.length) {
    throw new Error(`Voice calling is not configured (${missing.join(', ')})`);
  }
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
  return mapVoiceCall(rows[0]);
}

export async function createVoiceCall({
  restaurantId,
  questionForRestaurant,
  deviceId,
  pushToken,
}) {
  assertVapiConfigured();

  const question = normalizeQuestion(questionForRestaurant);
  if (question.length < MIN_QUESTION_LENGTH) {
    throw new Error('Please enter a question (at least 3 characters)');
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new Error(`Question is too long (max ${MAX_QUESTION_LENGTH} characters)`);
  }

  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) throw new Error('Restaurant not found');
  if (!restaurant.phone?.trim()) throw new Error('Restaurant has no phone number on file');

  const { rows } = await query(
    `INSERT INTO voice_calls
     (restaurant_id, question_for_restaurant, status, device_id, push_token)
     VALUES ($1, $2, 'dialing', $3, $4)
     RETURNING *`,
    [restaurantId, question, deviceId || null, pushToken || null]
  );
  const callRecord = rows[0];

  const payload = {
    assistantId: process.env.VAPI_ASSISTANT_ID,
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
    customer: { number: restaurant.phone.trim() },
    assistantOverrides: {
      variableValues: {
        restaurant_name: restaurant.name,
        user_question: question,
      },
    },
  };

  const webhookUrl = process.env.VAPI_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    payload.serverUrl = webhookUrl;
  }

  const response = await fetch(VAPI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
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
    const message =
      (typeof data.message === 'string' && data.message) ||
      (typeof data.error === 'string' && data.error) ||
      `Vapi request failed (${response.status})`;

    await query(
      `UPDATE voice_calls
       SET status = 'failed', error_message = $2, completed_at = NOW()
       WHERE id = $1`,
      [callRecord.id, message]
    );
    throw new Error(message);
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
  return null;
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
    const summary = pickSummary(message);
    const transcript = pickTranscript(message);
    const endedReason = message.endedReason || message.call?.endedReason;
    const failed = endedReason && /fail|error|busy|no-answer|voicemail/i.test(String(endedReason));

    const answerSummary =
      summary ||
      (failed
        ? `Call ended (${endedReason}). No answer was captured.`
        : 'Call completed, but no summary was returned.');

    const waitMinutes = extractWaitMinutes(callRecord.question_for_restaurant, answerSummary);

    await query(
      `UPDATE voice_calls
       SET status = $2,
           answer_summary = $3,
           transcript = COALESCE($4, transcript),
           wait_minutes = $5,
           error_message = $6,
           completed_at = NOW()
       WHERE id = $1`,
      [
        callRecord.id,
        failed ? 'failed' : 'completed',
        answerSummary,
        transcript,
        waitMinutes,
        failed ? String(endedReason) : null,
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

    return { handled: true, type, callId: callRecord.id };
  }

  return { handled: true, type, ignored: true };
}
