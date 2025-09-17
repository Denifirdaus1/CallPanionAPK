-- Clean up RLS policy inconsistencies

-- Fix profiles table policies - drop legacy policies with non-existent user_id column
DROP POLICY IF EXISTS "user can select own profile (app)" ON public.profiles;
DROP POLICY IF EXISTS "user can update own profile (app)" ON public.profiles;

-- Fix household_members table policies - drop legacy policies with incorrect function references
DROP POLICY IF EXISTS "admins can delete household_members" ON public.household_members;
DROP POLICY IF EXISTS "admins can insert household_members" ON public.household_members;
DROP POLICY IF EXISTS "members can select household_members" ON public.household_members;

-- Ensure consistent RLS policies for profiles table (keep only the correct ones)
-- These should already exist and be correct, but let's verify they are using the right column name
CREATE POLICY IF NOT EXISTS "Users can read their own profile" ON public.profiles
FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON public.profiles  
FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = id);