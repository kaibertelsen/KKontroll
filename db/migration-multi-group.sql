-- Migration: Multi-konsern support
-- Run this once on the Neon database

-- 1. Add is_super_admin column
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- 2. Set superadmin
UPDATE users SET is_super_admin = TRUE WHERE email = 'kai@holmbertelsen.no';

-- 3. Create usergroupaccess table
CREATE TABLE IF NOT EXISTS usergroupaccess (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  UNIQUE(user_id, group_id)
);

-- 4. Populate from existing users (each user gets access to their current group)
INSERT INTO usergroupaccess (user_id, group_id)
SELECT id, group_id FROM users WHERE group_id IS NOT NULL
ON CONFLICT (user_id, group_id) DO NOTHING;
