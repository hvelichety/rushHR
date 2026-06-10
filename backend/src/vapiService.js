import { query } from './db.js';
import { formatPhoneE164 } from './phone.js';
import { enqueueNotifications } from './notificationQueue.js';

const VAPI_API_URL = 'https://api.vapi.ai/call';
const VAPI_DIAL_CONFIRM_MS = 18_000;
const VAPI_DIAL_POLL_MS = 1_500;
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

function mapVoiceCall(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    restaurantId: row.restaurant_id,
    restaurantName: extras.restaurantName ?? row.restaurant_name ?? null,
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
  const fromPhoneNumber = cleanEnvValue(process.env.VAPI_FROM_NUMBER);

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

  return { apiKey, assistantId, phoneNumberId, fromPhoneNumber: fromPhoneNumber || null };
}

function normalizeQuestion(text) {
  return text?.trim().replace(/\s+/g, ' ') ?? '';
}

function isLikelyOrderRequest(question) {
  return /\b(order|pickup|pick up|takeout|take out|delivery|for\s+[A-Z][a-z]+|\d+\s+\w)/i.test(
    question
  );
}

function buildCallBehaviorRules(question) {
  const orderHints = isLikelyOrderRequest(question)
    ? [
        '- This looks like a PLACE-ORDER request. When staff asks "anything else?", "is that all?", or similar: the items and name in the request are the COMPLETE order unless the customer text says "at least", "some", "or similar", etc. Reply "No, that\'s everything" or "That\'s the full order."',
        '- Do NOT re-read the entire order after staff already acknowledged it. Only repeat if they explicitly ask you to repeat or say they did not hear you.',
      ]
    : [
        '- This looks like a QUESTION (not an open-ended order). Answer the specific question, then wrap up — do not invent follow-up items.',
      ];

  return [
    'CUSTOMER REQUEST (authoritative — this is everything the app user asked you to say):',
    `"${question}"`,
    '',
    'Rules for this call:',
    '- Anything explicitly written in the request above is KNOWN (items, quantity, name for pickup, pickup vs delivery, party size, wait-time question, etc.). Never say "I don\'t have that information" or "let me confirm with the customer" for details that are already in that text.',
    ...orderHints,
    '- Keep replies short (1–2 sentences). Confirm key facts once at the start, then answer follow-ups without repeating the whole message.',
    '- If staff asks about something NOT in the request (spice level, sauce, substitutions, allergies, special cooking instructions), say the customer did not specify and to use the restaurant default — do NOT guess.',
    '- Once staff confirms the order or answers the question, thank them and end the call. Do not loop or restart the pitch.',
  ].join('\n');
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
  const { rows } = await query(
    `SELECT vc.*, r.name AS restaurant_name, r.phone AS restaurant_phone
     FROM voice_calls vc
     JOIN restaurants r ON r.id = vc.restaurant_id
     WHERE vc.id = $1`,
    [callId]
  );
  if (!rows[0]) return null;

  const restaurantName = rows[0].restaurant_name;
  const restaurantPhone = rows[0].restaurant_phone;

  let row = rows[0];
  if (row.status === 'dialing' || row.status === 'in_progress') {
    row = (await syncVoiceCallFromVapi(row)) ?? row;
  }

  // syncVoiceCallFromVapi returns voice_calls rows without the join
  if (row && !row.restaurant_name) {
    row = { ...row, restaurant_name: restaurantName, restaurant_phone: restaurantPhone };
  }

  const mapped = mapVoiceCall(row);
  const destinationPhone = formatPhoneE164(row.restaurant_phone);
  return destinationPhone ? { ...mapped, destinationPhone } : mapped;
}

