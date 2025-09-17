import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import AICallInterface from '@/components/AICallInterface';
import { ArrowLeft, Phone } from 'lucide-react';

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  town: string;
  county: string;
  household_id: string;
}

const TestAICall: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [selectedRelative, setSelectedRelative] = useState<Relative | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRelatives();
  }, []);

  const loadRelatives = async () => {
    try {
      const { data, error } = await supabase
        .from('relatives')
        .select('id, first_name, last_name, town, county, household_id')
        .is('inactive_since', null)
        .order('first_name');

      if (error) {
        console.error('Error loading relatives:', error);
        toast({
          title: "Error",
          description: "Failed to load relatives list",
          variant: "destructive",
        });
        return;
      }

      setRelatives(data || []);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to load relatives",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCallComplete = async (summary: any) => {
    console.log('Call completed with summary:', summary);
    
    toast({
      title: "Call Analysis Complete",
      description: "The AI conversation has been analyzed and logged.",
    });

    // You could add additional logic here to:
    // - Send notifications to family members
    // - Create alerts if needed
    // - Update dashboards
  };

  const handleSelectRelative = (relativeId: string) => {
    const relative = relatives.find(r => r.id === relativeId);
    setSelectedRelative(relative || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-bg p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-bg p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-primary">AI Call Testing</h1>
        </div>

        {/* Relative Selection */}
        {!selectedRelative && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Select Relative for AI Call
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Choose a relative to call:</label>
                <Select onValueChange={handleSelectRelative}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a relative..." />
                  </SelectTrigger>
                  <SelectContent>
                    {relatives.map((relative) => (
                      <SelectItem key={relative.id} value={relative.id}>
                        {relative.first_name} {relative.last_name} - {relative.town}, {relative.county}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {relatives.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No relatives found. Please add relatives to your household first.</p>
                  <Button 
                    onClick={() => navigate('/add-relative')} 
                    className="mt-4"
                  >
                    Add Relative
                  </Button>
                </div>
              )}

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">About AI Calls</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• AI will conduct a natural wellness conversation</li>
                  <li>• Assesses mood, health concerns, and general wellbeing</li>
                  <li>• Automatically generates summary and alerts</li>
                  <li>• Family members are notified of any concerns</li>
                  <li>• All conversations are logged for review</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Call Interface */}
        {selectedRelative && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                AI Call with {selectedRelative.first_name} {selectedRelative.last_name}
              </h2>
              <Button 
                variant="outline" 
                onClick={() => setSelectedRelative(null)}
              >
                Select Different Relative
              </Button>
            </div>

            <AICallInterface
              relativeId={selectedRelative.id}
              relativeName={`${selectedRelative.first_name} ${selectedRelative.last_name}`}
              onCallComplete={handleCallComplete}
            />
          </div>
        )}

        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle>Recent AI Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>Recent call history will appear here</p>
              <p className="text-sm mt-2">Complete a call to see the history and analytics</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestAICall;