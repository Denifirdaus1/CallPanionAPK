import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, Play, Pause, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";

interface InAppCallSession {
  id: string;
  relative_id: string;
  household_id: string;
  status: string;
  scheduled_time: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
  relatives: {
    first_name: string;
    last_name: string;
  };
}

export const InAppCallScheduleManager = () => {
  const [sessions, setSessions] = useState<InAppCallSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingCall, setIsStartingCall] = useState<string | null>(null);
  const { toast } = useToast();
  const { hasInAppCallAccess, isLoading: accessLoading } = useCallMethodAccess();

  useEffect(() => {
    if (hasInAppCallAccess) {
      loadInAppCallSessions();
    }
  }, [hasInAppCallAccess]);

  const loadInAppCallSessions = async () => {
    try {
      // Get user's households
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setSessions([]);
        return;
      }

      // Get in-app call sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('call_sessions')
        .select(`
          *,
          relatives(first_name, last_name)
        `)
        .in('household_id', householdIds)
        .eq('call_type', 'in_app_call')
        .order('scheduled_time', { ascending: false })
        .limit(10);

      if (sessionsError) throw sessionsError;

      setSessions(sessionsData || []);
    } catch (error: any) {
      console.error('Error loading in-app call sessions:', error);
      toast({
        title: "Error",
        description: "Failed to load in-app call sessions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Call initiation is handled automatically by scheduler - no manual calls allowed

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Scheduled</Badge>;
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">Completed</Badge>;
      case 'missed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Missed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (accessLoading || isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5" />
            <span>In-App Call Manager</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading sessions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasInAppCallAccess) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5" />
            <span>In-App Call Manager</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your household is not configured for in-app calls. Please contact support to enable this feature.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Smartphone className="h-5 w-5" />
          <span>In-App Call Manager</span>
        </CardTitle>
        <CardDescription>
          Manage and monitor in-app calls to your relatives' devices
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No in-app call sessions found.</p>
            <p className="text-sm text-muted-foreground mt-2">
              In-app calls will be automatically scheduled by the system.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sessions.map((session) => (
              <div key={session.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg">
                      {session.relatives.first_name} {session.relatives.last_name}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>
                          Scheduled: {new Date(session.scheduled_time).toLocaleString()}
                        </span>
                      </div>
                      {session.duration_seconds && (
                        <div className="flex items-center space-x-1">
                          <span>Duration: {formatDuration(session.duration_seconds)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(session.status)}
                    {session.status === 'scheduled' && (
                      <div className="text-sm text-muted-foreground">
                        Calls are initiated automatically by schedule
                      </div>
                    )}
                  </div>
                </div>

                {/* Call Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-medium">{session.status}</p>
                  </div>
                  {session.started_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Started</p>
                      <p className="text-sm font-medium">
                        {new Date(session.started_at).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  {session.ended_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Ended</p>
                      <p className="text-sm font-medium">
                        {new Date(session.ended_at).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-medium">{formatDuration(session.duration_seconds)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};sebelumnya kan ada masalah dimana shejule notifikasi tidak masuk ke prangkat , dan Lovable.dev melakukan update pada web dan ini laporannya :
  # Laporan Fix Scheduler In-App Calls & Flutter App Updates

  ## 📋 Executive Summary
  Telah dilakukan perbaikan kritis pada sistem scheduler in-app calls yang mengalami error database constraint. Semua error ON CONFLICT sudah diperbaiki dan sistem scheduler sekarang berfungsi dengan normal.

  ## 🔧 Perubahan Yang Dilakukan

  ### 1. Fix Error Database Constraint (CRITICAL)

  **Masalah:** Error "ON CONFLICT specification" karena constraint yang hilang di database
  **Solusi:** Mengganti semua operasi `upsert` dengan manual check-and-insert/update logic

  #### File: `supabase/functions/schedulerInAppCalls/index.ts`

  **Perubahan 1: Daily Call Tracking Update (Line 161-171)**
  ```typescript
  // SEBELUM (ERROR):
  await supabase
    .from('daily_call_tracking')
    .upsert({...}, { onConflict: 'relative_id,household_id,call_date' });

  // SESUDAH (FIXED):
  const { data: existingTracking } = await supabase
    .from('daily_call_tracking')
    .select('*')
    .eq('relative_id', notification.relative_id)
    .eq('household_id', notification.household_id)
    .eq('call_date', callDate)
    .maybeSingle();

  if (existingTracking) {
    // Update existing record
    await supabase.from('daily_call_tracking').update({...}).eq('id', existingTracking.id);
  } else {
    // Insert new record
    await supabase.from('daily_call_tracking').insert({...});
  }
  ```

  **Perubahan 2: Heartbeat Update (Line 741-755)**
  ```typescript
  // SEBELUM (ERROR):
  await supabase
    .from('cron_heartbeat')
    .upsert({...}, { onConflict: 'job_name' });

  // SESUDAH (FIXED):
  const { data: existingHeartbeat } = await supabase
    .from('cron_heartbeat')
    .select('*')
    .eq('job_name', 'callpanion-in-app-calls')
    .maybeSingle();

  if (existingHeartbeat) {
    await supabase.from('cron_heartbeat').update(heartbeatData).eq('id', existingHeartbeat.id);
  } else {
    await supabase.from('cron_heartbeat').insert(heartbeatData);
  }
  ```

  **Perubahan 3: Error Handling Heartbeat (Line 778-791)**
  - Sama seperti perubahan 2, mengganti upsert dengan manual check-and-insert/update

  ### 2. Verifikasi Schedule Database

  **Status:** ✅ BERHASIL
  - Schedule evening_time 22:00:00 sudah ada di database
  - Schedule aktif dengan timezone Asia/Jakarta
  - Household menggunakan call_method_preference: 'in_app_call'

  ### 3. Verifikasi Komponen Frontend

  **Status:** ✅ BERFUNGSI NORMAL
  - `InAppDashboard.tsx` - Dashboard utama berfungsi
  - `InAppCallScheduleSettings.tsx` - Settings schedule berfungsi
  - `InAppCallScheduleManager.tsx` - Manager calls berfungsi

  tolong dong kamu update apa yang harus di update di flutter apk nya agar fungsi shejule in app notificatiosnya berhasil kalo edge funcions dan db nya udah aku update seusai sama yang Lovable update , jadi kamu cek dan pastikan bisa berfungsi dengan baik dan notifikasi bisa masuk ya.

  C:\EldernAPK\callpanion_elderly\supabase\functions\schedulerInAppCalls\index.ts
  C:\EldernAPK\callpanion_elderly\callpanion-46b76-firebase-adminsdk-fbsvc-1aa602e050.json
  C:\EldernAPK\callpanion_elderly\ShemaDBpublic.MD
  C:\EldernAPK\callpanion_elderly\callpanion-web\src\components\InAppCallDashboard.tsx
  C:\EldernAPK\callpanion_elderly\callpanion-web\src\components\InAppCallScheduleSettings.tsx
  C:\EldernAPK\callpanion_elderly\callpanion-web\src\components\InAppCallScheduleManager.tsx

  dan aku juga mau pastikan agar update ini berfungsi untuk FCM notfikasi android dan VOIP untuk Ios , kamu update dan laporkan hasilnya ke saya ya.