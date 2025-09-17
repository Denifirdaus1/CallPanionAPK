import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, Volume2, Heart, MessageCircle, Clock, Calendar, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCallMethodAccess } from "@/hooks/useCallMethodAccess";

interface CallSummary {
  id: string;
  provider_call_id: string;
  mood: string | null;
  mood_score: number | null;
  key_points: any;
  tl_dr: string | null;
  transcript_url: string | null;
  created_at: string;
  call_logs: {
    id: string;
    call_outcome: string;
    call_duration: number | null;
    timestamp: string;
    audio_recording_url: string | null;
    relatives: {
      first_name: string;
      last_name: string;
    };
  };
}

export const InAppCallSummaryViewer = () => {
  const [summaries, setSummaries] = useState<CallSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<{ [key: string]: HTMLAudioElement }>({});
  const { toast } = useToast();
  const { hasInAppCallAccess, isLoading: accessLoading } = useCallMethodAccess();

  useEffect(() => {
    if (hasInAppCallAccess) {
      loadCallSummaries();
    }
  }, [hasInAppCallAccess]);

  const loadCallSummaries = async () => {
    try {
      // Get user's households
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setSummaries([]);
        return;
      }

      // Get call summaries for in-app calls (webrtc provider)
      const { data: summariesData, error: summariesError } = await supabase
        .from('call_summaries')
        .select(`
          *,
          call_logs(
            id,
            call_outcome,
            call_duration,
            timestamp,
            audio_recording_url,
            relatives(first_name, last_name)
          )
        `)
        .in('household_id', householdIds)
        .eq('provider', 'webrtc')
        .order('created_at', { ascending: false })
        .limit(20);

      if (summariesError) throw summariesError;

      setSummaries(summariesData || []);
    } catch (error: any) {
      console.error('Error loading call summaries:', error);
      toast({
        title: "Error",
        description: "Failed to load call summaries",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAudio = async (summaryId: string, audioUrl: string | null, audioBase64: string | null) => {
    try {
      if (playingAudio === summaryId) {
        // Stop current audio
        const audio = audioElements[summaryId];
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
        setPlayingAudio(null);
        return;
      }

      // Stop any other playing audio
      if (playingAudio) {
        const currentAudio = audioElements[playingAudio];
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
      }

      let audio = audioElements[summaryId];
      
      if (!audio) {
        audio = new Audio();
        
        if (audioUrl) {
          audio.src = audioUrl;
        } else if (audioBase64) {
          // Convert base64 to blob URL
          const byteCharacters = atob(audioBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'audio/mpeg' });
          audio.src = URL.createObjectURL(blob);
        } else {
          throw new Error('No audio data available');
        }
        
        audio.onended = () => setPlayingAudio(null);
        audio.onerror = () => {
          console.error('Error playing audio');
          setPlayingAudio(null);
          toast({
            title: "Audio Error",
            description: "Failed to play audio recording",
            variant: "destructive"
          });
        };
        
        setAudioElements(prev => ({ ...prev, [summaryId]: audio }));
      }

      await audio.play();
      setPlayingAudio(summaryId);
    } catch (error) {
      console.error('Error playing audio:', error);
      toast({
        title: "Audio Error",
        description: "Failed to play audio recording",
        variant: "destructive"
      });
    }
  };

  const getMoodBadge = (mood: string | null, moodScore: number | null) => {
    if (mood === 'positive' || (moodScore && moodScore >= 4)) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Positive</Badge>;
    } else if (mood === 'neutral' || (moodScore && moodScore >= 3)) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Neutral</Badge>;
    } else if (mood === 'concerning' || (moodScore && moodScore < 3)) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800">Concerning</Badge>;
    }
    return <Badge variant="outline">Unknown</Badge>;
  };

  const getStatusBadge = (outcome: string) => {
    switch (outcome) {
      case 'answered':
        return <Badge variant="default" className="bg-green-100 text-green-800">Answered</Badge>;
      case 'missed':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Missed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Failed</Badge>;
      case 'busy':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800">Busy</Badge>;
      default:
        return <Badge variant="outline">{outcome}</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
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
            <MessageCircle className="h-5 w-5" />
            <span>Call Summaries</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading summaries...</p>
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
            <MessageCircle className="h-5 w-5" />
            <span>Call Summaries</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Your household is not configured for in-app calls.
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
          <MessageCircle className="h-5 w-5" />
          <span>Recent Call Summaries</span>
        </CardTitle>
        <CardDescription>
          View summaries and recordings from recent in-app conversations
        </CardDescription>
      </CardHeader>
      <CardContent>
        {summaries.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No call summaries found.</p>
            <p className="text-sm text-muted-foreground mt-2">
              Summaries will appear here after in-app calls are completed.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {summaries.map((summary) => {
              const audioUrl = summary.key_points?.audio_url || summary.call_logs?.audio_recording_url;
              const audioBase64 = summary.key_points?.audio_base64;
              const hasAudio = !!(audioUrl || audioBase64);
              
              return (
                <div key={summary.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-lg">
                          {summary.call_logs?.relatives?.first_name} {summary.call_logs?.relatives?.last_name}
                        </h3>
                        {getStatusBadge(summary.call_logs?.call_outcome || 'unknown')}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(summary.call_logs?.timestamp || summary.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {new Date(summary.call_logs?.timestamp || summary.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        {summary.call_logs?.call_duration && (
                          <div className="flex items-center space-x-1">
                            <span>Duration: {formatDuration(summary.call_logs.call_duration)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <Heart className="h-4 w-4 text-muted-foreground" />
                        {getMoodBadge(summary.mood, summary.mood_score)}
                      </div>
                      {hasAudio && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleAudio(summary.id, audioUrl, audioBase64)}
                          className="flex items-center space-x-1"
                        >
                          {playingAudio === summary.id ? (
                            <>
                              <Pause className="h-4 w-4" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              <span>Play</span>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Call Summary */}
                  {summary.tl_dr && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <h4 className="text-sm font-medium mb-2">Summary</h4>
                      <p className="text-sm text-muted-foreground">{summary.tl_dr}</p>
                    </div>
                  )}

                  {/* Key Points */}
                  {summary.key_points?.highlight && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Key Highlights</h4>
                      <p className="text-sm">{summary.key_points.highlight}</p>
                    </div>
                  )}

                  {/* Criteria Evaluation */}
                  {summary.key_points?.criteria_evaluation?.total > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Quality Assessment</h4>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-green-600">
                          ✓ {summary.key_points.criteria_evaluation.score} passed
                        </span>
                        <span className="text-red-600">
                          ✗ {summary.key_points.criteria_evaluation.failed?.length || 0} failed
                        </span>
                        <span className="text-muted-foreground">
                          Rating: {summary.key_points.criteria_evaluation.quality_rating}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Additional Notes */}
                  {summary.key_points?.notes && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Notes</h4>
                      <p className="text-sm text-muted-foreground">{summary.key_points.notes}</p>
                    </div>
                  )}

                  {/* Detailed View Dialog */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        View Detailed Summary
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          Call Summary - {summary.call_logs?.relatives?.first_name} {summary.call_logs?.relatives?.last_name}
                        </DialogTitle>
                        <DialogDescription>
                          {new Date(summary.call_logs?.timestamp || summary.created_at).toLocaleString()}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {summary.key_points?.detailed_summary && (
                          <div>
                            <h4 className="font-medium mb-2">Detailed Summary</h4>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {summary.key_points.detailed_summary}
                            </p>
                          </div>
                        )}
                        
                        {summary.key_points?.data_collection && (
                          <div>
                            <h4 className="font-medium mb-2">Health & Wellness Data</h4>
                            <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                              {JSON.stringify(summary.key_points.data_collection, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {summary.transcript_url && (
                          <div>
                            <h4 className="font-medium mb-2">Transcript</h4>
                            <a 
                              href={summary.transcript_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-sm"
                            >
                              View Full Transcript
                            </a>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};