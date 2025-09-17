import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Home } from "lucide-react";

const HouseholdSetup = () => {
  const [householdName, setHouseholdName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Indonesia");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!householdName.trim()) {
      setError("Please enter a household name");
      return;
    }

    if (!user) {
      setError("You must be logged in to create a household");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Create household
      const { data: household, error: householdError } = await supabase
        .from('households')
        .insert({
          name: householdName.trim(),
          city: city.trim() || null,
          country: country.trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (householdError) throw householdError;

      // Add user as primary member
      const { error: memberError } = await supabase
        .from('household_members')
        .insert({
          household_id: household.id,
          user_id: user.id,
          role: 'FAMILY_PRIMARY'
        });

      if (memberError) throw memberError;

      // Navigate to relative setup
      navigate('/onboarding/call-method', { 
        state: { householdId: household.id } 
      });

    } catch (err: any) {
      console.error('Error creating household:', err);
      setError(err.message || 'Failed to create household');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-warmth/10 via-background to-comfort/20 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Home className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Setup Your Household
            </h1>
          </div>
          <p className="text-muted-foreground">
            Let's start by creating your family household
          </p>
        </div>

        <Card className="shadow-warm border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">
              Household Information
            </CardTitle>
            <CardDescription className="text-center">
              This will be the main hub for your family's care coordination
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="household-name">Household Name *</Label>
                <Input
                  id="household-name"
                  type="text"
                  placeholder="e.g., The Smith Family"
                  value={householdName}
                  onChange={(e) => setHouseholdName(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="e.g., London"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isLoading}
                />
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
                  <option value="Indonesia">Indonesia</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Ireland">Ireland</option>
                </select>
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
                Create Household
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HouseholdSetup;