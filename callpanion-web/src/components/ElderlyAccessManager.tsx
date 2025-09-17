import { useState, useEffect } from "react";
import { Link2, Users, Calendar, Plus, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

interface ElderlyInvite {
  id: string;
  token: string;
  email: string;
  expires_at: string;
  household_id: string;
}

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  town: string;
  created_at: string;
  household_id: string;
}

const ElderlyAccessManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [invites, setInvites] = useState<ElderlyInvite[]>([]);
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      // Get user's household IDs
      const { data: membershipData } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user?.id);

      if (!membershipData?.length) return;

      const householdIds = membershipData.map(m => m.household_id);

      // Get elderly invites for those households (case-insensitive)
      const { data: inviteData } = await supabase
        .from('invites')
        .select('*')
        .in('household_id', householdIds)
        .or('role.ilike.elderly,role.ilike.ELDERLY');

      // Get relatives for those households using secure RPC
      let relativesData: any[] = [];
      for (const householdId of householdIds) {
        const { data: householdRelatives } = await supabase
          .rpc('get_relatives_secure', { household_id_param: householdId });
        if (householdRelatives) {
          relativesData.push(...householdRelatives);
        }
      }

      setInvites(inviteData || []);
      setRelatives(relativesData || []);
    } catch (error) {
      console.error('Error loading elderly access data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Secure link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Please copy the link manually",
        variant: "destructive"
      });
    }
  };

  const generateSecureLink = (token: string) => {
    return `${window.location.origin}/elderly/${token}`;
  };

  if (isLoading) {
    return <div>Loading elderly access information...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Elderly Family Members</span>
          </CardTitle>
          <CardDescription>
            Manage secure access for your elderly relatives
          </CardDescription>
        </CardHeader>
        <CardContent>
          {relatives.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No relatives added yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first relative to get started with CallPanion
              </p>
              <Link to="/family/add-relative">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Relative
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {relatives.map((relative) => {
                const invite = invites.find(inv => inv.household_id === relative.household_id);
                const secureLink = invite ? generateSecureLink(invite.token) : null;
                
                return (
                  <div key={relative.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {relative.first_name} {relative.last_name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {relative.town} • Added {new Date(relative.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        {secureLink && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(secureLink)}
                            >
                              <Copy className="h-4 w-4 mr-1" />
                              Copy Link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(secureLink, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Open
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    
                    {secureLink && (
                      <div className="mt-3 p-3 bg-accent rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Link2 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Secure Access Link</span>
                        </div>
                        <code className="text-xs text-muted-foreground break-all">
                          {secureLink}
                        </code>
                      </div>
                    )}
                  </div>
                );
              })}
              
              <div className="pt-4 border-t border-border">
                <Link to="/family/add-relative">
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Relative
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ElderlyAccessManager;