-- Run this SQL to store HETZNER_API_KEY as unencrypted in database
-- Replace 'YOUR_HETZNER_API_KEY_HERE' with your actual API key

-- Delete existing (possibly corrupted/encrypted) key
DELETE FROM "SystemSetting" WHERE category = 'system' AND key = 'HETZNER_API_KEY';

-- Insert as unencrypted
INSERT INTO "SystemSetting" (id, category, key, value, "isEncrypted", description, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'system',
  'HETZNER_API_KEY',
  'YOUR_HETZNER_API_KEY_HERE',  -- Replace this with your actual key
  false,                          -- Not encrypted
  'Hetzner Cloud API Key',
  NOW(),
  NOW()
);
