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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, UserPlus, Mail, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { sendInviteEmail } from '@/lib/emailService';

interface AddFamilyMemberDialogProps {
  householdId: string;
  onMemberAdded: () => void;
  trigger?: React.ReactNode;
}

interface FamilyMemberData {
  name: string;
  relationship: string;
  email: string;
  phone: string;
  role: 'FAMILY_MEMBER' | 'FAMILY_PRIMARY';
  permissions: {
    viewHealthInsights: boolean;
    viewCalendar: boolean;
    postUpdates: boolean;
  };
}

const relationships = [
  { value: 'daughter', label: 'Daughter' },
  { value: 'son', label: 'Son' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'friend', label: 'Friend' },
  { value: 'other', label: 'Other' }
];

const AddFamilyMemberDialog: React.FC<AddFamilyMemberDialogProps> = ({ 
  householdId, 
  onMemberAdded, 
  trigger 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FamilyMemberData>({
    name: '',
    relationship: '',
    email: '',
    phone: '',
    role: 'FAMILY_MEMBER',
    permissions: {
      viewHealthInsights: false,
      viewCalendar: true,
      postUpdates: true
    }
  });

  const handleInputChange = (field: keyof FamilyMemberData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePermissionChange = (permission: keyof FamilyMemberData['permissions'], checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: checked
      }
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter the family member\'s name',
        variant: 'destructive'
      });
      return false;
    }

    if (!formData.email.trim() && !formData.phone.trim()) {
      toast({
        title: 'Contact information required',
        description: 'Please provide either an email address or phone number',
        variant: 'destructive'
      });
      return false;
    }

    if (formData.email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(formData.email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive'
      });
      return false;
    }

    return true;
  };

  const createInvitation = async () => {
    if (!validateForm()) return;

    setLoading(true);
    
    try {
      // Check if user is authenticated and refresh session if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast({
          title: "Authentication Error",
          description: "Please log in again to send invitations.",
          variant: "destructive",
        });
        return;
      }

      // Refresh the session to ensure we have a valid token
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.log('Session refresh failed, using existing session:', refreshError);
      }

      const currentSession = refreshedSession || session;

      console.log('Sending invitation with data:', {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        sessionExists: !!currentSession,
        tokenExists: !!currentSession?.access_token
      });

      // Call the invites edge function
      const { data, error } = await supabase.functions.invoke('invites', {
        body: {
          name: formData.name,
          relationship: formData.relationship,
          email: formData.email,
          phone: formData.phone,
          role: formData.role,
          permissions: {
            health_access_level: formData.permissions.viewHealthInsights ? 'FULL_ACCESS' : 'NO_ACCESS',
            can_view_calendar: formData.permissions.viewCalendar,
            can_post_updates: formData.permissions.postUpdates
          }
        }
      });

      if (error) throw error;
      
      // Attempt to send the invite email via edge function (Resend)
      try {
        const token = (data as any)?.invite?.token as string | undefined;
        if (token && formData.email.trim()) {
          await sendInviteEmail({
            email: formData.email.trim(),
            token,
            household_id: householdId,
            inviter_name: user?.user_metadata?.display_name || undefined,
          });
        }
      } catch (emailError) {
        console.error('Invite created but failed to send email:', emailError);
        // Check if it's a rate limit error
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        if (errorMessage.includes('Rate limit exceeded') || errorMessage.includes('429')) {
          toast({
            title: "Invite Created",
            description: "Invite created but email limit reached. You can resend later from Pending Invites.",
            variant: "default"
          });
          setOpen(false);
          setFormData({
            name: '',
            relationship: '',
            email: '',
            phone: '',
            role: 'FAMILY_MEMBER',
            permissions: {
              viewHealthInsights: false,
              viewCalendar: true,
              postUpdates: true
            }
          });
          onMemberAdded();
          return;
        }
        // We don't block the flow on other email failures; the invite exists and can be resent
      }
      
      toast({
        title: "Invitation sent!",
        description: `${formData.name} has been invited to join your family.`,
      });
      
      setOpen(false);
      // Reset form
      setFormData({
        name: '',
        relationship: '',
        email: '',
        phone: '',
        role: 'FAMILY_MEMBER',
        permissions: {
          viewHealthInsights: false,
          viewCalendar: true,
          postUpdates: true
        }
      });
      onMemberAdded();
      
    } catch (error) {
      console.error('Error creating invitation:', error);
      
      // More specific error handling
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Full error details:', errorMessage);
      
      toast({
        title: "Error",
        description: `Failed to send invitation: ${errorMessage}. Please check your internet connection and try again.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button className="bg-primary hover:bg-primary/90">
      <UserPlus className="w-4 h-4 mr-2" />
      Add Family Member
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
            <UserPlus className="w-5 h-5" />
            Add Family Member
          </DialogTitle>
          <DialogDescription>
            Invite a family member to join your care network. They'll be able to access information based on the permissions you set.
          </DialogDescription>
        </DialogHeader>

        <div data-testid="add-member-form" className="grid gap-6 py-4">
          {/* Basic Information */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4">Basic Information</h3>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    data-testid="member-name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter family member's full name"
                  />
                </div>
                
                <div>
                  <Label htmlFor="relationship">Relationship to Older Adult</Label>
                  <Select value={formData.relationship} onValueChange={(value) => handleInputChange('relationship', value)}>
                    <SelectTrigger data-testid="member-relationship">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent className="z-50 bg-background">
                      {relationships.map((rel) => (
                        <SelectItem key={rel.value} value={rel.value}>
                          {rel.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4">Contact Information</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Provide either email or phone number for sending the invitation.
              </p>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="member-contact"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Role & Permissions */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="font-medium mb-4">Role & Permissions</h3>
              
              <div className="mb-4">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value: 'FAMILY_MEMBER' | 'FAMILY_PRIMARY') => handleInputChange('role', value)}>
                  <SelectTrigger data-testid="member-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-50 bg-background">
                    <SelectItem value="FAMILY_MEMBER">Family Member</SelectItem>
                    <SelectItem value="FAMILY_PRIMARY">Co-Administrator</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.role === 'FAMILY_PRIMARY' 
                    ? 'Co-administrators can manage other family members and settings' 
                    : 'Family members have view access based on permissions below'
                  }
                </p>
              </div>

              <div className="space-y-3">
                <Label>Permissions</Label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="viewHealthInsights"
                    data-testid="perm-health"
                    checked={formData.permissions.viewHealthInsights}
                    onCheckedChange={(checked) => handlePermissionChange('viewHealthInsights', checked as boolean)}
                  />
                  <Label htmlFor="viewHealthInsights" className="text-sm">
                    View Health Insights
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Access to detailed health data, call analysis, and wellness trends
                </p>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="viewCalendar"
                    data-testid="perm-calendar"
                    checked={formData.permissions.viewCalendar}
                    onCheckedChange={(checked) => handlePermissionChange('viewCalendar', checked as boolean)}
                  />
                  <Label htmlFor="viewCalendar" className="text-sm">
                    View Calendar
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  See scheduled calls, appointments, and care events
                </p>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="postUpdates"
                    data-testid="perm-post"
                    checked={formData.permissions.postUpdates}
                    onCheckedChange={(checked) => handlePermissionChange('postUpdates', checked as boolean)}
                  />
                  <Label htmlFor="postUpdates" className="text-sm">
                    Post Updates
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  Share messages, photos, and family updates
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
            data-testid="member-submit"
            onClick={createInvitation} 
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddFamilyMemberDialog;