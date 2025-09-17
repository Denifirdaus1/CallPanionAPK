import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { ThreeDailyCallsSetup } from '@/components/ThreeDailyCallsSetup';
import { GuidedTestCallSystem } from '@/components/GuidedTestCallSystem';
import { supabase } from '@/integrations/supabase/client';

interface CallTime {
  id: string;
  time: string;
  type: 'morning' | 'afternoon' | 'evening';
  enabled: boolean;
}

interface EscalationRule {
  id: string;
  trigger: 'missed_call' | 'consecutive_missed' | 'concerning_response' | 'no_answer_streak';
  threshold: number;
  action: 'notify_family' | 'call_emergency_contact' | 'send_alert' | 'escalate_to_service';
  contacts: string[];
  enabled: boolean;
}

interface TestResults {
  callConnected: boolean;
  audioQuality: 'good' | 'fair' | 'poor';
  aiResponseTime: number;
  alertsTriggered: string[];
  overallScore: number;
}

export default function CallSystemSetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [callTimes, setCallTimes] = useState<CallTime[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRule[]>([]);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const relativeId = searchParams.get('relativeId');
  
  useEffect(() => {
    document.title = "Call System Setup | Callpanion";
    
    if (!relativeId) {
      toast({
        title: "Missing relative information",
        description: "Please complete the relative setup first.",
        variant: "destructive"
      });
      navigate('/add-relative');
    }
  }, [relativeId, navigate, toast]);

  const steps = [
    { 
      title: "Configure Three Daily Calls", 
      description: "Set up morning, afternoon, and evening wellbeing calls with escalation rules" 
    },
    { 
      title: "Test System", 
      description: "Run comprehensive tests to ensure everything works perfectly" 
    },
    { 
      title: "Review & Launch", 
      description: "Review your setup and activate the call system" 
    }
  ];

  const handleCallTimesChange = (newCallTimes: CallTime[]) => {
    setCallTimes(newCallTimes);
  };

  const handleEscalationRulesChange = (newRules: EscalationRule[]) => {
    setEscalationRules(newRules);
  };

  const handleTestComplete = (success: boolean, results: TestResults) => {
    setTestResults(results);
    if (success) {
      toast({
        title: "All tests passed!",
        description: "Your call system is ready to go live.",
      });
      setCurrentStep(2);
    } else {
      toast({
        title: "Some tests need attention",
        description: "Please review the failed tests and try again.",
        variant: "destructive"
      });
    }
  };

  const saveConfiguration = async () => {
    if (!relativeId) return;
    
    setIsSaving(true);
    try {
      // Save call times and escalation rules to the database
      // For now, we'll store this configuration in localStorage until we add a proper preferences field
      const configData = {
        callTimes,
        escalationRules,
        testResults,
        relativeId
      };
      
      localStorage.setItem(`callSystemConfig_${relativeId}`, JSON.stringify(configData));
      
      // Update the relative record to indicate configuration is complete
      const { error: updateError } = await supabase
        .from('relatives')
        .update({
          call_cadence: 'three_daily', // Update to indicate three daily calls configured
          last_active_at: new Date().toISOString()
        })
        .eq('id', relativeId);

      if (updateError) throw updateError;

      toast({
        title: "Configuration saved successfully!",
        description: "Your call system is now active and ready to provide daily wellbeing checks.",
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error saving configuration",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    if (currentStep === 0 && callTimes.length === 0) {
      toast({
        title: "Please configure call times",
        description: "You need to set up at least one call time to continue.",
        variant: "destructive"
      });
      return;
    }
    
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          
          <h1 className="text-3xl font-bold">Call System Setup</h1>
          <p className="text-muted-foreground">
            Configure and test your three daily wellbeing call system
          </p>
        </header>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${index <= currentStep 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground'
                  }
                `}>
                  {index < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`
                    w-16 h-1 mx-2
                    ${index < currentStep ? 'bg-primary' : 'bg-muted'}
                  `} />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <h2 className="text-xl font-semibold">{steps[currentStep].title}</h2>
            <p className="text-muted-foreground">{steps[currentStep].description}</p>
          </div>
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {currentStep === 0 && (
            <ThreeDailyCallsSetup
              onCallTimesChange={handleCallTimesChange}
              onEscalationRulesChange={handleEscalationRulesChange}
              initialCallTimes={callTimes}
              initialEscalationRules={escalationRules}
            />
          )}

          {currentStep === 1 && (
            <GuidedTestCallSystem
              relativeId={relativeId || undefined}
              onTestComplete={handleTestComplete}
            />
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Launch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Call Times Configured</h4>
                    <div className="space-y-2">
                      {callTimes.filter(ct => ct.enabled).map(ct => (
                        <div key={ct.id} className="flex justify-between text-sm">
                          <span>{ct.type.charAt(0).toUpperCase() + ct.type.slice(1)}</span>
                          <span className="font-mono">{ct.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Escalation Rules</h4>
                    <div className="space-y-2">
                      {escalationRules.filter(rule => rule.enabled).map(rule => (
                        <div key={rule.id} className="text-sm">
                          <span>{rule.action.replace('_', ' ')} after {rule.threshold} {rule.trigger.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {testResults && (
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Test Results</h4>
                    <div className="text-sm space-y-1">
                      <p>Overall Score: <span className="font-medium">{testResults.overallScore.toFixed(0)}%</span></p>
                      <p>Call Connection: {testResults.callConnected ? '✓ Success' : '✗ Failed'}</p>
                      <p>Audio Quality: {testResults.audioQuality}</p>
                      <p>AI Response Time: {testResults.aiResponseTime}s</p>
                    </div>
                  </div>
                )}

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-900 mb-2">Ready to Launch!</h4>
                  <p className="text-sm text-green-700">
                    Your call system is configured and tested. Click "Activate Call System" to start 
                    providing daily wellbeing checks for your loved one.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Navigation Controls */}
        <div className="flex justify-between mt-8">
          <Button 
            variant="outline" 
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          
          <div className="space-x-3">
            {currentStep < steps.length - 1 ? (
              <Button onClick={nextStep}>
                Next Step
              </Button>
            ) : (
              <Button 
                onClick={saveConfiguration}
                disabled={isSaving || !testResults || testResults.overallScore < 80}
              >
                {isSaving ? 'Activating...' : 'Activate Call System'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}