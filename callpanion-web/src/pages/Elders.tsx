import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Heart, Plus, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFamilyRole } from '@/hooks/useFamilyRole';
import RelativeNavigation from '@/components/RelativeNavigation';

interface Elder {
  id: string;
  full_name: string;
  dob: string | null;
  notes: string | null;
  created_at: string;
}

const Elders = () => {
  const [elders, setElders] = useState<Elder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newElder, setNewElder] = useState({
    full_name: '',
    dob: '',
    notes: ''
  });
  const { isAdmin, familyId } = useFamilyRole();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!familyId) return;

    const fetchElders = async () => {
      try {
        const { data, error } = await supabase
          .from('elders')
          .select('*')
          .eq('family_id', familyId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setElders(data || []);
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

    fetchElders();
  }, [familyId, toast]);

  const handleAddElder = async () => {
    if (!familyId || !newElder.full_name.trim()) {
      toast({
        title: "Error",
        description: "Please enter a name for the elder",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('elders')
        .insert({
          family_id: familyId,
          full_name: newElder.full_name.trim(),
          dob: newElder.dob || null,
          notes: newElder.notes.trim() || null
        })
        .select()
        .single();

      if (error) throw error;

      setElders(prev => [data, ...prev]);
      setShowAddDialog(false);
      setNewElder({ full_name: '', dob: '', notes: '' });

      toast({
        title: "Success",
        description: "Elder added successfully",
      });
    } catch (error) {
      console.error('Error adding elder:', error);
      toast({
        title: "Error",
        description: "Failed to add elder",
        variant: "destructive"
      });
    }
  };

  const formatAge = (dob: string | null) => {
    if (!dob) return null;
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    return `${age} years old`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Elders in Your Care</h1>
            <p className="text-muted-foreground">
              Manage the elderly relatives you care for
            </p>
          </div>
          {isAdmin && (
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Elder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Elder</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={newElder.full_name}
                      onChange={(e) => setNewElder(prev => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={newElder.dob}
                      onChange={(e) => setNewElder(prev => ({ ...prev, dob: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newElder.notes}
                      onChange={(e) => setNewElder(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any important notes about this elder..."
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleAddElder} className="flex-1">
                      Add Elder
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAddDialog(false)}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center">Loading elders...</p>
            </CardContent>
          </Card>
        ) : elders.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Elders Added Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start by adding the elderly relatives you care for.
              </p>
              {isAdmin && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Elder
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {elders.map((elder) => (
              <Card key={elder.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Heart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg">{elder.full_name}</h3>
                      {elder.dob && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatAge(elder.dob)}
                        </p>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {elder.notes && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {elder.notes}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => navigate(`/family/elders/${elder.id}/permissions`)}
                    >
                      Manage Permissions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Elders;