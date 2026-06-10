CREATE TABLE IF NOT EXISTS voice_calls (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  question_for_restaurant TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'dialing',
  vapi_call_id TEXT,
  answer_summary TEXT,
  transcript TEXT,
  wait_minutes INTEGER,
  error_message TEXT,
  device_id TEXT,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_vapi ON voice_calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_device ON voice_calls(device_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_restaurant ON voice_calls(restaurant_id);
