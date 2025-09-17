import { useState } from "react";
import { Mail, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WaitlistFormProps {
  onSuccess?: () => void;
}

export const WaitlistForm = ({ onSuccess }: WaitlistFormProps) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !gdprConsent) {
      toast({
        title: "Required fields missing",
        description: "Please provide your email and consent to marketing communications.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Get UTM parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get('utm_source');
      const utmMedium = urlParams.get('utm_medium');
      const utmCampaign = urlParams.get('utm_campaign');

      const { data, error } = await supabase.functions.invoke('leads-submit', {
        body: {
          email,
          name: name || undefined,
          gdpr_marketing_consent: gdprConsent,
          gdpr_consent_text: `I consent to receive marketing communications from CallPanion about their care technology products and services. Submitted on ${new Date().toISOString()}.`,
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign
        }
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "Successfully joined waitlist!",
        description: "We'll keep you updated on CallPanion's launch.",
      });

      onSuccess?.();

    } catch (error: any) {
      console.error('Waitlist submission failed:', error);
      
      if (error.message?.includes('already registered')) {
        toast({
          title: "Already registered",
          description: "This email is already on our waitlist.",
        });
      } else {
        toast({
          title: "Submission failed",
          description: error.message || "Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-success mx-auto" />
            <div>
              <h3 className="text-lg font-semibold text-success">You're on the list!</h3>
              <p className="text-muted-foreground">
                Thanks for joining the CallPanion waitlist. We'll be in touch soon.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Join the Waitlist
        </CardTitle>
        <CardDescription>
          Be the first to know when CallPanion launches in the UK.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="gdpr-consent"
              checked={gdprConsent}
              onCheckedChange={(checked) => setGdprConsent(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="gdpr-consent"
                className="text-sm font-normal leading-5"
              >
                I consent to receive marketing communications from CallPanion about care technology products and services. You can unsubscribe at any time. *
              </Label>
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || !email || !gdprConsent}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Joining waitlist...
              </>
            ) : (
              "Join Waitlist"
            )}
          </Button>

          <div className="text-xs text-muted-foreground text-center">
            By submitting this form, you agree to our{" "}
            <a href="/privacy" className="underline hover:no-underline">
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="/terms" className="underline hover:no-underline">
              Terms of Service
            </a>
            .
          </div>
        </form>
      </CardContent>
    </Card>
  );
};