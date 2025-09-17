import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, UserPlus, Mail, MapPin, Clock, Phone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addRelativeToExistingHousehold, createHouseholdWithRelative } from '@/lib/householdService';
import { useUserHousehold } from '@/hooks/useUserHousehold';
import { useAuth } from '@/contexts/AuthContext';

const AddRelativeWizard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { household, loading: householdLoading } = useUserHousehold();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    town: '',
    county: '',
    country: 'United Kingdom',
    callCadence: 'daily',
    timezone: 'Europe/London',
    qhStart: '22:00',
    qhEnd: '08:00',
    escName: '',
    escEmail: '',
    inviteEmail: '',
    householdName: '',
    wantInvite: false
  });

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to continue",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      
      if (household) {
        // Add to existing household
        result = await addRelativeToExistingHousehold(formData);
      } else {
        // Create new household and add relative
        result = await createHouseholdWithRelative(formData);
      }

      if (result?.id) {
        // Mark onboarding as complete
        localStorage.setItem('onboardingComplete', 'true');
        
        toast({
          title: "Success!",
          description: `${formData.firstName} has been added to your family.`,
        });

        // Navigate to home instead of family/dashboard
        navigate('/home');
      }
    } catch (error) {
      console.error('Error adding relative:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add relative. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (householdLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/getting-started')}
              className="mb-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Getting Started
            </Button>
            
            <div className="text-center">
              <h1 className="text-3xl font-bold mb-2">Add Your Loved One</h1>
              <p className="text-muted-foreground">
                {household ? 
                  `Adding to ${household.name}` : 
                  "We'll create your family account and add your first relative"
                }
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((step) => (
                <React.Fragment key={step}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {step}
                  </div>
                  {step < 3 && (
                    <div className={`w-12 h-1 ${
                      currentStep > step ? 'bg-primary' : 'bg-muted'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentStep === 1 && (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Basic Information
                  </>
                )}
                {currentStep === 2 && (
                  <>
                    <MapPin className="w-5 h-5" />
                    Location & Preferences
                  </>
                )}
                {currentStep === 3 && (
                  <>
                    <Mail className="w-5 h-5" />
                    Emergency Contact & Invites
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {currentStep === 1 && "Tell us about your loved one"}
                {currentStep === 2 && "Where are they located and when should we call?"}
                {currentStep === 3 && "Who should we contact in emergencies?"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <>
                  {!household && (
                    <div className="space-y-2">
                      <Label htmlFor="householdName">Family Name (Optional)</Label>
                      <Input
                        id="householdName"
                        placeholder="e.g., The Smith Family"
                        value={formData.householdName}
                        onChange={(e) => updateFormData('householdName', e.target.value)}
                      />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        placeholder="First name"
                        value={formData.firstName}
                        onChange={(e) => updateFormData('firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        placeholder="Last name"
                        value={formData.lastName}
                        onChange={(e) => updateFormData('lastName', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Step 2: Location & Preferences */}
              {currentStep === 2 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="town">Town/City</Label>
                      <Input
                        id="town"
                        placeholder="e.g., London"
                        value={formData.town}
                        onChange={(e) => updateFormData('town', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="county">County</Label>
                      <Input
                        id="county"
                        placeholder="e.g., Greater London"
                        value={formData.county}
                        onChange={(e) => updateFormData('county', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="callCadence">How often should we call?</Label>
                    <Select value={formData.callCadence} onValueChange={(value) => updateFormData('callCadence', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-50 bg-background">
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="bi-weekly">Bi-weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="qhStart">Quiet Hours Start</Label>
                      <Input
                        id="qhStart"
                        type="time"
                        value={formData.qhStart}
                        onChange={(e) => updateFormData('qhStart', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="qhEnd">Quiet Hours End</Label>
                      <Input
                        id="qhEnd"
                        type="time"
                        value={formData.qhEnd}
                        onChange={(e) => updateFormData('qhEnd', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Step 3: Emergency Contact */}
              {currentStep === 3 && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="escName">Emergency Contact Name *</Label>
                      <Input
                        id="escName"
                        placeholder="Full name"
                        value={formData.escName}
                        onChange={(e) => updateFormData('escName', e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="escEmail">Emergency Contact Email *</Label>
                      <Input
                        id="escEmail"
                        type="email"
                        placeholder="email@example.com"
                        value={formData.escEmail}
                        onChange={(e) => updateFormData('escEmail', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Checkbox
                        id="wantInvite"
                        checked={formData.wantInvite}
                        onCheckedChange={(checked) => updateFormData('wantInvite', checked)}
                      />
                      <Label htmlFor="wantInvite" className="text-sm">
                        Send an invite to your loved one (optional)
                      </Label>
                    </div>

                    {formData.wantInvite && (
                      <div className="space-y-2">
                        <Label htmlFor="inviteEmail">Their Email Address</Label>
                        <Input
                          id="inviteEmail"
                          type="email"
                          placeholder="their-email@example.com"
                          value={formData.inviteEmail}
                          onChange={(e) => updateFormData('inviteEmail', e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          We'll send them a simple invitation to join CallPanion
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Navigation */}
              <div className="flex justify-between pt-6">
                <Button
                  variant="outline"
                  onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigate('/getting-started')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {currentStep > 1 ? 'Previous' : 'Back'}
                </Button>

                {currentStep < 3 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={
                      (currentStep === 1 && (!formData.firstName || !formData.lastName)) ||
                      (currentStep === 3 && (!formData.escName || !formData.escEmail))
                    }
                  >
                    Next
                    <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !formData.escName || !formData.escEmail}
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Add {formData.firstName}
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddRelativeWizard;
