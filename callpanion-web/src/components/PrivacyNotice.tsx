import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface PrivacyNoticeProps {
  type: "location" | "health" | "full";
  onAccept?: () => void;
  onDecline?: () => void;
  required?: boolean;
}

export function PrivacyNotice({ type, onAccept, onDecline, required = false }: PrivacyNoticeProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const notices = {
    location: {
      title: "Location Data Privacy Notice",
      content: (
        <div className="space-y-3">
          <p>
            We only collect your town or village, county/region, and country to personalise your experience 
            and provide localised services. <strong>We do not store your full postal address.</strong>
          </p>
          <p>
            Your data is stored securely in the UK/EU and will be deleted when your relative is removed 
            from the service or after 15 months of inactivity.
          </p>
          <p className="text-sm text-muted-foreground">
            This processing is based on our legitimate interests under the UK GDPR to deliver 
            and improve the Callpanion service. You can request deletion at any time.
          </p>
        </div>
      )
    },
    health: {
      title: "Health Data Privacy Notice",
      content: (
        <div className="space-y-3">
          <p>
            Health monitoring includes call recordings, mood assessments, and wellbeing insights. 
            This sensitive data requires your explicit consent under UK GDPR Article 9.
          </p>
          <p>
            Health data is shared only with authorised family members and stored securely for up to 7 years 
            in line with UK healthcare standards. You can withdraw consent at any time.
          </p>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Withdrawing consent may limit our ability to provide emergency support and health monitoring.
            </AlertDescription>
          </Alert>
        </div>
      )
    },
    full: {
      title: "Privacy Policy Agreement",
      content: (
        <div className="space-y-3">
          <p>
            By using Callpanion, you agree to our privacy policy which explains how we collect, use, 
            and protect your personal data under UK GDPR.
          </p>
          <p>
            Key points: We collect minimal location data, health monitoring requires consent, 
            family sharing needs permission, and you have full rights over your data.
          </p>
          <Link 
            to="/privacy" 
            className="inline-flex items-center text-primary hover:text-primary/80 underline"
            target="_blank"
          >
            Read full privacy policy
            <ExternalLink className="h-3 w-3 ml-1" />
          </Link>
        </div>
      )
    }
  };

  const notice = notices[type];

  const handleAccept = () => {
    setAcknowledged(true);
    onAccept?.();
  };

  const handleDecline = () => {
    onDecline?.();
  };

  if (acknowledged && !required) return null;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Info className="h-5 w-5" />
          {notice.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {notice.content}
        
        {(onAccept || onDecline) && (
          <div className="flex gap-3 pt-2">
            {onAccept && (
              <Button onClick={handleAccept} size="sm">
                I Understand & Accept
              </Button>
            )}
            {onDecline && (
              <Button variant="outline" onClick={handleDecline} size="sm">
                Decline
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PrivacyNotice;