export async function getVoiceCallsForDevice(deviceId, limit = 25) {
  if (!deviceId?.trim()) return [];

  const { rows } = await query(
    `SELECT vc.*, r.name AS restaurant_name, r.phone AS restaurant_phone
     FROM voice_calls vc
     JOIN restaurants r ON r.id = vc.restaurant_id
     WHERE vc.device_id = $1
     ORDER BY vc.created_at DESC
     LIMIT $2`,
    [deviceId.trim(), limit]
  );

  return rows.map((row) => {
    const mapped = mapVoiceCall(row);
    const destinationPhone = formatPhoneE164(row.restaurant_phone);
    return destinationPhone ? { ...mapped, destinationPhone } : mapped;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVapiCallDialing(status) {
  return status === 'queued' || status === 'ringing' || status === 'in-progress' || status === 'forwarding';
}

async function confirmVapiCallStarted(vapiCallId) {
  const deadline = Date.now() + VAPI_DIAL_CONFIRM_MS;

  while (Date.now() < deadline) {
    const call = await fetchVapiCallRecord(vapiCallId);
    if (!call) {
      await sleep(VAPI_DIAL_POLL_MS);
      continue;
    }

    if (call.status === 'ended') {
      const reason = call.endedReason || call.endReason || 'ended immediately';
      throw new Error(`Call failed to start (${reason})`);
    }

    if (call.status === 'ringing' || call.status === 'in-progress' || call.status === 'forwarding') {
      return call.status;
    }

    if (call.status === 'queued') {
      await sleep(VAPI_DIAL_POLL_MS);
      continue;
    }

    await sleep(VAPI_DIAL_POLL_MS);
  }

  const last = await fetchVapiCallRecord(vapiCallId);
  if (last && isVapiCallDialing(last.status)) {
    return last.status;
  }

  throw new Error(
    'Call was accepted but never started dialing. Check Vapi credits, phone number, and assistant config.'
  );
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
  if (fromMessages && !isVoicemailTranscript(fromMessages)) return fromMessages;

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

const VOICEMAIL_TRANSCRIPT_PATTERNS = [
  /leave (?:your |a )?message/i,
  /voice\s?mail/i,
  /not available(?: to take your call)?/i,
  /mailbox (?:is )?full/i,
  /at the tone/i,
  /after the (?:beep|tone)/i,
  /record your message/i,
  /no one is available/i,
  /cannot take your call/i,
  /try again later/i,
  /press \d+ to/i,
  /reached a voice mail/i,
];

function isVoicemailTranscript(text) {
  if (!text?.trim()) return false;
  return VOICEMAIL_TRANSCRIPT_PATTERNS.some((pattern) => pattern.test(text));
}

const VOICEMAIL_USER_MESSAGE =
  'The call went straight to voicemail — your phone may never have rung. Unknown out-of-state numbers (like +1 229) are often silenced. Turn off Settings → Phone → Silence Unknown Callers, or buy a local NJ number in Vapi.';

function resolveCallOutcome(vapiCall, question) {
  const transcript = pickTranscriptFromVapi(vapiCall);
  const endedReason = vapiCall.endedReason || vapiCall.endReason;
  const voicemailDetected =
    isVoicemailTranscript(transcript) ||
    isVoicemailTranscript(buildAnswerFromTranscript(transcript));
  const failed = isVapiCallFailureReason(endedReason) || voicemailDetected;

  if (failed) {
    if (voicemailDetected) {
      return {
        transcript,
        failed: true,
        answerSummary: null,
        errorMessage: VOICEMAIL_USER_MESSAGE,
      };
    }
    return {
      transcript,
      failed: true,
      answerSummary: `Call ended (${endedReason}). No answer was captured.`,
      errorMessage: String(endedReason),
    };
  }

  return {
    transcript,
    failed: false,
    answerSummary: extractAnswerFromVapiPayload(vapiCall, question),
    errorMessage: null,
  };
}

async function waitForVapiAnalysis(vapiCallId, maxMs = 20_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const call = await fetchVapiCallRecord(vapiCallId);
    if (!call) break;
    const summary = call.analysis?.summary;
    const structuredAnswer = call.analysis?.structuredData?.answer;
    if (
      (typeof summary === 'string' && summary.trim()) ||
      (typeof structuredAnswer === 'string' && structuredAnswer.trim())
    ) {
      return call;
    }
    if (!isVapiCallEnded(call)) return call;
    await sleep(2_000);
  }
  return fetchVapiCallRecord(vapiCallId);
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

  const updated = rows[0];
  if (!failed && updated.device_id) {
    const restaurant = await getRestaurantById(updated.restaurant_id);
    enqueueNotifications([
      {
        type: 'voice_call_ready',
        callId: updated.id,
        deviceId: updated.device_id,
        restaurantId: updated.restaurant_id,
        restaurantName: restaurant?.name ?? 'Restaurant',
        question: updated.question_for_restaurant,
        message: 'Your update is ready',
      },
    ]);
  }

  return updated;
}

async function syncVoiceCallFromVapi(callRecord) {
  if (!callRecord.vapi_call_id) return callRecord;
  if (callRecord.status === 'completed' || callRecord.status === 'failed') return callRecord;

  const callAgeMs = Date.now() - new Date(callRecord.created_at).getTime();
  if (callAgeMs < 10_000) return callRecord;

  try {
    const vapiCall = await fetchVapiCallRecord(callRecord.vapi_call_id);
    if (!vapiCall || !isVapiCallEnded(vapiCall)) return callRecord;

    const enrichedCall = await waitForVapiAnalysis(callRecord.vapi_call_id);
    const outcome = resolveCallOutcome(enrichedCall ?? vapiCall, callRecord.question_for_restaurant);

    return (
      (await finalizeVoiceCallRecord(callRecord, outcome)) ?? callRecord
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
        call_behavior_rules: buildCallBehaviorRules(question),
      },
      voicemailMessage: '',
      analysisPlan: {
        summaryPrompt: `Summarize what the restaurant staff said in 1-3 sentences. The customer's question was: "${question}". Focus on their answer. Ignore voicemail greetings and automated phone systems. If only voicemail was reached, say the restaurant did not answer live.`,
        structuredDataSchema: {
          type: 'object',
          properties: {
            answer: {
              type: 'string',
              description: 'Brief summary of what the restaurant said in response to the question',
            },
          },
          required: ['answer'],
        },
        structuredDataPrompt: `Extract a concise answer to the customer's question based on what the restaurant staff said. Question: "${question}"`,
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

  try {
    await confirmVapiCallStarted(vapiCallId);
  } catch (err) {
    await query(
      `UPDATE voice_calls
       SET status = 'failed', error_message = $2, completed_at = NOW()
       WHERE id = $1`,
      [callRecord.id, err.message]
    );
    throw err;
  }

  console.log(`📞 Vapi call started: ${vapiCallId} → ${destinationPhone}`);

  return {
    ...mapVoiceCall(updatedRows[0], { restaurantName: restaurant.name }),
    destinationPhone,
    fromPhoneNumber: vapiConfig.fromPhoneNumber,
  };
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
  if (summary && !isVoicemailTranscript(summary)) return summary;

  const structured = message.analysis?.structuredData || message.call?.analysis?.structuredData;
  if (structured && typeof structured === 'object') {
    if (typeof structured.answer === 'string' && structured.answer.trim()) {
      return structured.answer.trim();
    }
  }

  const fromMessages = buildAnswerFromMessages(message.artifact?.messages || message.messages);
  if (fromMessages && !isVoicemailTranscript(fromMessages)) return fromMessages;

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
    const enrichedCall = await waitForVapiAnalysis(vapiCallId);
    const vapiShape = enrichedCall ?? {
      analysis: message.analysis || message.call?.analysis,
      summary: message.summary || message.call?.summary,
      artifact: message.artifact,
      messages: message.messages,
      transcript: pickTranscript(message),
      endedReason: message.endedReason || message.call?.endedReason,
    };
    const outcome = resolveCallOutcome(vapiShape, callRecord.question_for_restaurant);

    const updated = await finalizeVoiceCallRecord(callRecord, outcome);

    return { handled: true, type, callId: updated.id };
  }

  return { handled: true, type, ignored: true };
}
