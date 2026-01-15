import express from 'express';

const router = express.Router();

/**
 * License validation endpoint
 * Returns a valid license response for any license key
 *
 * GET /?license=$LICENSE_KEY
 */
router.get('/', (req, res) => {
  // Return valid license for any key presented
  res.json({
    valid: true,
    type: 'enterprise',
    expiry: '2050-02-15T04:14:31'
  });
});

export default router;
