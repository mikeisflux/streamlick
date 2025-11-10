-- Reset password for divinitycomicsinc@gmail.com
-- Password will be set to: Good2Go!
-- Bcrypt hash for "Good2Go!" with 10 rounds

UPDATE users
SET
  password = '$2a$10$YRQ3nYZJ7jGPxN8xZKF0X.xJ3pYvHqDGE8kDQxF5JqEqC8mW6XKCW',
  email_verified = true
WHERE email = 'divinitycomicsinc@gmail.com';

-- Verify the update
SELECT
  email,
  name,
  role,
  CASE WHEN password IS NOT NULL THEN 'Password Set' ELSE 'No Password' END as password_status,
  email_verified
FROM users
WHERE email = 'divinitycomicsinc@gmail.com';
