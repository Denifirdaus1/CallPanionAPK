import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Edit2, AlertCircle, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  timezone?: string;
  household_id: string;
}

interface Schedule {
  id: string;
  relative_id: string;
  timezone: string;
  morning_time: string;
  afternoon_time: string;
  evening_time: string;
  active: boolean;
}

interface RelativeWithSchedule extends Relative {
  schedule?: Schedule;
}

const INDONESIAN_TIMEZONES = [
  { value: 'Asia/Jakarta', label: 'WIB (Jakarta, Sumatra)', offset: 'UTC+7' },
  { value: 'Asia/Makassar', label: 'WITA (Kalimantan, Sulawesi)', offset: 'UTC+8' },
  { value: 'Asia/Jayapura', label: 'WIT (Papua, Maluku)', offset: 'UTC+9' },
  { value: 'Europe/London', label: 'GMT (London)', offset: 'UTC+0' },
  { value: 'America/New_York', label: 'EST (New York)', offset: 'UTC-5' },
];

export const InAppCallScheduleSettings = () => {
  const [relatives, setRelatives] = useState<RelativeWithSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRelative, setEditingRelative] = useState<RelativeWithSchedule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Form state
  const [timezone, setTimezone] = useState("");
  const [morningTime, setMorningTime] = useState("");
  const [afternoonTime, setAfternoonTime] = useState("");
  const [eveningTime, setEveningTime] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadInAppRelativesWithSchedules();
  }, []);

  const loadInAppRelativesWithSchedules = async () => {
    try {
      // Get user's households with in-app call preference
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select(`
          household_id,
          households!inner(id, call_method_preference)
        `)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      // Filter households with in-app call preference
      const inAppHouseholdIds = householdData
        ?.filter(h => h.households?.call_method_preference === 'in_app_call')
        ?.map(h => h.household_id) || [];

      if (inAppHouseholdIds.length === 0) {
        setRelatives([]);
        return;
      }

      // Get relatives for in-app households only
      const { data: relativesData, error: relativesError } = await supabase
        .from('relatives')
        .select('*')
        .in('household_id', inAppHouseholdIds);

      if (relativesError) throw relativesError;

      // Get schedules for these relatives
      const relativeIds = relativesData?.map(r => r.id) || [];
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('schedules')
        .select('*')
        .in('relative_id', relativeIds);

      if (schedulesError) throw schedulesError;

      // Combine data
      const relativesWithSchedules = relativesData?.map(relative => ({
        ...relative,
        schedule: schedulesData?.find(s => s.relative_id === relative.id)
      })) || [];

      setRelatives(relativesWithSchedules);
    } catch (error: any) {
      console.error('Error loading in-app relatives with schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load in-app call schedules",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (relative: RelativeWithSchedule) => {
    setEditingRelative(relative);
    setTimezone(relative.schedule?.timezone || relative.timezone || "Asia/Jakarta");
    setMorningTime(relative.schedule?.morning_time || "09:00");
    setAfternoonTime(relative.schedule?.afternoon_time || "14:00");
    setEveningTime(relative.schedule?.evening_time || "19:00");
    setIsActive(relative.schedule?.active ?? true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingRelative) return;

    setIsSaving(true);
    try {
      // Update relative's timezone
      const { error: relativeError } = await supabase
        .from('relatives')
        .update({ timezone: timezone })
        .eq('id', editingRelative.id);

      if (relativeError) throw relativeError;

      // Update or create schedule
      if (editingRelative.schedule) {
        // Update existing schedule
        const { error: scheduleError } = await supabase
          .from('schedules')
          .update({
            timezone: timezone,
            morning_time: morningTime,
            afternoon_time: afternoonTime,
            evening_time: eveningTime,
            active: isActive
          })
          .eq('id', editingRelative.schedule.id);

        if (scheduleError) throw scheduleError;
      } else {
        // Create new schedule
        const { error: scheduleError } = await supabase
          .from('schedules')
          .insert({
            relative_id: editingRelative.id,
            household_id: editingRelative.household_id,
            timezone: timezone,
            morning_time: morningTime,
            afternoon_time: afternoonTime,
            evening_time: eveningTime,
            active: isActive
          });

        if (scheduleError) throw scheduleError;
      }

      toast({
        title: "Success",
        description: "In-app call schedule updated successfully",
      });

      setIsDialogOpen(false);
      loadInAppRelativesWithSchedules(); // Reload data
    } catch (error: any) {
      console.error('Error saving in-app schedule:', error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save in-app call schedule",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getTimezoneLabel = (timezoneValue: string) => {
    const timezone = INDONESIAN_TIMEZONES.find(tz => tz.value === timezoneValue);
    return timezone ? `${timezone.label} (${timezone.offset})` : timezoneValue;
  };

  const formatTimeInTimezone = (time: string, timezoneValue: string) => {
    try {
      const [hours, minutes] = time.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      return date.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: timezoneValue 
      });
    } catch {
      return time;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>In-App Call Schedule Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading schedules...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>In-App Call Schedule Settings</span>
        </CardTitle>
        <CardDescription>
          Manage call times and timezones for in-app video calls with your relatives
        </CardDescription>
      </CardHeader>
      <CardContent>
        {relatives.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No relatives found with in-app call preference. 
              Set up households with in-app call method first.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {relatives.map((relative) => (
              <div key={relative.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">
                      {relative.first_name} {relative.last_name}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      {(relative.schedule?.timezone || relative.timezone) && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{getTimezoneLabel(relative.schedule?.timezone || relative.timezone || '')}</span>
                        </div>
                      )}
                    </div>
                    {relative.schedule && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                        <div className="text-center p-2 bg-muted/30 rounded text-xs">
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Morning</p>
                          <p className="font-medium text-xs sm:text-sm">{relative.schedule.morning_time}</p>
                        </div>
                        <div className="text-center p-2 bg-muted/30 rounded text-xs">
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Afternoon</p>
                          <p className="font-medium text-xs sm:text-sm">{relative.schedule.afternoon_time}</p>
                        </div>
                        <div className="text-center p-2 bg-muted/30 rounded text-xs">
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Evening</p>
                          <p className="font-medium text-xs sm:text-sm">{relative.schedule.evening_time}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={relative.schedule?.active ? "default" : "secondary"}>
                      {relative.schedule?.active ? "Active" : "Inactive"}
                    </Badge>
                    <Dialog open={isDialogOpen && editingRelative?.id === relative.id} onOpenChange={setIsDialogOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(relative)}
                        >
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit In-App Call Schedule</DialogTitle>
                          <DialogDescription>
                            Update call times and timezone for video calls with {relative.first_name} {relative.last_name}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 px-1">
                          {/* Timezone */}
                          <div className="space-y-2">
                            <Label htmlFor="timezone">Timezone</Label>
                            <Select value={timezone} onValueChange={setTimezone}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select timezone" />
                              </SelectTrigger>
                              <SelectContent>
                                {INDONESIAN_TIMEZONES.map((tz) => (
                                  <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label} ({tz.offset})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Call Times */}
                          <div className="space-y-3">
                            <Label>Video Call Times</Label>
                            <div className="grid grid-cols-1 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="morning" className="text-sm">Morning</Label>
                                <Input
                                  id="morning"
                                  type="time"
                                  value={morningTime}
                                  onChange={(e) => setMorningTime(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="afternoon" className="text-sm">Afternoon</Label>
                                <Input
                                  id="afternoon"
                                  type="time"
                                  value={afternoonTime}
                                  onChange={(e) => setAfternoonTime(e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="evening" className="text-sm">Evening</Label>
                                <Input
                                  id="evening"
                                  type="time"
                                  value={eveningTime}
                                  onChange={(e) => setEveningTime(e.target.value)}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Schedule Preview */}
                          {timezone && (
                            <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                              <p className="text-sm font-medium">Schedule Preview ({getTimezoneLabel(timezone)}):</p>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div>Morning: {formatTimeInTimezone(morningTime, timezone)}</div>
                                <div>Afternoon: {formatTimeInTimezone(afternoonTime, timezone)}</div>
                                <div>Evening: {formatTimeInTimezone(eveningTime, timezone)}</div>
                              </div>
                            </div>
                          )}

                          {/* Active Toggle */}
                          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <div>
                              <Label htmlFor="active" className="text-sm font-medium">
                                Enable Schedule
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Activate automatic in-app video calls
                              </p>
                            </div>
                            <Switch
                              id="active"
                              checked={isActive}
                              onCheckedChange={setIsActive}
                            />
                          </div>

                          {/* Save Button */}
                          <div className="flex justify-end space-x-2 pt-4">
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                              {isSaving ? "Saving..." : "Save Schedule"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};