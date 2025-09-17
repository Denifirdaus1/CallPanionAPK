-- Fix: Move vector extension to extensions schema instead of public
DROP EXTENSION IF EXISTS vector;
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;