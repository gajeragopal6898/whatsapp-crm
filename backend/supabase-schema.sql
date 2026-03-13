-- =============================================
-- WhatsApp CRM - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Users table (team members)
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('admin', 'agent')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead stages table
CREATE TABLE lead_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default stages
INSERT INTO lead_stages (name, color, order_index, is_default) VALUES
  ('New', '#3b82f6', 1, true),
  ('Contacted', '#f59e0b', 2, false),
  ('Qualified', '#8b5cf6', 3, false),
  ('Closed', '#10b981', 4, false);

-- Leads table
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  phone TEXT NOT NULL UNIQUE,
  first_message TEXT,
  stage_id UUID REFERENCES lead_stages(id),
  assigned_to UUID REFERENCES users(id),
  notes TEXT,
  follow_up_at TIMESTAMPTZ,
  follow_up_done BOOLEAN DEFAULT false,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 1,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto reply rules table
CREATE TABLE auto_reply_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('keyword', 'welcome', 'away', 'menu')),
  keywords TEXT[], -- for keyword type
  reply_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default rules
INSERT INTO auto_reply_rules (name, type, reply_text, is_active) VALUES
  ('Welcome Message', 'welcome', 'Hello! 👋 Welcome! How can we help you today?', true),
  ('Away Message', 'away', 'Hi! We are currently away. We will get back to you soon. 🙏', false),
  ('Quick Menu', 'menu', 'Please choose an option:\n1. Products\n2. Pricing\n3. Support\n4. Talk to agent', false);

-- Office hours settings
CREATE TABLE settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value) VALUES
  ('office_hours', '{"enabled": false, "start": "09:00", "end": "18:00", "timezone": "Asia/Kolkata", "days": [1,2,3,4,5]}'),
  ('whatsapp_session', '{"connected": false, "phone": null, "last_connected": null}'),
  ('notifications', '{"daily_summary": true, "weekly_report": true, "followup_alerts": true}');

-- Notifications table
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'lead', 'followup')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_reply_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by backend)
CREATE POLICY "Service role full access" ON users FOR ALL USING (true);
CREATE POLICY "Service role full access" ON leads FOR ALL USING (true);
CREATE POLICY "Service role full access" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON auto_reply_rules FOR ALL USING (true);
CREATE POLICY "Service role full access" ON lead_stages FOR ALL USING (true);
CREATE POLICY "Service role full access" ON settings FOR ALL USING (true);
CREATE POLICY "Service role full access" ON notifications FOR ALL USING (true);
