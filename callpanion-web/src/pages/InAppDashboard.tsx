import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Phone, Users, Clock, Settings, PhoneCall, Calendar, TrendingUp, ArrowRight, MessageSquare, Image, CalendarClock, QrCode, FileText, RefreshCw, CheckCircle2, XCircle, Moon, Smile, Activity, Users2, TrendingUp as TrendingUpIcon, CalendarIcon, Globe, Smartphone, Download, Info } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { SettingsSidebar } from "@/components/SettingsSidebar";
import { DevicePairingManager } from "@/components/DevicePairingManager";
import { InAppCallScheduleSettings } from "@/components/InAppCallScheduleSettings";
import { PairedDevicesStatus } from "@/components/PairedDevicesStatus";
import { FamilyChatComponent } from "@/components/FamilyChatComponent";
import { InAppCallSummaryViewer } from "@/components/InAppCallSummaryViewer";
import { GalleryViewer } from "@/components/GalleryViewer";
// ElevenLabsCallInterface removed - now using Flutter native

interface Household {
  id: string;
  name: string;
  city: string;
  country: string;
  call_method_preference: string;
}

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
  call_cadence: string;
  timezone: string;
  schedule?: {
    morning_time: string;
    afternoon_time: string;
    evening_time: string;
    active: boolean;
  };
}

interface CallLog {
  id: string;
  timestamp: string;
  call_outcome: string;
  call_duration: number | null;
  relative_id: string;
  provider: string;
  call_type: string;
}

