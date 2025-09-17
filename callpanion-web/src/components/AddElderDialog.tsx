
import React, { useState } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFamilyRole } from '@/hooks/useFamilyRole';
import { Plus, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AddElderDialogProps {
  onElderAdded: () => void;
  trigger?: React.ReactNode;
}

interface ElderFormData {
  full_name: string;
  dob: string;
  notes: string;
  can_receive_calls: boolean;
  can_make_calls: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  allowed_contacts: string;
}

const AddElderDialog: React.FC<AddElderDialogProps> = ({ 
  onElderAdded, 
  trigger 
}) => {
  const { familyId } = useFamilyRole();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ElderFormData>({
    full_name: '',
    dob: '',
    notes: '',
    can_receive_calls: true,
    can_make_calls: false,
    quiet_hours_start: '',
    quiet_hours_end: '',
    allowed_contacts: ''
  });

  const handleInputChange = (field: keyof ElderFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.full_name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter the elder\'s full name',
        variant: 'destructive'
      });
      return false;
    }

    if (!formData.dob) {
      toast({
        title: 'Date of birth required',
        description: 'Please enter the elder\'s date of birth',
        variant: 'destructive'
      });
      return false;
    }

    // Validate quiet hours if provided
    if (formData.quiet_hours_start && !formData.quiet_hours_end) {
      toast({
        title: 'Incomplete quiet hours',
        description: 'Please provide both start and end times for quiet hours',
        variant: 'destructive'
      });
      return false;
    }

    if (formData.quiet_hours_end && !formData.quiet_hours_start) {
      toast({
        title: 'Incomplete quiet hours',
        description: 'Please provide both start and end times for quiet hours',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const createElder = async () => {
    if (!validateForm() || !familyId) return;

    setLoading(true);
    
    try {
      // Parse allowed contacts from comma-separated string
      const allowedContactsArray = formData.allowed_contacts
        .split(',')
        .map(contact => contact.trim())
        .filter(contact => contact.length > 0);

      const { data, error } = await supabase
        .from('elders')
        .insert({
          family_id: familyId,
          full_name: formData.full_name,
          dob: formData.dob,
          notes: formData.notes || null,
          can_receive_calls: formData.can_receive_calls,
          can_make_calls: formData.can_make_calls,
          quiet_hours_start: formData.quiet_hours_start || null,
          quiet_hours_end: formData.quiet_hours_end || null,
          allowed_contacts: JSON.stringify(allowedContactsArray),
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: "Elder added successfully!",
        description: `${formData.full_name} has been added to your family.`,
      });
      
      setOpen(false);
      // Reset form
      setFormData({
        full_name: '',
        dob: '',
        notes: '',
        can_receive_calls: true,
        can_make_calls: false,
        quiet_hours_start: '',
        quiet_hours_end: '',
        allowed_contacts: ''
      });
      onElderAdded();
      
    } catch (error) {
      console.error('Error creating elder:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add elder. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button className="bg-primary hover:bg-primary/90">
      <Plus className="w-4 h-4 mr-2" />
      Add Elder
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Add Elder
          </DialogTitle>
          <DialogDescription>
            Add a new care recipient to your family. You can manage their call permissions and care settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => handleInputChange('full_name', e.target.value)}
                  placeholder="Enter full name"
                />
              </div>
              
              <div>
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => handleInputChange('dob', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Care needs, preferences, medical notes, etc."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Call Permissions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Call Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="can_receive_calls">Can receive calls</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow this elder to receive incoming calls
                  </p>
                </div>
                <Switch
                  id="can_receive_calls"
                  checked={formData.can_receive_calls}
                  onCheckedChange={(checked) => handleInputChange('can_receive_calls', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="can_make_calls">Can make calls</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow this elder to make outgoing calls
                  </p>
                </div>
                <Switch
                  id="can_make_calls"
                  checked={formData.can_make_calls}
                  onCheckedChange={(checked) => handleInputChange('can_make_calls', checked)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quiet_hours_start">Quiet hours start</Label>
                  <Input
                    id="quiet_hours_start"
                    type="time"
                    value={formData.quiet_hours_start}
                    onChange={(e) => handleInputChange('quiet_hours_start', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="quiet_hours_end">Quiet hours end</Label>
                  <Input
                    id="quiet_hours_end"
                    type="time"
                    value={formData.quiet_hours_end}
                    onChange={(e) => handleInputChange('quiet_hours_end', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="allowed_contacts">Allowed contacts (Optional)</Label>
                <Input
                  id="allowed_contacts"
                  value={formData.allowed_contacts}
                  onChange={(e) => handleInputChange('allowed_contacts', e.target.value)}
                  placeholder="Emergency contacts (comma-separated)"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter contact names separated by commas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={createElder} 
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Elder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddElderDialog;
