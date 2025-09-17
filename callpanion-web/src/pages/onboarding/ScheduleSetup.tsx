import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Clock, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type CallMethod = "batch_call" | "in_app_call";

const ScheduleSetup = () => {
  const [morningTime, setMorningTime] = useState("09:00");
  const [afternoonTime, setAfternoonTime] = useState("14:00");
  const [eveningTime, setEveningTime] = useState("19:00");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [callMethod, setCallMethod] = useState<CallMethod | null>(null);
  const [prefLoading, setPrefLoading] = useState(true);

  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { householdId, relativeId, relativeName, timezone } = (location.state || {}) as {
    householdId?: string; relativeId?: string; relativeName?: string; timezone?: string;
  };

  // Get household preference - supports both batch_call and in_app_call
  useEffect(() => {
    (async () => {
      if (!householdId) { setPrefLoading(false); return; }
      const { data, error } = await supabase
        .from("households")
        .select("call_method_preference")
        .eq("id", householdId)
        .single();
      if (error) {
        console.error(error);
        setError("Failed to get household preference");
      } else {
        setCallMethod(data.call_method_preference as CallMethod);
      }
      setPrefLoading(false);
    })();
  }, [householdId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relativeId || !householdId || !callMethod) { 
      setError("Missing required information"); 
      return; 
    }

    setIsLoading(true); setError("");
    try {
      const { error: scheduleError } = await supabase.from("schedules").insert({
        household_id: householdId,
        relative_id: relativeId,
        timezone: timezone || "Asia/Jakarta",
        morning_time: morningTime,
        afternoon_time: afternoonTime,
        evening_time: eveningTime,
        active: isActive,
        // Use the household's call method preference
        call_type: callMethod,
      });
      if (scheduleError) throw scheduleError;

      const methodName = callMethod === "batch_call" ? "Batch Call" : "In-App Call";
      toast({ 
        title: "Success", 
        description: `${methodName} schedule created. Setup complete.` 
      });
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      console.error("Error creating schedule:", err);
      setError(err.message || "Failed to create schedule");
    } finally {
      setIsLoading(false);
    }
  };

  if (!relativeId || !householdId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive"><AlertDescription>
          Missing required information. Please start over from household setup.
        </AlertDescription></Alert>
      </div>
    );
  }

  if (prefLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading preference…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Clock className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">
              Daily {callMethod === "batch_call" ? "Phone Call" : "In-App Call"} Schedule
            </h1>
          </div>
          <p className="text-muted-foreground">
            {callMethod === "batch_call" 
              ? `We'll call ${relativeName} on their phone at these times.`
              : `We'll send in-app notifications and start a session for ${relativeName} at these times.`
            }
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {callMethod === "batch_call" ? "Phone Call Times" : "In-App Call Times"}
            </CardTitle>
            <CardDescription>
              {callMethod === "batch_call" 
                ? "Automated phone calls will be made at these times."
                : "Applies to your in-app experience only."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div><Label htmlFor="morning-time">Morning</Label></div>
                  <Input id="morning-time" type="time" value={morningTime}
                    onChange={(e)=>setMorningTime(e.target.value)} disabled={isLoading} className="w-32" />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div><Label htmlFor="afternoon-time">Afternoon</Label></div>
                  <Input id="afternoon-time" type="time" value={afternoonTime}
                    onChange={(e)=>setAfternoonTime(e.target.value)} disabled={isLoading} className="w-32" />
                </div>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div><Label htmlFor="evening-time">Evening</Label></div>
                  <Input id="evening-time" type="time" value={eveningTime}
                    onChange={(e)=>setEveningTime(e.target.value)} disabled={isLoading} className="w-32" />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                <div>
                  <Label htmlFor="active-schedule">Activate Schedule</Label>
                </div>
                <Switch id="active-schedule" checked={isActive}
                  onCheckedChange={setIsActive} disabled={isLoading} />
              </div>

              {error && (<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>)}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Complete Setup
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ScheduleSetup;