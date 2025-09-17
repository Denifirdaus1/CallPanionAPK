
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Phone, Settings, Activity, Calendar, Heart } from 'lucide-react';
import AddElderDialog from '@/components/AddElderDialog';
import ManageElderPermissionsDialog from '@/components/ManageElderPermissionsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFamilyRole } from '@/hooks/useFamilyRole';
import { useToast } from '@/hooks/use-toast';

interface Elder {
  id: string;
  full_name: string;
  dob: string | null;
  notes: string | null;
  can_receive_calls: boolean;
  can_make_calls: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  allowed_contacts: any[];
  status: string;
  created_at: string;
}

const FamilyElders = () => {
  const { user } = useAuth();
  const { isAdmin, familyId } = useFamilyRole();
  const { toast } = useToast();
  const [elders, setElders] = useState<Elder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedElder, setSelectedElder] = useState<Elder | null>(null);
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);

  const fetchElders = async () => {
    if (!familyId) return;
    
    try {
      const { data, error } = await supabase
        .from('elders')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to parse allowed_contacts JSON
      const transformedData = (data || []).map(elder => ({
        ...elder,
        allowed_contacts: typeof elder.allowed_contacts === 'string' 
          ? JSON.parse(elder.allowed_contacts) 
          : elder.allowed_contacts || []
      }));
      
      setElders(transformedData);
    } catch (error) {
      console.error('Error fetching elders:', error);
      toast({
        title: "Error",
        description: "Failed to load elders",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchElders();
  }, [familyId]);

  // Set up real-time subscription for elders
  useEffect(() => {
    if (!familyId) return;

    const channel = supabase
      .channel('elders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'elders',
          filter: `family_id=eq.${familyId}`
        },
        () => {
          fetchElders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [familyId]);

  const handleElderAdded = () => {
    fetchElders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'attention':
        return 'bg-orange-100 text-orange-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAge = (dob: string | null) => {
    if (!dob) return null;
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    return `${age} years old`;
  };

  const handleManagePermissions = (elderId: string) => {
    const elder = elders.find(e => e.id === elderId);
    if (elder) {
      setSelectedElder(elder);
      setIsPermissionsDialogOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Elders</h1>
            <p className="text-muted-foreground">
              Manage care recipients and their call permissions
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6 text-center">
            <p>Loading elders...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Elders</h1>
          <p className="text-muted-foreground">
            Manage care recipients and their call permissions
          </p>
        </div>
        {isAdmin && (
          <AddElderDialog 
            onElderAdded={handleElderAdded}
            trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Elder
              </Button>
            }
          />
        )}
      </div>

      {elders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="space-y-4">
              <Heart className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No elders added yet</h3>
                <p className="text-muted-foreground">
                  Add your first elder to start managing their care
                </p>
              </div>
              {isAdmin && (
                <AddElderDialog 
                  onElderAdded={handleElderAdded}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Elder
                    </Button>
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {elders.map((elder) => (
            <Card key={elder.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Heart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{elder.full_name}</CardTitle>
                      {elder.dob && (
                        <p className="text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatAge(elder.dob)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge className={getStatusColor(elder.status)}>
                    {elder.status}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {elder.notes && (
                  <p className="text-sm text-muted-foreground">
                    {elder.notes}
                  </p>
                )}

                {/* Call Permissions */}
                <div>
                  <h4 className="font-medium mb-2">Call Permissions</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Can receive calls:</span>
                      <Badge variant={elder.can_receive_calls ? "default" : "secondary"}>
                        {elder.can_receive_calls ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Can make calls:</span>
                      <Badge variant={elder.can_make_calls ? "default" : "secondary"}>
                        {elder.can_make_calls ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    {elder.quiet_hours_start && elder.quiet_hours_end && (
                      <div className="flex justify-between">
                        <span>Quiet hours:</span>
                        <span className="text-muted-foreground">
                          {elder.quiet_hours_start} - {elder.quiet_hours_end}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Allowed Contacts */}
                {elder.allowed_contacts && elder.allowed_contacts.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Allowed Contacts</h4>
                    <div className="flex flex-wrap gap-2">
                      {elder.allowed_contacts.map((contact, index) => (
                        <Badge key={index} variant="outline">
                          {typeof contact === 'string' ? contact : contact.name || 'Contact'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => handleManagePermissions(elder.id)}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Permissions
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => console.log('View insights for:', elder.id)}
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    Insights
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Permissions Management Dialog */}
      {selectedElder && (
        <ManageElderPermissionsDialog
          elder={selectedElder}
          open={isPermissionsDialogOpen}
          onOpenChange={setIsPermissionsDialogOpen}
          onElderUpdated={handleElderAdded}
        />
      )}
    </div>
  );
};

export default FamilyElders;
