import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Edit2, Phone, AlertCircle, MapPin, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  phone_e164?: string;
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

export const CallScheduleManager = () => {
  const [relatives, setRelatives] = useState<RelativeWithSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingRelative, setEditingRelative] = useState<RelativeWithSchedule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  // Form state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [timezone, setTimezone] = useState("");
  const [morningTime, setMorningTime] = useState("");
  const [afternoonTime, setAfternoonTime] = useState("");
  const [eveningTime, setEveningTime] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadRelativesWithSchedules();
  }, []);

  const loadRelativesWithSchedules = async () => {
    try {
      // Get user's households first
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setRelatives([]);
        return;
      }

      // Get relatives for these households
      const { data: relativesData, error: relativesError } = await supabase
        .from('relatives')
        .select('*')
        .in('household_id', householdIds);

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
      console.error('Error loading relatives with schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load relatives and schedules",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (relative: RelativeWithSchedule) => {
    setEditingRelative(relative);
    // Keep field empty if no phone number exists, don't use any default
    setPhoneNumber(relative.phone_e164 || relative.phone_number || "");
    setTimezone(relative.schedule?.timezone || relative.timezone || "Asia/Jakarta");
    setMorningTime(relative.schedule?.morning_time || "09:00");
    setAfternoonTime(relative.schedule?.afternoon_time || "14:00");
    setEveningTime(relative.schedule?.evening_time || "19:00");
    setIsActive(relative.schedule?.active ?? true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingRelative) return;

    console.log('Saving phone number:', phoneNumber);

    // Validate phone number for Indonesian format (only if phone number is provided)
    if (phoneNumber && !validateIndonesianPhone(phoneNumber)) {
      console.log('Phone validation failed for:', phoneNumber);
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid Indonesian phone number (08XX-XXXX-XXXX or +62-8XX-XXXX-XXXX)",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      // Format phone number
      const formattedPhone = phoneNumber ? formatPhoneNumber(phoneNumber) : null;

      // Update relative's phone and timezone
      const { error: relativeError } = await supabase
        .from('relatives')
        .update({
          phone_number: formattedPhone,
          phone_e164: formattedPhone, // Also update phone_e164 for scheduler compatibility
          timezone: timezone
        })
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
        description: "Call schedule updated successfully",
      });

      setIsDialogOpen(false);
      loadRelativesWithSchedules(); // Reload data
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      console.error('Error details:', error?.message, error?.details);
      toast({
        title: "Error",
        description: error?.message || "Failed to save call schedule. Please check console for details.",
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
            <span>Call Schedule Management</span>
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
          <span>Call Schedule Management</span>
        </CardTitle>
        <CardDescription>
          Manage call times, timezones, and phone numbers for your relatives
        </CardDescription>
      </CardHeader>
      <CardContent>
        {relatives.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No relatives found. Add relatives first to manage their call schedules.</p>
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
                      {relative.phone_number && (
                        <div className="flex items-center space-x-1">
                          <Phone className="h-4 w-4" />
                          <span>{relative.phone_number}</span>
                        </div>
                      )}
                      {(relative.schedule?.timezone || relative.timezone) && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{getTimezoneLabel(relative.schedule?.timezone || relative.timezone || '')}</span>
                        </div>
                      )}
                    </div>
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
                          <DialogTitle>Edit Call Schedule</DialogTitle>
                          <DialogDescription>
                            Update call times, timezone, and phone number for {relative.first_name} {relative.last_name}
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4 px-1">
                          {/* Phone Number */}
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                              id="phone"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="+62-8XX-XXXX-XXXX or 08XX-XXXX-XXXX"
                            />
                            <p className="text-xs text-muted-foreground">
                              Indonesian format: +62-8XX-XXXX-XXXX or 08XX-XXXX-XXXX
                            </p>
                          </div>

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
                            <Label>Call Times</Label>
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
                              <Label htmlFor="active" className="font-medium">Active Schedule</Label>
                              <p className="text-xs text-muted-foreground">Enable or disable scheduled calls</p>
                            </div>
                            <Switch
                              id="active"
                              checked={isActive}
                              onCheckedChange={setIsActive}
                            />
                          </div>

                          {/* Save Button */}
                          <div className="flex justify-end space-x-2 pt-4 border-t">
                            <Button
                              variant="outline"
                              onClick={() => setIsDialogOpen(false)}
                              disabled={isSaving}
                            >
                              Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={isSaving}>
                              {isSaving && <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />}
                              <Check className="h-4 w-4 mr-2" />
                              Save Changes
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Schedule Display */}
                {relative.schedule && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="text-center p-2 bg-primary/5 rounded">
                      <p className="text-xs text-muted-foreground">Morning</p>
                      <p className="font-mono text-sm">{relative.schedule.morning_time}</p>
                    </div>
                    <div className="text-center p-2 bg-primary/5 rounded">
                      <p className="text-xs text-muted-foreground">Afternoon</p>
                      <p className="font-mono text-sm">{relative.schedule.afternoon_time}</p>
                    </div>
                    <div className="text-center p-2 bg-primary/5 rounded">
                      <p className="text-xs text-muted-foreground">Evening</p>
                      <p className="font-mono text-sm">{relative.schedule.evening_time}</p>
                    </div>
                  </div>
                )}

                {!relative.schedule && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No call schedule set. Click "Edit" to create a schedule for this relative.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CallScheduleManager;