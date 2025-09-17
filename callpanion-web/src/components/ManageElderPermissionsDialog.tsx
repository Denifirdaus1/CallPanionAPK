import React, { useState, useEffect } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
}

interface ManageElderPermissionsDialogProps {
  elder: Elder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onElderUpdated: () => void;
}

interface ElderFormData {
  notes: string;
  can_receive_calls: boolean;
  can_make_calls: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  allowed_contacts: string;
  status: string;
}

const ManageElderPermissionsDialog: React.FC<ManageElderPermissionsDialogProps> = ({ 
  elder,
  open,
  onOpenChange,
  onElderUpdated
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ElderFormData>({
    notes: '',
    can_receive_calls: true,
    can_make_calls: false,
    quiet_hours_start: '',
    quiet_hours_end: '',
    allowed_contacts: '',
    status: 'active'
  });

  // Initialize form data when elder changes
  useEffect(() => {
    if (elder) {
      setFormData({
        notes: elder.notes || '',
        can_receive_calls: elder.can_receive_calls,
        can_make_calls: elder.can_make_calls,
        quiet_hours_start: elder.quiet_hours_start || '',
        quiet_hours_end: elder.quiet_hours_end || '',
        allowed_contacts: elder.allowed_contacts.map(contact => 
          typeof contact === 'string' ? contact : contact.name || 'Contact'
        ).join(', '),
        status: elder.status
      });
    }
  }, [elder]);

  const handleInputChange = (field: keyof ElderFormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = (): boolean => {
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

  const updateElder = async () => {
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      // Parse allowed contacts from comma-separated string
      const allowedContactsArray = formData.allowed_contacts
        .split(',')
        .map(contact => contact.trim())
        .filter(contact => contact.length > 0);

      const { error } = await supabase
        .from('elders')
        .update({
          notes: formData.notes || null,
          can_receive_calls: formData.can_receive_calls,
          can_make_calls: formData.can_make_calls,
          quiet_hours_start: formData.quiet_hours_start || null,
          quiet_hours_end: formData.quiet_hours_end || null,
          allowed_contacts: JSON.stringify(allowedContactsArray),
          status: formData.status
        })
        .eq('id', elder.id);

      if (error) throw error;
      
      toast({
        title: "Permissions updated!",
        description: `${elder.full_name}'s permissions have been updated.`,
      });
      
      onOpenChange(false);
      onElderUpdated();
      
    } catch (error) {
      console.error('Error updating elder:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update permissions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Manage Permissions - {elder.full_name}
          </DialogTitle>
          <DialogDescription>
            Update call permissions and care settings for this elder.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Care Notes & Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Any additional information about care needs, preferences, etc."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background"
                >
                  <option value="active">Active</option>
                  <option value="attention">Needs Attention</option>
                  <option value="inactive">Inactive</option>
                </select>
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
                <Label htmlFor="allowed_contacts">Allowed contacts</Label>
                <Input
                  id="allowed_contacts"
                  value={formData.allowed_contacts}
                  onChange={(e) => handleInputChange('allowed_contacts', e.target.value)}
                  placeholder="Family, Doctor Johnson, Emergency Services (comma-separated)"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Enter contact names separated by commas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={updateElder} 
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManageElderPermissionsDialog;