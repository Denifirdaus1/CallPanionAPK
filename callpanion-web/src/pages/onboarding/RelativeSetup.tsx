import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Same phone formatting and validation as CallScheduleManager
const formatPhoneNumber = (phone: string) => {
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Convert to E.164 format for database storage
  // E.164 format: +[country code][area code][phone number] (no dashes, spaces)
  
  // If starts with 628, it's already in correct format
  if (cleaned.startsWith('628')) {
    return `+${cleaned}`;
  }
  
  // If starts with 62, add +
  if (cleaned.startsWith('62')) {
    return `+${cleaned}`;
  }
  
  // If starts with 08, convert to +628
  if (cleaned.startsWith('08')) {
    const withoutLeadingZero = cleaned.substring(1); // Remove the 0
    return `+62${withoutLeadingZero}`;
  }
  
  // If starts with 8 (after removing 0), convert to +628
  if (cleaned.startsWith('8') && cleaned.length >= 9) {
    return `+62${cleaned}`;
  }
  
  // Default: assume it needs +62 prefix if it's Indonesian format
  if (cleaned.length >= 9 && cleaned.length <= 13) {
    return `+62${cleaned}`;
  }
  
  return phone; // Return original if can't format
};

const validateIndonesianPhone = (phone: string) => {
  if (!phone.trim()) return true; // Allow empty phone numbers
  
  // After formatting, check if it matches E.164 format
  const formatted = formatPhoneNumber(phone);
  
  // Must match database constraint: +[1-9]\d{7,14}
  const e164Pattern = /^\+[1-9]\d{7,14}$/;
  return e164Pattern.test(formatted);
};

const RelativeSetup = () => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [town, setTown] = useState("");
  const [county, setCounty] = useState("");
  const [country, setCountry] = useState("Indonesia");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const householdId = location.state?.householdId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please enter first and last name");
      return;
    }

    // Validate phone number if provided (same as CallScheduleManager)
    if (phone && !validateIndonesianPhone(phone)) {
      setError("Please enter a valid Indonesian phone number (08XX-XXXX-XXXX or +62-8XX-XXXX-XXXX)");
      return;
    }

    if (!householdId) {
      setError("Missing household information");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Format phone number to E.164 (same as CallScheduleManager)
      const formattedPhone = phone ? formatPhoneNumber(phone) : null;

      // Create relative with both phone fields for consistency
      const { data: relative, error: relativeError } = await supabase
        .from('relatives')
        .insert({
          household_id: householdId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          town: town.trim() || null,
          county: county.trim() || null,
          country: country.trim(),
          timezone: timezone,
          phone_number: formattedPhone, // For display
          phone_e164: formattedPhone,   // For scheduler (CRITICAL!)
          call_cadence: 'daily'
        })
        .select()
        .single();

      if (relativeError) throw relativeError;

      toast({
        title: "Success",
        description: "Relative profile created successfully",
      });

      // Navigate to schedule setup with timezone info
      navigate('/onboarding/schedule', { 
        state: { 
          householdId: householdId,
          relativeId: relative.id,
          relativeName: `${firstName} ${lastName}`,
          timezone: timezone  // Pass timezone to ScheduleSetup
        } 
      });

    } catch (err: any) {
      console.error('Error creating relative:', err);
      setError(err.message || 'Failed to create relative profile');
    } finally {
      setIsLoading(false);
    }
  };

  if (!householdId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center p-4">
        <Alert variant="destructive">
          <AlertDescription>
            Missing household information. Please start over from household setup.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Add Your Loved One
            </h1>
          </div>
          <p className="text-muted-foreground">
            Tell us about the person you'd like to stay connected with
          </p>
        </div>

        <Card className="shadow-warm border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">
              Relative Information
            </CardTitle>
            <CardDescription className="text-center">
              We'll use this information to set up their calling schedule
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First Name *</Label>
                  <Input
                    id="first-name"
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last Name *</Label>
                  <Input
                    id="last-name"
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+62-8XX-XXXX-XXXX or 08XX-XXXX-XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  Indonesian format: +62-8XX-XXXX-XXXX or 08XX-XXXX-XXXX
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="town">Town/City</Label>
                  <Input
                    id="town"
                    type="text"
                    placeholder="e.g., Manchester"
                    value={town}
                    onChange={(e) => setTown(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="county">County</Label>
                  <Input
                    id="county"
                    type="text"
                    placeholder="e.g., Greater Manchester"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={isLoading}
                >
                  <option value="">Select country...</option>
                  <option value="Indonesia">Indonesia</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Ireland">Ireland</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Jakarta">WIB - Jakarta, Sumatra (UTC+7)</SelectItem>
                    <SelectItem value="Asia/Makassar">WITA - Kalimantan, Sulawesi (UTC+8)</SelectItem>
                    <SelectItem value="Asia/Jayapura">WIT - Papua, Maluku (UTC+9)</SelectItem>
                    <SelectItem value="Europe/London">GMT - London (UTC+0)</SelectItem>
                    <SelectItem value="Europe/Dublin">GMT - Dublin (UTC+0)</SelectItem>
                    <SelectItem value="Europe/Paris">CET - Paris (UTC+1)</SelectItem>
                    <SelectItem value="Europe/Berlin">CET - Berlin (UTC+1)</SelectItem>
                    <SelectItem value="America/New_York">EST - New York (UTC-5)</SelectItem>
                    <SelectItem value="America/Los_Angeles">PST - Los Angeles (UTC-8)</SelectItem>
                    <SelectItem value="Australia/Sydney">AEST - Sydney (UTC+10)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue to Schedule Setup
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RelativeSetup;