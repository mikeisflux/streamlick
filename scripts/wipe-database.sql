-- WIPE DATABASE SCRIPT
-- This will completely reset the streamlick_prod database

-- Drop all tables in the public schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Reset default privileges
GRANT ALL ON SCHEMA public TO streamlick;
GRANT ALL ON SCHEMA public TO public;

-- Confirmation message
SELECT 'Database wiped successfully!' as status;