const InAppDashboard = () => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallLog[]>([]);
  const [todayCalls, setTodayCalls] = useState<CallLog[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [healthInsightsDate, setHealthInsightsDate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [currentCall, setCurrentCall] = useState<any>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showPairingDialog, setShowPairingDialog] = useState(false);
  const [isRefreshingSchedule, setIsRefreshingSchedule] = useState(false);
  const [isPaired, setIsPaired] = useState(false);
  const [pairingCount, setPairingCount] = useState(0);
  const [photosShared, setPhotosShared] = useState(0);
  const [healthInsights, setHealthInsights] = useState({
    sleepQuality: 0,
    moodScore: 0,
    activityLevel: 0,
    socialInteraction: 0
  });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      loadDashboardData();
      loadPhotosShared();
      loadHealthInsights();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadTodayCalls();
    }
  }, [user, selectedDate]);

  useEffect(() => {
    if (user) {
      loadHealthInsights();
    }
  }, [user, healthInsightsDate]);

  // Realtime subscription for schedule changes
  useEffect(() => {
    if (!user) return;

    console.log('Setting up realtime subscriptions...');

    const scheduleChannel = supabase
      .channel('schedule-changes-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'schedules'
        },
        (payload) => {
          console.log('✅ Schedule changed detected:', payload);
          // Force reload dashboard data
          loadDashboardData();
        }
      )
      .subscribe((status) => {
        console.log('Schedule channel subscription status:', status);
      });

    // Also listen to relatives table changes
    const relativesChannel = supabase
      .channel('relatives-changes-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'relatives'
        },
        (payload) => {
          console.log('✅ Relatives changed detected:', payload);
          loadDashboardData();
        }
      )
      .subscribe((status) => {
        console.log('Relatives channel subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscriptions...');
      supabase.removeChannel(scheduleChannel);
      supabase.removeChannel(relativesChannel);
    };
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);

      // Fetch households
      const { data: householdsData, error: householdsError } = await supabase
        .from('households')
        .select('*')
        .eq('created_by', user?.id);

      if (householdsError) throw householdsError;

      // Get household IDs
      const householdIds = householdsData?.map(h => h.id) || [];

      if (householdIds.length > 0) {
        // Fetch relatives for these households (in-app call method only)
        const { data: relativesData, error: relativesError } = await supabase
          .from('relatives')
          .select('*')
          .in('household_id', householdIds);

        if (relativesError) throw relativesError;

        // Fetch schedules for relatives
        const relativeIds = relativesData?.map(r => r.id) || [];
        let schedulesData: any[] = [];
        
        if (relativeIds.length > 0) {
          const { data: schedules, error: schedulesError } = await supabase
            .from('schedules')
            .select('relative_id, morning_time, afternoon_time, evening_time, active')
            .in('relative_id', relativeIds);
          
          if (!schedulesError) {
            schedulesData = schedules || [];
          }
        }

        // Combine relatives with their schedules
        const relativesWithSchedules = relativesData?.map(relative => ({
          ...relative,
          schedule: schedulesData.find(s => s.relative_id === relative.id)
        })) || [];

        // Fetch total call count (in-app calls only) - using count for efficiency
        const { count: totalCallCount, error: countError } = await supabase
          .from('call_logs')
          .select('*', { count: 'exact', head: true })
          .in('household_id', householdIds)
          .eq('call_type', 'in_app_call');

        if (countError) throw countError;

        // Fetch successful calls count (completed OR answered)
        const { data: allCallsData, error: allCallsError } = await supabase
          .from('call_logs')
          .select('call_outcome')
          .in('household_id', householdIds)
          .eq('call_type', 'in_app_call');

        if (allCallsError) throw allCallsError;

        // Count successful calls (answered or completed)
        const successfulCallCount = allCallsData?.filter(call => 
          call.call_outcome === 'answered' || call.call_outcome === 'completed'
        ).length || 0;

        // Check pairing status
        const { data: pairingData, error: pairingError } = await supabase
          .from('device_pairs')
          .select('id, claimed_at')
          .in('household_id', householdIds)
          .not('claimed_at', 'is', null);

        if (!pairingError) {
          const pairedCount = pairingData?.length || 0;
          setIsPaired(pairedCount > 0);
          setPairingCount(pairedCount);
        }

        setHouseholds(householdsData || []);
        setRelatives(relativesWithSchedules);
        // Store the actual counts in recentCalls state (we'll use it differently)
        setRecentCalls([
          { id: 'total', count: totalCallCount || 0 } as any,
          { id: 'successful', count: successfulCallCount || 0 } as any
        ]);
        
        console.log('Dashboard data loaded, relatives with schedules:', relativesWithSchedules);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshSchedule = async () => {
    setIsRefreshingSchedule(true);
    await loadDashboardData();
    setIsRefreshingSchedule(false);
    toast({
      title: "Schedule Updated",
      description: "Schedule times have been refreshed",
    });
  };

  const loadPhotosShared = async () => {
    try {
      // Fetch households
      const { data: householdsData, error: householdsError } = await supabase
        .from('households')
        .select('*')
        .eq('created_by', user?.id);

      if (householdsError) throw householdsError;

      const householdIds = householdsData?.map(h => h.id) || [];

      if (householdIds.length > 0) {
        // Count photos from chat_messages where message_type = 'image'
        const { count, error: photosError } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .in('household_id', householdIds)
          .eq('message_type', 'image');

        if (photosError) throw photosError;

        setPhotosShared(count || 0);
        console.log('📷 Photos shared:', count);
      }
    } catch (error) {
      console.error('Error loading photos:', error);
    }
  };

  const loadHealthInsights = async () => {
    try {
      // Fetch households
      const { data: householdsData, error: householdsError } = await supabase
        .from('households')
        .select('*')
        .eq('created_by', user?.id);

      if (householdsError) throw householdsError;

      const householdIds = householdsData?.map(h => h.id) || [];

      if (householdIds.length > 0) {
        // Filter untuk tanggal yang dipilih
        const startDate = startOfDay(healthInsightsDate);
        const endDate = endOfDay(healthInsightsDate);

        // Fetch call summaries dari hari ini saja (max 3)
        const { data: summariesData, error: summariesError } = await supabase
          .from('call_summaries')
          .select('mood, mood_score, key_points, tl_dr')
          .in('household_id', householdIds)
          .gte('created_at', startDate.toISOString())
          .lte('created_at', endDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(3);

        if (summariesError) throw summariesError;

        if (summariesData && summariesData.length > 0) {
          let totalMoodScore = 0;
          let moodCount = 0;
          let sleepMentions = 0, sleepPositive = 0;
          let activityMentions = 0, activityPositive = 0;
          let socialMentions = 0, socialPositive = 0;

          summariesData.forEach(summary => {
            // 1. MOOD SCORE - ambil dari key_points.data_collection.mood_score.value
            let moodValue = null;
            
            // Cek di field mood_score langsung
            if (summary.mood_score !== null && summary.mood_score !== undefined) {
              moodValue = summary.mood_score;
            }
            // Cek di key_points.data_collection.mood_score.value (DENGAN .value!)
            else if (summary.key_points && typeof summary.key_points === 'object') {
              const keyPoints = summary.key_points as any;
              // Struktur dari ElevenLabs: data_collection.mood_score.value
              if (keyPoints.data_collection?.mood_score?.value !== undefined) {
                moodValue = keyPoints.data_collection.mood_score.value;
              }
            }
            
            if (moodValue !== null && moodValue !== undefined) {
              // Convert to number untuk menghindari NaN
              const numericMood = typeof moodValue === 'number' ? moodValue : parseFloat(String(moodValue));
              if (!isNaN(numericMood) && numericMood >= 1 && numericMood <= 5) {
                totalMoodScore += numericMood;
                moodCount++;
              }
            }

            // Gabungkan semua teks untuk analisis
            const allText = [
              summary.tl_dr || '',
              summary.mood || '',
              ...(Array.isArray(summary.key_points) ? summary.key_points : 
                  typeof summary.key_points === 'object' ? Object.values(summary.key_points) : [])
            ].join(' ').toLowerCase();

            // 2. SLEEP QUALITY - prioritas dari data_collection, fallback ke text analysis
            const dataCollection = (summary.key_points as any)?.data_collection;
            
            // Cek apakah ada data sleep dari ElevenLabs data_collection (DENGAN .value!)
            if (dataCollection?.sleep_quality?.value) {
              sleepMentions++;
              const sleepValue = String(dataCollection.sleep_quality.value).toLowerCase();
              // good/well = 1, fair/okay = 0.5, poor/bad = 0
              if (sleepValue.includes('good') || sleepValue.includes('well') || sleepValue.includes('baik') || sleepValue.includes('nyenyak')) {
                sleepPositive++;
              } else if (sleepValue.includes('poor') || sleepValue.includes('bad') || sleepValue.includes('kurang') || sleepValue.includes('susah')) {
                // poor sleep = 0, tidak tambah sleepPositive
              } else {
                sleepPositive += 0.5; // neutral = 50%
              }
            } else {
              // Fallback: analisis text-based
              const sleepKeywords = ['sleep', 'tidur', 'rest', 'istirahat', 'nyenyak', 'insomnia', 'slept'];
              const sleepPositiveWords = ['well', 'baik', 'nyenyak', 'cukup', 'good', 'better'];
              const sleepNegativeWords = ['kurang', 'susah', 'tidak', 'bad', 'poor', 'insomnia'];
              
              const hasSleep = sleepKeywords.some(keyword => allText.includes(keyword));
              if (hasSleep) {
                sleepMentions++;
                const hasPositive = sleepPositiveWords.some(word => allText.includes(word));
                const hasNegative = sleepNegativeWords.some(word => allText.includes(word));
                
                if (hasPositive && !hasNegative) sleepPositive++;
                else if (!hasNegative) sleepPositive += 0.5; // netral = 50%
              }
            }

            // 3. ACTIVITY LEVEL - prioritas dari data_collection, fallback ke text analysis (DENGAN .value!)
            if (dataCollection?.activity?.value) {
              activityMentions++;
              const activityValue = String(dataCollection.activity.value).toLowerCase();
              // Ada aktivitas apapun (walked, stretched, movement, exercised) = positive
              if (activityValue !== 'none' && activityValue !== 'rested') {
                activityPositive++;
              } else if (activityValue === 'rested') {
                activityPositive += 0.5; // rested = 50% (neutral)
              }
            } else {
              // Fallback: analisis text-based
              const activityKeywords = ['aktif', 'active', 'jalan', 'walk', 'olahraga', 'exercise', 'gerak', 'senam', 'movement', 'exercised'];
              const activityPositiveWords = ['sering', 'rutin', 'banyak', 'very', 'regular', 'often'];
              const activityNegativeWords = ['jarang', 'tidak', 'malas', 'rarely', 'never'];
              
              const hasActivity = activityKeywords.some(keyword => allText.includes(keyword));
              if (hasActivity) {
                activityMentions++;
                const hasPositive = activityPositiveWords.some(word => allText.includes(word));
                const hasNegative = activityNegativeWords.some(word => allText.includes(word));
                
                if (hasPositive && !hasNegative) activityPositive++;
                else if (!hasNegative) activityPositive += 0.5;
              }
            }

            // 4. SOCIAL INTERACTION - prioritas dari data_collection, fallback ke text analysis (DENGAN .value!)
            if (dataCollection?.social_contact?.value) {
              socialMentions++;
              const socialValue = String(dataCollection.social_contact.value).toLowerCase();
              // Ada kontak sosial (family, friends, etc) = positive
              if (socialValue !== 'none' && socialValue.trim() !== '') {
                socialPositive++;
              } else if (socialValue === 'none') {
                // none = 0%, tidak tambah socialPositive
              }
            } else {
              // Fallback: analisis text-based
              const socialKeywords = ['teman', 'friend', 'keluarga', 'family', 'kunjung', 'visit', 'bertemu', 'meet', 'ngobrol', 'chat', 'social'];
              const socialPositiveWords = ['sering', 'banyak', 'ramai', 'many', 'several', 'often'];
              const socialNegativeWords = ['sendiri', 'alone', 'sepi', 'lonely', 'jarang'];
              
              const hasSocial = socialKeywords.some(keyword => allText.includes(keyword));
              if (hasSocial) {
                socialMentions++;
                const hasPositive = socialPositiveWords.some(word => allText.includes(word));
                const hasNegative = socialNegativeWords.some(word => allText.includes(word));
                
                if (hasPositive && !hasNegative) socialPositive++;
                else if (!hasNegative) socialPositive += 0.5;
              }
            }
          });

          // Hitung persentase
          // Mood score range 1-5, convert ke persentase 0-100%
          const moodPercentage = moodCount > 0 
            ? Math.round((totalMoodScore / moodCount / 5) * 100) 
            : 0;
          
          const sleepPercentage = sleepMentions > 0 
            ? Math.round((sleepPositive / sleepMentions) * 100) 
            : 0;
          
          const activityPercentage = activityMentions > 0 
            ? Math.round((activityPositive / activityMentions) * 100) 
            : 0;
          
          const socialPercentage = socialMentions > 0 
            ? Math.round((socialPositive / socialMentions) * 100) 
            : 0;

          setHealthInsights({
            sleepQuality: Math.min(sleepPercentage, 100),
            moodScore: Math.min(moodPercentage, 100),
            activityLevel: Math.min(activityPercentage, 100),
            socialInteraction: Math.min(socialPercentage, 100)
          });

          console.log('📊 Health Insights calculated:', {
            summariesCount: summariesData.length,
            mood: `${moodPercentage}% (from ${moodCount} scores)`,
            sleep: `${sleepPercentage}% (${sleepPositive}/${sleepMentions} mentions)`,
            activity: `${activityPercentage}% (${activityPositive}/${activityMentions} mentions)`,
            social: `${socialPercentage}% (${socialPositive}/${socialMentions} mentions)`
          });
        } else {
          // Jika tidak ada data hari ini, set semua ke 0
          setHealthInsights({
            sleepQuality: 0,
            moodScore: 0,
            activityLevel: 0,
            socialInteraction: 0
          });
          console.log('📊 No health data available for today');
        }
      }
    } catch (error) {
      console.error('Error loading health insights:', error);
    }
  };

  const loadTodayCalls = async () => {
    try {
      // Fetch households
      const { data: householdsData, error: householdsError } = await supabase
        .from('households')
        .select('*')
        .eq('created_by', user?.id);

      if (householdsError) throw householdsError;

      const householdIds = householdsData?.map(h => h.id) || [];

      if (householdIds.length > 0) {
        const startDate = startOfDay(selectedDate);
        const endDate = endOfDay(selectedDate);

        // Fetch today's calls
        const { data: callsData, error: callsError } = await supabase
          .from('call_logs')
          .select(`
            id,
            timestamp,
            call_outcome,
            call_duration,
            relative_id,
            provider,
            call_type,
            session_id,
            provider_call_id
          `)
          .in('household_id', householdIds)
          .eq('call_type', 'in_app_call')
          .gte('timestamp', startDate.toISOString())
          .lte('timestamp', endDate.toISOString())
          .order('timestamp', { ascending: false });

        if (callsError) throw callsError;

        // Group by session identifier (session_id atau provider_call_id)
        // Ambil hanya 1 entry per call session (yang paling lengkap/terbaru)
        const sessionMap = new Map<string, CallLog>();
        
        (callsData || []).forEach(call => {
          // Gunakan session_id atau provider_call_id sebagai key
          const sessionKey = call.session_id || call.provider_call_id || `${call.relative_id}-${call.timestamp}`;
          
          const existing = sessionMap.get(sessionKey);
          
          if (!existing) {
            sessionMap.set(sessionKey, call);
          } else {
            // Prioritas: yang punya duration > yang timestamp lebih baru
            const shouldReplace = 
              (call.call_duration != null && existing.call_duration == null) ||
              (call.call_duration != null && existing.call_duration != null && 
               new Date(call.timestamp) > new Date(existing.timestamp)) ||
              (call.call_duration == null && existing.call_duration == null &&
               new Date(call.timestamp) > new Date(existing.timestamp));
            
            if (shouldReplace) {
              sessionMap.set(sessionKey, call);
            }
          }
        });

        const uniqueCalls = Array.from(sessionMap.values());
        
        console.log('📞 Call filtering:', {
          total: callsData?.length || 0,
          unique: uniqueCalls.length,
          duplicatesRemoved: (callsData?.length || 0) - uniqueCalls.length
        });

        setTodayCalls(uniqueCalls);
      }
    } catch (error) {
      console.error('Error loading today calls:', error);
    }
  };

  const formatCallOutcome = (outcome: string) => {
    const variants: { [key: string]: "default" | "secondary" | "destructive" | "outline" } = {
      'completed': 'default',
      'missed': 'destructive', 
      'busy': 'secondary',
      'failed': 'destructive'
    };
    return <Badge variant={variants[outcome] || 'outline'}>{outcome}</Badge>;
  };

  const formatDuration = (duration: number | null) => {
    if (!duration) return 'N/A';
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Helper function to format time with timezone awareness
  const formatTimeWithTimezone = (timeString: string, timezone: string) => {
    try {
      // Parse time string (HH:mm:ss or HH:mm)
      const [hours, minutes] = timeString.split(':').map(Number);
      
      // Create a date object for today with the specified time in the relative's timezone
      const today = new Date();
      today.setHours(hours, minutes, 0, 0);
      
      // Format the time in the relative's timezone
      return formatInTimeZone(today, timezone, 'HH:mm');
    } catch (error) {
      console.error('Error formatting time with timezone:', error);
      return timeString; // Fallback to original
    }
  };

  // Helper to get timezone abbreviation
  const getTimezoneAbbr = (timezone: string) => {
    const abbrs: { [key: string]: string } = {
      'Asia/Jakarta': 'WIB',
      'Asia/Makassar': 'WITA',
      'Asia/Jayapura': 'WIT',
      'Europe/London': 'GMT',
      'Europe/Dublin': 'GMT',
      'America/New_York': 'EST',
      'America/Los_Angeles': 'PST',
      'Australia/Sydney': 'AEST',
    };
    return abbrs[timezone] || timezone.split('/')[1] || 'Local';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary/20 via-background to-warmth/10 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const totalCalls = (recentCalls.find(r => r.id === 'total') as any)?.count || 0;
  const successfulCalls = (recentCalls.find(r => r.id === 'successful') as any)?.count || 0;
  const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/20 via-background to-warmth/10">
      <div className="container mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2 w-full sm:w-auto">
            <p className="text-xs font-thin text-muted-foreground uppercase tracking-wide">
              Dashboard In-App Call
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">
              Welcome {households.length > 0 ? households[0].name : 'Home'}
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-muted-foreground">
              Monitoring {relatives.length > 0 ? `${relatives[0].first_name} ${relatives[0].last_name}` : 'your loved ones'}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Pairing Status Indicator */}
            <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border transition-all ${
              isPaired 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 dark:from-green-950/30 dark:to-emerald-950/30 dark:border-green-800' 
                : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/30 dark:to-orange-950/30 dark:border-amber-800'
            }`}>
              {isPaired ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-green-700 dark:text-green-300">
                      Device Paired
                    </span>
                    <span className="text-[10px] text-green-600 dark:text-green-400">
                      {pairingCount} {pairingCount === 1 ? 'device' : 'devices'} connected
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      No Device Paired
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">
                      Connect a device
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Download APK Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open('/elderly-app/setup', '_blank')}
              className="border border-primary/20 hover:border-primary hover:bg-primary/5 w-full sm:w-auto"
              title="Download CallPanion APK"
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Settings Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="border-primary/20 hover:border-primary hover:bg-primary/5 w-full sm:w-auto"
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Setup Banner - Show if not paired yet */}
        {!isPaired && pairingCount === 0 && (
          <Alert className="border-primary bg-primary/5">
            <Smartphone className="h-4 w-4" />
            <AlertTitle className="text-lg font-semibold">
              Setup Required: Install Elderly App
            </AlertTitle>
            <AlertDescription className="space-y-3 mt-2">
              <p>To start making in-app calls, you need to:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Download and install the CallPanion app on your relative's device</li>
                <li>Generate a pairing code from the Device Pairing section below</li>
                <li>Enter the code in the app to connect</li>
              </ol>
              <div className="flex gap-2 mt-3">
                <Button asChild>
                  <a href="/elderly-app/setup">
                    <Download className="mr-2 h-4 w-4" />
                    Download App & Setup Guide
                  </a>
                </Button>
                <Button variant="outline" onClick={() => setShowPairingDialog(true)}>
                  Go to Device Pairing
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Overview Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="border-primary/10 shadow-warm bg-card/80 backdrop-blur-sm hover:shadow-xl transition-shadow rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-primary">Today's Calls</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
                <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3 sm:px-6">
              <div className="text-lg sm:text-xl font-bold text-primary mb-1">{todayCalls.filter(call => ['completed', 'answered'].includes(call.call_outcome)).length}/3</div>
              <div className="space-y-0.5">
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Scheduled calls completed
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 shadow-warm bg-card/80 backdrop-blur-sm hover:shadow-xl transition-shadow rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-primary">Relatives</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
                <PhoneCall className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3 sm:px-6">
              <div className="text-lg sm:text-xl font-bold text-primary mb-1">{relatives.length}</div>
              <div className="space-y-0.5">
                {relatives.slice(0, 1).map((relative) => (
                  <div key={relative.id} className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-primary"></div>
                    {relative.first_name} {relative.last_name}
                  </div>
                ))}
                {relatives.length === 0 && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">No relatives yet</p>
                )}
                {relatives.length > 1 && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">+{relatives.length - 1} more</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/10 shadow-warm bg-card/80 backdrop-blur-sm hover:shadow-xl transition-shadow rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-primary">Photos Shared</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
                <Image className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3 sm:px-6">
              <div className="text-lg sm:text-xl font-bold text-primary mb-0.5">{photosShared}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Images from relatives
              </p>
            </CardContent>
          </Card>

          <Card className="border-primary/10 shadow-warm bg-card/80 backdrop-blur-sm hover:shadow-xl transition-shadow rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-2 px-3 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-semibold text-primary">Success Rate</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="pb-3 pt-0 px-3 sm:px-6">
              <div className="text-lg sm:text-xl font-bold text-primary mb-0.5">{successRate}%</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Connected successfully
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content with Tabs */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
          {/* Left Side: Tabs for Call Summaries and Chat (8 columns = ~65%) */}
          <div className="lg:col-span-8 space-y-6">
            <Tabs defaultValue="calls" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-card/80 backdrop-blur-sm border border-primary/10">
                <TabsTrigger value="calls" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm">
                  <Phone className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Recent Calls</span>
                  <span className="sm:hidden">Calls</span>
                </TabsTrigger>
                <TabsTrigger value="chat" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm">
                  <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="gallery" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-xs sm:text-sm">
                  <Image className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Memories</span>
                  <span className="sm:hidden">Photos</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="calls" className="mt-6">
                <InAppCallSummaryViewer />
              </TabsContent>
              
              <TabsContent value="chat" className="mt-6">
                {households.length > 0 && relatives.length > 0 && (
                  <FamilyChatComponent 
                    householdId={households[0].id} 
                    relativeName={`${relatives[0].first_name} ${relatives[0].last_name}`}
                  />
                )}
              </TabsContent>

              <TabsContent value="gallery" className="mt-6">
                {households.length > 0 && (
                  <GalleryViewer householdId={households[0].id} />
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Side: Health Insights & Quick Actions */}
          <div className="lg:col-span-4 space-y-6">
            {/* Health Insights */}
            <Card className="border-primary/10 shadow-warm bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-semibold text-primary">Health Insights</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">Based on today's AI conversations</CardDescription>
                  </div>
                  {/* Date Picker for Health Insights */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal h-8 px-2 sm:px-3 text-[10px] sm:text-xs w-full sm:w-auto",
                          !healthInsightsDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3" />
                        <span className="hidden sm:inline">{format(healthInsightsDate, "PPP")}</span>
                        <span className="sm:hidden">{format(healthInsightsDate, "MMM d")}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={healthInsightsDate}
                        onSelect={(date) => date && setHealthInsightsDate(date)}
                        disabled={(date) => date > new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Sleep Quality */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Sleep Quality</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{healthInsights.sleepQuality}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                      style={{ width: `${healthInsights.sleepQuality}%` }}
                    />
                  </div>
                </div>

                {/* Mood Score */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smile className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Mood Score</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{healthInsights.moodScore}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                      style={{ width: `${healthInsights.moodScore}%` }}
                    />
                  </div>
                </div>

                {/* Activity Level */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Activity Level</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{healthInsights.activityLevel}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                      style={{ width: `${healthInsights.activityLevel}%` }}
                    />
                  </div>
                </div>

                {/* Social Interaction */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users2 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Social Interaction</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{healthInsights.socialInteraction}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500"
                      style={{ width: `${healthInsights.socialInteraction}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-primary/10 shadow-warm bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg font-semibold text-primary">Quick Actions</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Manage your call settings and devices</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Schedule Times Display with Timezone */}
                {relatives.length > 0 && relatives[0] && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-primary">
                        Call Schedule for {relatives[0].first_name}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefreshSchedule}
                        disabled={isRefreshingSchedule}
                        className="h-7 w-7 p-0"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingSchedule ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    
                    {/* Timezone and Status Indicators */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap">
                      {relatives[0].timezone && (
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground bg-primary/5 px-2 sm:px-3 py-1.5 rounded-lg border border-primary/10 w-full sm:w-auto">
                          <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-primary flex-shrink-0" />
                          <span className="flex-1 sm:flex-initial">Times shown in <span className="font-semibold text-primary">{getTimezoneAbbr(relatives[0].timezone)}</span> timezone</span>
                        </div>
                      )}
                      
                      {relatives[0].schedule && (
                        <div className={cn(
                          "flex items-center gap-2 text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 rounded-lg border w-full sm:w-auto",
                          relatives[0].schedule.active 
                            ? "bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400" 
                            : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
                        )}>
                          {relatives[0].schedule.active ? (
                            <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                          ) : (
                            <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                          )}
                          <span className="font-medium">
                            Schedule {relatives[0].schedule.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Morning</p>
                        <p className="text-sm font-semibold text-primary">
                          {relatives[0].schedule?.morning_time 
                            ? formatTimeWithTimezone(relatives[0].schedule.morning_time, relatives[0].timezone || 'UTC')
                            : '09:00'}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Afternoon</p>
                        <p className="text-sm font-semibold text-primary">
                          {relatives[0].schedule?.afternoon_time 
                            ? formatTimeWithTimezone(relatives[0].schedule.afternoon_time, relatives[0].timezone || 'UTC')
                            : '14:00'}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                        <p className="text-xs text-muted-foreground mb-1">Evening</p>
                        <p className="text-sm font-semibold text-primary">
                          {relatives[0].schedule?.evening_time 
                            ? formatTimeWithTimezone(relatives[0].schedule.evening_time, relatives[0].timezone || 'UTC')
                            : '19:00'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-4 px-4 border-primary/20 hover:border-primary hover:bg-primary/5"
                    onClick={() => setShowScheduleDialog(true)}
                  >
                    <CalendarClock className="h-5 w-5 mr-3 text-primary" />
                    <span className="font-medium">Edit Schedule</span>
                  </Button>

                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-4 px-4 border-primary/20 hover:border-primary hover:bg-primary/5"
                    onClick={() => setShowPairingDialog(true)}
                  >
                    <QrCode className="h-5 w-5 mr-3 text-primary" />
                    <span className="font-medium">Generate Pairing Code</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Recent Calls Today */}
        <Card className="border-primary/10 shadow-warm bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
              <div>
                <CardTitle className="text-lg sm:text-xl font-semibold text-primary flex items-center gap-2">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                  Call List
                </CardTitle>
                <CardDescription className="text-muted-foreground mt-1 text-xs sm:text-sm">
                  {format(selectedDate, 'EEEE, dd MMMM yyyy')}
                </CardDescription>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "justify-start text-left font-normal h-9 px-2 sm:px-3 text-[10px] sm:text-sm w-full sm:w-auto",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3" />
                    <span className="hidden sm:inline">{format(selectedDate, "PPP")}</span>
                    <span className="sm:hidden">{format(selectedDate, "MMM d")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </CardHeader>
          <CardContent>
            {todayCalls.length === 0 ? (
              <div className="text-center py-12">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/10 mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <p className="text-sm font-medium text-primary mb-1">No calls for this date</p>
                <p className="text-xs text-muted-foreground">Try selecting a different date</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3 pr-4">
                    {todayCalls.map((call) => {
                      const relative = relatives.find(r => r.id === call.relative_id);
                      return (
                        <div key={call.id} className="flex items-center justify-between p-4 border border-primary/10 rounded-xl hover:bg-primary/5 transition-colors">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                              <Phone className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-primary">
                                {relative ? `${relative.first_name} ${relative.last_name}` : 'Unknown'}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {/* Format waktu sesuai timezone relative jika tersedia */}
                                {relative?.timezone 
                                  ? formatInTimeZone(new Date(call.timestamp), relative.timezone, 'HH:mm')
                                  : format(new Date(call.timestamp), 'HH:mm')
                                } {relative?.timezone && `(${getTimezoneAbbr(relative.timezone)})`} • {formatDuration(call.call_duration)}
                              </p>
                            </div>
                          </div>
                          <div>
                            {formatCallOutcome(call.call_outcome)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                {todayCalls.length > 3 && (
                  <div className="mt-4 pt-4 border-t border-primary/10 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <ArrowRight className="h-3 w-3" />
                      {todayCalls.length} calls total • Scroll to see more
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Call Interface - Now handled by Flutter native app */}
      {currentCall && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center space-y-4">
            <h3 className="text-lg font-semibold">Call in Progress</h3>
            <p className="text-muted-foreground">
              Voice call with {currentCall.relativeName} is now handled by Flutter native app
            </p>
            <button 
              onClick={() => setCurrentCall(null)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Settings Sidebar */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-background border-l shadow-lg">
            <SettingsSidebar onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* Schedule Settings Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">In-App Call Schedule Settings</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Manage call times and timezones for your relatives
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <InAppCallScheduleSettings />
          </div>
        </DialogContent>
      </Dialog>

      {/* Device Pairing Dialog */}
      <Dialog open={showPairingDialog} onOpenChange={setShowPairingDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Device Pairing</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Generate pairing codes for elderly devices
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <DevicePairingManager />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InAppDashboard;