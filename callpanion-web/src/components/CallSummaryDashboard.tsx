import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sun, Sunset, Moon, Clock, Heart, AlertTriangle, X } from "lucide-react";


interface CallSummary {
  id: string;
  provider_call_id: string;
  mood: string | null;
  mood_score: number | null;
  tl_dr: string | null;
  key_points: any;
  created_at: string;
  relative_id: string;
}

interface Relative {
  id: string;
  first_name: string;
  last_name: string;
}

interface CallLog {
  id: string;
  timestamp: string;
  call_outcome: string;
  call_duration: number | null;
  relative_id: string;
  provider_call_id: string | null;
}

interface CombinedCall {
  id: string;
  provider_call_id: string | null;
  relative_id: string;
  timestamp: string;
  call_outcome: string;
  call_duration: number | null;
  audio_recording_url?: string | null;
  summary?: CallSummary;
}

interface GroupedCalls {
  morning: CombinedCall[];
  afternoon: CombinedCall[];
  evening: CombinedCall[];
}

const CallSummaryDashboard = () => {
  const [calls, setCalls] = useState<GroupedCalls>({
    morning: [],
    afternoon: [],
    evening: []
  });
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCall, setSelectedCall] = useState<CombinedCall | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadCallSummaries();
    }
  }, [user, selectedDate]);

  const loadCallSummaries = async () => {
    try {
      setIsLoading(true);

      // Get user households
      const { data: householdsData } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user?.id);

      if (!householdsData?.length) return;

      const householdIds = householdsData.map(h => h.household_id);

      // Load relatives with timezone
      const { data: relativesData } = await supabase
        .from('relatives')
        .select('id, first_name, last_name, timezone')
        .in('household_id', householdIds);

      setRelatives(relativesData || []);

      // Load call logs for the selected date
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 1);

      const { data: callLogsData } = await supabase
        .from('call_logs')
        .select('*, audio_recording_url')
        .in('household_id', householdIds)
        .gte('timestamp', startDate.toISOString())
        .lt('timestamp', endDate.toISOString())
        .order('timestamp', { ascending: false });

      // Load call summaries for the same period
      let { data: summariesData } = await supabase
        .from('call_summaries')
        .select('*')
        .in('household_id', householdIds)
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString());

      // Try to migrate audio data if summaries exist but lack audio
      const summariesWithoutAudio = summariesData?.filter(s => {
        const keyPoints = s.key_points as any;
        return keyPoints && !keyPoints.audio_base64 && !keyPoints.audio_url;
      });
      
      if (summariesWithoutAudio && summariesWithoutAudio.length > 0) {
        console.log('Attempting to migrate audio data for', summariesWithoutAudio.length, 'summaries without audio...');
        try {
          const { data: migrationResult } = await supabase.functions.invoke('migrate-audio-data');
          console.log('Audio migration result:', migrationResult);
          
          // Refetch summaries after migration
          const { data: updatedSummariesData } = await supabase
            .from('call_summaries')
            .select('*')
            .in('household_id', householdIds)
            .gte('created_at', startDate.toISOString())
            .lt('created_at', endDate.toISOString());
          
          if (updatedSummariesData) {
            console.log('Refetched summaries after migration');
            summariesData = updatedSummariesData;
          }
        } catch (error) {
          console.error('Failed to migrate audio data:', error);
        }
      }

      // Combine call logs with summaries
      const combinedCalls: CombinedCall[] = (callLogsData || []).map(callLog => {
        const summary = summariesData?.find(s => s.provider_call_id === callLog.provider_call_id);
        return {
          id: callLog.id,
          provider_call_id: callLog.provider_call_id,
          relative_id: callLog.relative_id,
          timestamp: callLog.timestamp,
          call_outcome: callLog.call_outcome,
          call_duration: callLog.call_duration,
          audio_recording_url: callLog.audio_recording_url,
          summary
        };
      });

      // Group calls by time slots based on local timezone
      const grouped: GroupedCalls = {
        morning: [],
        afternoon: [],
        evening: []
      };

      combinedCalls.forEach(call => {
        const relative = relativesData?.find(r => r.id === call.relative_id);
        const timezone = relative?.timezone || 'UTC';
        
        // Convert to local time
        const localTime = new Date(call.timestamp).toLocaleString('en-US', { 
          timeZone: timezone, 
          hour12: false 
        });
        const hour = parseInt(localTime.split(' ')[1].split(':')[0]);

        if (hour >= 5 && hour < 12) {
          grouped.morning.push(call);
        } else if (hour >= 12 && hour < 17) {
          grouped.afternoon.push(call);
        } else {
          grouped.evening.push(call);
        }
      });

      setCalls(grouped);

    } catch (error) {
      console.error('Error loading call summaries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMoodBadge = (mood: string | null, score: number | null) => {
    if (!mood) return <Badge variant="outline">Unknown</Badge>;
    
    switch (mood) {
      case 'positive':
        return <Badge className="bg-green-100 text-green-800">Positive</Badge>;
      case 'neutral':
        return <Badge className="bg-blue-100 text-blue-800">Neutral</Badge>;
      case 'concerning':
        return <Badge className="bg-red-100 text-red-800">Concerning</Badge>;
      default:
        return <Badge variant="outline">{mood}</Badge>;
    }
  };

  const getSlotIcon = (slot: string) => {
    switch (slot) {
      case 'morning':
        return <Sun className="h-5 w-5 text-yellow-500" />;
      case 'afternoon':
        return <Sunset className="h-5 w-5 text-orange-500" />;
      case 'evening':
        return <Moon className="h-5 w-5 text-purple-500" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  };

  const openCallDetail = (call: CombinedCall) => {
    setSelectedCall(call);
    setIsModalOpen(true);
  };

  // Audio player using Web Audio API
  const playAudioWithWebAPI = async (base64Data: string) => {
    try {
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  };

  const closeCallDetail = () => {
    setSelectedCall(null);
    setIsModalOpen(false);
  };

  const renderCallCard = (call: CombinedCall) => {
    const relative = relatives.find(r => r.id === call.relative_id);
    const summary = call.summary;
    
    return (
      <Card 
        key={call.id} 
        className="mb-4 cursor-pointer hover:shadow-md transition-shadow duration-200 hover-scale"
        onClick={() => openCallDetail(call)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {relative ? `${relative.first_name} ${relative.last_name}` : 'Unknown'}
            </CardTitle>
            <div className="flex items-center space-x-2">
              {summary ? formatMoodBadge(summary.mood, summary.mood_score) : 
                <Badge variant="outline">No Summary</Badge>}
              {summary?.mood_score && (
                <Badge variant="outline">{summary.mood_score}/5</Badge>
              )}
            </div>
          </div>
          <CardDescription>
            <div className="flex items-center space-x-4 text-sm">
              <span>{new Date(call.timestamp).toLocaleTimeString()}</span>
              {call.call_duration && (
                <span>{Math.round(call.call_duration / 60)} min</span>
              )}
              <Badge variant={['answered', 'completed'].includes(call.call_outcome) ? 'default' : 'destructive'}>
                {call.call_outcome}
              </Badge>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Audio Player */}
          {(call.audio_recording_url || summary?.key_points?.audio_base64) && (
             <div className="mb-4">
               {call.audio_recording_url ? (
                 <div>
                   <h4 className="font-medium mb-2 text-sm">Call Recording</h4>
                   <audio 
                     controls 
                     className="w-full h-8"
                     preload="metadata"
                   >
                     <source src={call.audio_recording_url} type="audio/mpeg" />
                     <source src={call.audio_recording_url} type="audio/wav" />
                     <source src={call.audio_recording_url} type="audio/webm" />
                     Your browser does not support the audio element.
                   </audio>
                 </div>
               ) : summary?.key_points?.audio_base64 ? (
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     playAudioWithWebAPI(summary.key_points.audio_base64);
                   }}
                   className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm flex items-center gap-2"
                 >
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                   </svg>
                   Play Audio
                 </button>
               ) : null}
              </div>
           )}
          
          {call.call_outcome === 'answered' && summary ? (
            <>
              {summary.tl_dr && (
                <div className="mb-3">
                  <h4 className="font-medium mb-1">Summary</h4>
                  <p className="text-sm text-muted-foreground">{summary.tl_dr}</p>
                </div>
              )}
              
              {summary.key_points?.data_collection && (
                <div className="space-y-2">
                  <h4 className="font-medium">Key Points</h4>
                  <div className="text-sm space-y-1">
                    {summary.key_points.data_collection.emergency_flag && (
                      <div className="flex items-center space-x-2 text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Emergency flag detected</span>
                      </div>
                    )}
                    {summary.key_points.data_collection.flag_fall_risk && (
                      <div className="flex items-center space-x-2 text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Fall risk concern</span>
                      </div>
                    )}
                    {summary.key_points.data_collection.flag_low_appetite && (
                      <div className="flex items-center space-x-2 text-orange-600">
                        <Heart className="h-4 w-4" />
                        <span>Low appetite noted</span>
                      </div>
                    )}
                    {summary.key_points.data_collection.flag_confused && (
                      <div className="flex items-center space-x-2 text-orange-600">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Confusion detected</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-muted-foreground">
                {call.call_outcome === 'no_answer' && 'Call was not answered'}
                {call.call_outcome === 'timeout' && 'Call timed out'}
                {call.call_outcome === 'cancelled' && 'Call was cancelled'}
                {call.call_outcome === 'failed' && 'Call failed to connect'}
                {!['no_answer', 'timeout', 'cancelled', 'failed'].includes(call.call_outcome) && 
                  `Call status: ${call.call_outcome}`}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderCallDetailModal = () => {
    if (!selectedCall) return null;

    const relative = relatives.find(r => r.id === selectedCall.relative_id);
    const summary = selectedCall.summary;

    return (
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {relative ? `${relative.first_name} ${relative.last_name}` : 'Unknown'}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              
              {/* Call Info */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-lg font-medium">
                    {new Date(selectedCall.timestamp).toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCall.call_duration ? `${Math.round(selectedCall.call_duration / 60)} min` : '0 min'}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {summary ? formatMoodBadge(summary.mood, summary.mood_score) : 
                    <Badge variant="outline">No Summary</Badge>}
                  {summary?.mood_score && (
                    <Badge variant="outline">{summary.mood_score}/5</Badge>
                  )}
                  <Badge variant={['answered', 'completed'].includes(selectedCall.call_outcome) ? 'default' : 'destructive'}>
                    {selectedCall.call_outcome}
                  </Badge>
                </div>
              </div>

              {/* Audio Player */}
              {(selectedCall.audio_recording_url || summary?.key_points?.audio_base64) && (
                <div className="p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-medium mb-3">Call Recording</h4>
                  {/* Audio Player */}
                  {(selectedCall.audio_recording_url || summary?.key_points?.audio_base64) && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Call Recording:</p>
                      {selectedCall.audio_recording_url ? (
                        <audio 
                          controls 
                          className="w-full"
                          preload="metadata"
                        >
                          <source src={selectedCall.audio_recording_url} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      ) : summary?.key_points?.audio_base64 ? (
                        <button 
                          onClick={() => playAudioWithWebAPI(summary.key_points.audio_base64)}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                          </svg>
                          Play Audio
                        </button>
                      ) : null}
                    </div>
                  )}
                  {summary?.key_points?.audio_base64 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Audio size: {Math.round(summary.key_points.audio_base64.length / 1024)} KB
                    </p>
                  )}
                </div>
              )}

              {/* Content based on call outcome */}
              {selectedCall.call_outcome === 'answered' && summary ? (
                <div className="space-y-4">
                  {/* Summary */}
                  {summary.tl_dr && (
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-2">Summary</h4>
                      <p className="text-muted-foreground leading-relaxed">{summary.tl_dr}</p>
                    </div>
                  )}
                  
                  {/* Key Points */}
                  {summary.key_points?.data_collection && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Key Points</h4>
                      <div className="space-y-2">
                        {summary.key_points.data_collection.emergency_flag && (
                          <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <span className="text-red-800 font-medium">Emergency flag detected</span>
                          </div>
                        )}
                        {summary.key_points.data_collection.flag_fall_risk && (
                          <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <span className="text-orange-800 font-medium">Fall risk concern</span>
                          </div>
                        )}
                        {summary.key_points.data_collection.flag_low_appetite && (
                          <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <Heart className="h-4 w-4 text-orange-600" />
                            <span className="text-orange-800 font-medium">Low appetite noted</span>
                          </div>
                        )}
                        {summary.key_points.data_collection.flag_confused && (
                          <div className="flex items-center space-x-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <span className="text-orange-800 font-medium">Confusion detected</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-muted-foreground">
                    {selectedCall.call_outcome === 'no_answer' && 'Call was not answered'}
                    {selectedCall.call_outcome === 'timeout' && 'Call timed out'}
                    {selectedCall.call_outcome === 'cancelled' && 'Call was cancelled'}
                    {selectedCall.call_outcome === 'failed' && 'Call failed to connect'}
                    {selectedCall.call_outcome === 'missed' && 'Call was missed'}
                    {!['no_answer', 'timeout', 'cancelled', 'failed', 'missed'].includes(selectedCall.call_outcome) && 
                      `Call status: ${selectedCall.call_outcome}`}
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };

  const renderTimeSlot = (slot: keyof GroupedCalls, title: string) => {
    const slotCalls = calls[slot];
    
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            {getSlotIcon(slot)}
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>
            {slotCalls.length} call{slotCalls.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {slotCalls.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No calls for this time slot
            </p>
          ) : (
            <div>
              {slotCalls.map(renderCallCard)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading call summaries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Call Summaries</h2>
          <p className="text-muted-foreground">
            Daily conversation summaries and wellbeing insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-input rounded-md text-sm"
          />
          <Button variant="outline" onClick={loadCallSummaries}>
            Refresh
          </Button>
          <Button 
            onClick={async () => {
              try {
                console.log('Manually triggering audio migration...');
                const { data, error } = await supabase.functions.invoke('migrate-audio-data');
                if (error) throw error;
                console.log('Migration result:', data);
                // Refresh after migration
                await loadCallSummaries();
              } catch (error) {
                console.error('Manual migration failed:', error);
              }
            }}
            variant="outline"
            size="sm"
          >
            Migrate Audio
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderTimeSlot('morning', 'Morning (5 AM - 12 PM)')}
        {renderTimeSlot('afternoon', 'Afternoon (12 PM - 5 PM)')}
        {renderTimeSlot('evening', 'Evening (5 PM - 12 AM)')}
      </div>

      {/* Call Detail Modal */}
      {renderCallDetailModal()}
    </div>
  );
};

export default CallSummaryDashboard;