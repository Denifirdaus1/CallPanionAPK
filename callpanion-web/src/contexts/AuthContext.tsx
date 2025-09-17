import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    console.log('[AuthContext] Initializing auth...');
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (mounted) {
          console.log('[AuthContext] Auth state change:', event, session?.user?.id || 'no user');
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);

          // Handle authentication redirect
          if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
            // Check if user just signed in from auth pages
            if (window.location.pathname === '/auth' || window.location.pathname === '/auth/callback') {
              setTimeout(async () => {
                try {
                  // Check if user already has a household
                  const { data: householdMember } = await supabase
                    .from('household_members')
                    .select('household_id')
                    .eq('user_id', session.user.id)
                    .maybeSingle();
                  
                  if (householdMember?.household_id) {
                    navigate('/dashboard');
                  } else {
                    navigate('/onboarding/household');
                  }
                } catch (error) {
                  console.error('Error checking household membership:', error);
                  navigate('/onboarding/household');
                }
              }, 100);
            }
          }
        }
      }
    );

    // THEN check for existing session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Auth session error:', error.message);
          // Clear any invalid session data
          await supabase.auth.signOut();
        }
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const signUp = async (email: string, password: string) => {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;
      
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      });
      return { error };
    } catch (error) {
      console.error('SignUp error:', error);
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      return { error };
    } catch (error) {
      console.error('SignIn error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      // Clear local state immediately
      setUser(null);
      setSession(null);
      
      // Attempt to sign out from Supabase
      await supabase.auth.signOut({ scope: 'local' });
      
      // Navigate to home regardless of server response
      navigate('/');
    } catch (error) {
      console.error('SignOut error:', error);
      // Still navigate away even if signOut fails
      navigate('/');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      isLoading, 
      signOut, 
      signUp, 
      signIn 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};