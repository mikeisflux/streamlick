-- Set divinitycomicsinc@gmail.com as admin
UPDATE users
SET role = 'admin'
WHERE email = 'divinitycomicsinc@gmail.com';

-- Verify the change
SELECT email, role, created_at
FROM users
WHERE email = 'divinitycomicsinc@gmail.com';
