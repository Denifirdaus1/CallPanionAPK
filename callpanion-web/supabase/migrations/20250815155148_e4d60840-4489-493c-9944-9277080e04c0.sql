-- Clean up RLS policy inconsistencies

-- Fix profiles table policies - drop legacy policies with non-existent user_id column
DROP POLICY IF EXISTS "user can select own profile (app)" ON public.profiles;
DROP POLICY IF EXISTS "user can update own profile (app)" ON public.profiles;

-- Fix household_members table policies - drop legacy policies with incorrect function references
DROP POLICY IF EXISTS "admins can delete household_members" ON public.household_members;
DROP POLICY IF EXISTS "admins can insert household_members" ON public.household_members;
DROP POLICY IF EXISTS "members can select household_members" ON public.household_members;