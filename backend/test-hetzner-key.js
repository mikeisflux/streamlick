#!/usr/bin/env node
/**
 * Diagnostic script to test Hetzner API key loading
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Decrypt function (copied from crypto.ts)
function decrypt(encryptedText) {
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }

  const key = Buffer.from(ENCRYPTION_KEY, 'base64');

  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const encryptedData = Buffer.from(parts[1], 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

async function testHetznerKey() {
  console.log('🔍 Testing Hetzner API Key Configuration...\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log('  ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? '✓ Set' : '✗ Not set');
  console.log('  HETZNER_API_KEY:', process.env.HETZNER_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('');

  try {
    // Check database
    console.log('Database Check:');
    const setting = await prisma.systemSetting.findUnique({
      where: {
        category_key: {
          category: 'system',
          key: 'HETZNER_API_KEY',
        },
      },
    });

    if (setting) {
      console.log('  ✓ HETZNER_API_KEY found in database');
      console.log('    Category:', setting.category);
      console.log('    Key:', setting.key);
      console.log('    IsEncrypted:', setting.isEncrypted);
      console.log('    Value length:', setting.value.length, 'characters');

      if (setting.isEncrypted) {
        console.log('\n🔐 Attempting to decrypt...');
        try {
          const decrypted = decrypt(setting.value);
          console.log('  ✓ Decryption successful');
          console.log('  Decrypted key starts with:', decrypted.substring(0, 20) + '...');
          console.log('  Decrypted key length:', decrypted.length, 'characters');

          // Validate API key format
          if (decrypted.startsWith('read_write_') || decrypted.startsWith('read_only_')) {
            console.log('  ✓ API key format looks valid');
          } else {
            console.log('  ✗ WARNING: API key format doesn\'t look like a Hetzner token');
          }
        } catch (decryptError) {
          console.log('  ✗ Decryption FAILED:', decryptError.message);
          console.log('    This is likely the cause of your 500 error!');
        }
      } else {
        console.log('  Value (unencrypted):', setting.value.substring(0, 20) + '...');
      }
    } else {
      console.log('  ✗ HETZNER_API_KEY not found in database');

      if (process.env.HETZNER_API_KEY) {
        console.log('  ℹ Will fall back to environment variable');
      } else {
        console.log('  ✗ No fallback environment variable either');
        console.log('    This will cause a "not configured" error');
      }
    }

    console.log('\n✅ Diagnostic complete');

  } catch (error) {
    console.error('\n❌ Error during diagnostic:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testHetznerKey().catch(console.error);
