import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  const token = searchParams.get('token');
  const householdId = searchParams.get('household_id');

  useEffect(() => {
    document.title = "Accept Invitation | Callpanion";
  }, []);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      setLoading(true);
      
      const { data: inviteData, error: inviteError } = await supabase
        .from('invites')
        .select(`
          *,
          households (
            id,
            name
          )
        `)
        .eq('token', token)
        .is('accepted_at', null) // Only get unaccepted invites
        .single();

      if (inviteError || !inviteData) {
        setError('Invalid or expired invitation');
        return;
      }

      // Check if invite has expired
      if (new Date(inviteData.expires_at) < new Date()) {
        setError('This invitation has expired');
        return;
      }

      setInvite(inviteData);
    } catch (err) {
      console.error('Error validating invite:', err);
      setError('Something went wrong validating the invitation');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async () => {
    if (!user) {
      toast({ 
        title: "Please sign in first", 
        description: "You need to be signed in to accept this invitation",
        variant: "destructive"
      });
      navigate(`/auth?redirect=/accept-invite?token=${token}`);
      return;
    }

    if (!token) return;

    try {
      setAccepting(true);

      // Use the secure invite acceptance function
      const { data, error } = await supabase.rpc('accept_invite_secure', {
        invite_token: token,
        gdpr_consent: true // You may want to add a checkbox for this in the UI
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; household_name?: string };

      if (!result.success) {
        setError(result.error || "Failed to accept invitation");
        return;
      }

      toast({ 
        title: "Invitation accepted!", 
        description: `Welcome to ${result.household_name || 'the household'}!`
      });
      
      navigate('/home');
    } catch (err: any) {
      console.error('Error accepting invite:', err);
      toast({ 
        title: "Failed to accept invitation", 
        description: err.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Invalid Invitation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            You're Invited!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-lg font-medium mb-2">
              You've been invited to join
            </p>
            <p className="text-2xl font-bold text-primary">
              {invite?.households?.name || 'a Callpanion household'}
            </p>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Invited as:</strong> {invite?.display_name || invite?.email}
            </p>
            {invite?.relationship_type && (
              <p className="text-sm text-muted-foreground">
                <strong>Relationship:</strong> {invite.relationship_type.charAt(0).toUpperCase() + invite.relationship_type.slice(1)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              <strong>Role:</strong> {
                invite?.role === 'FAMILY_PRIMARY' ? 'Co-Administrator' : 
                invite?.role === 'FAMILY_MEMBER' ? 'Family Member' : 
                invite?.role?.charAt(0).toUpperCase() + invite?.role?.slice(1) || 'Family Member'
              }
            </p>
            {invite?.permissions_metadata && typeof invite.permissions_metadata === 'object' && (
              <div className="text-sm text-muted-foreground">
                <strong>Permissions:</strong>
                <div className="flex flex-wrap gap-1 mt-1">
                  {invite.permissions_metadata.viewHealthInsights && (
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">Health Insights</span>
                  )}
                  {invite.permissions_metadata.viewCalendar && (
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">Calendar</span>
                  )}
                  {invite.permissions_metadata.postUpdates && (
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">Post Updates</span>
                  )}
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              <strong>Expires:</strong> {new Date(invite?.expires_at).toLocaleDateString()}
            </p>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              By accepting this invitation, you'll be able to access family updates, 
              view health insights, and stay connected with your loved ones through Callpanion.
            </p>
          </div>

          {user ? (
            <div className="space-y-3">
              <p className="text-sm text-center">
                Signed in as: <strong>{user.email}</strong>
              </p>
              <Button 
                onClick={acceptInvite} 
                disabled={accepting}
                className="w-full"
                size="lg"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/')}
                className="w-full"
              >
                Decline
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">
                You need to sign in to accept this invitation
              </p>
              <Button 
                onClick={() => navigate(`/auth?redirect=/accept-invite?token=${token}`)}
                className="w-full"
                size="lg"
              >
                Sign In to Accept
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}