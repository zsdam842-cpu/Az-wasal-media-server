-- سجل المكالمات: جدول بلا مفاتيح أجنبية لأن معرفات المستخدمين
-- قد تأتي من خادم الحسابات والرسائل (توثيق عبر introspection)
-- وليست بالضرورة موجودة في جدول users لهذا الخادم.

CREATE TABLE IF NOT EXISTS call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL,
  caller_id TEXT NOT NULL,
  caller_code TEXT,
  caller_name TEXT,
  receiver_id TEXT NOT NULL,
  receiver_code TEXT,
  receiver_name TEXT,
  call_type TEXT NOT NULL CHECK (call_type IN ('audio', 'video')),
  status TEXT NOT NULL CHECK (status IN ('ringing', 'active', 'ended', 'rejected', 'missed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs (caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_id ON call_logs (call_id);
