import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Heart, TrendingUp, AlertTriangle, MessageSquare, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ConversationInsight {
  id: string;
  session_id: string;
  relative_id: string;
  analysis_type: string;
  mood_score: number;
  wellbeing_indicators: {
    social_engagement: number;
    cognitive_clarity: number;
    physical_comfort: number;
  } | null;
  health_concerns: string[];
  key_topics: string[];
  alerts: string[];
  transcript_summary: string;
  created_at: string;
  relatives: {
    first_name: string;
    last_name: string;
  };
}

export const ConversationInsightsDashboard = () => {
  const [insights, setInsights] = useState<ConversationInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'all'>('week');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadConversationInsights();
    }
  }, [user, selectedTimeframe]);

  const loadConversationInsights = async () => {
    try {
      setIsLoading(true);

      // Get user's households first
      const { data: householdData, error: householdError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user?.id);

      if (householdError) throw householdError;

      const householdIds = householdData?.map(h => h.household_id) || [];

      if (householdIds.length === 0) {
        setInsights([]);
        return;
      }

      // Calculate date filter based on timeframe
      const now = new Date();
      let dateFilter = null;
      
      if (selectedTimeframe === 'week') {
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (selectedTimeframe === 'month') {
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      // Get relative IDs from households
      const { data: relatives, error: relativesError } = await supabase
        .from('relatives')
        .select('id')
        .in('household_id', householdIds);

      if (relativesError) throw relativesError;

      const relativeIds = relatives?.map(r => r.id) || [];
      
      if (relativeIds.length === 0) {
        setInsights([]);
        return;
      }

      // Get conversation insights
      let query = supabase
        .from('conversation_insights')
        .select(`
          *,
          relatives(first_name, last_name)
        `)
        .in('relative_id', relativeIds)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data, error } = await query.limit(50);

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData: ConversationInsight[] = (data || []).map(item => ({
        id: item.id,
        session_id: item.session_id,
        relative_id: item.relative_id,
        analysis_type: item.analysis_type,
        mood_score: item.mood_score,
        wellbeing_indicators: item.wellbeing_indicators as {
          social_engagement: number;
          cognitive_clarity: number;
          physical_comfort: number;
        } | null,
        health_concerns: item.health_concerns || [],
        key_topics: item.key_topics || [],
        alerts: item.alerts || [],
        transcript_summary: item.transcript_summary || '',
        created_at: item.created_at,
        relatives: item.relatives as { first_name: string; last_name: string }
      }));

      setInsights(transformedData);
    } catch (error) {
      console.error('Error loading conversation insights:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getInsightStats = () => {
    if (insights.length === 0) return { avgMood: 0, totalAlerts: 0, avgEngagement: 0 };

    const avgMood = insights.reduce((sum, insight) => sum + insight.mood_score, 0) / insights.length;
    const totalAlerts = insights.reduce((sum, insight) => sum + insight.alerts.length, 0);
    const avgEngagement = insights.reduce((sum, insight) => 
      sum + (insight.wellbeing_indicators?.social_engagement || 0), 0) / insights.length;

    return {
      avgMood: Math.round(avgMood * 10) / 10,
      totalAlerts,
      avgEngagement: Math.round(avgEngagement * 10) / 10
    };
  };

  const getMoodColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-50";
    if (score >= 6) return "text-yellow-600 bg-yellow-50";
    if (score >= 4) return "text-orange-600 bg-orange-50";
    return "text-red-600 bg-red-50";
  };

  const stats = getInsightStats();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Conversation Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-2">Loading conversation insights...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Average Mood</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.avgMood}/10</p>
              </div>
              <div className="h-8 w-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                <Heart className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Health Alerts</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.totalAlerts}</p>
              </div>
              <div className="h-8 w-8 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Engagement</p>
                <p className="text-2xl font-bold text-foreground mt-1">{stats.avgEngagement}/10</p>
              </div>
              <div className="h-8 w-8 bg-green-500/10 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>AI Conversation Analysis</span>
          </CardTitle>
          <CardDescription>
            AI-powered insights from conversations between your relatives and their AI companions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTimeframe} onValueChange={(value) => setSelectedTimeframe(value as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="week">Last Week</TabsTrigger>
              <TabsTrigger value="month">Last Month</TabsTrigger>
              <TabsTrigger value="all">All Time</TabsTrigger>
            </TabsList>
            
            <TabsContent value={selectedTimeframe} className="mt-6">
              <div className="space-y-4">
                {insights.map((insight) => (
                  <Card key={insight.id} className="border-l-4 border-l-primary">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold">
                              {insight.relatives.first_name} {insight.relatives.last_name}
                            </h3>
                            <Badge variant="outline">
                              {new Date(insight.created_at).toLocaleDateString()}
                            </Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {insight.transcript_summary}
                          </p>
                          
                          {/* Key Topics */}
                          {insight.key_topics.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {insight.key_topics.slice(0, 3).map((topic, index) => (
                                <Badge key={index} variant="secondary" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {/* Health Concerns */}
                          {insight.health_concerns.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-orange-600">Health Concerns:</p>
                              <div className="flex flex-wrap gap-1">
                                {insight.health_concerns.map((concern, index) => (
                                  <Badge key={index} variant="destructive" className="text-xs">
                                    {concern}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Alerts */}
                          {insight.alerts.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-red-600">Urgent Alerts:</p>
                              <div className="space-y-1">
                                {insight.alerts.map((alert, index) => (
                                  <div key={index} className="flex items-center space-x-1">
                                    <AlertTriangle className="h-3 w-3 text-red-500" />
                                    <span className="text-xs text-red-600">{alert}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="ml-4 space-y-2 text-right">
                          <div className={`px-2 py-1 rounded text-xs font-medium ${getMoodColor(insight.mood_score)}`}>
                            Mood: {insight.mood_score}/10
                          </div>
                          
                          {insight.wellbeing_indicators && (
                            <div className="space-y-1 text-xs text-muted-foreground">
                              <div>Social: {insight.wellbeing_indicators.social_engagement}/10</div>
                              <div>Cognitive: {insight.wellbeing_indicators.cognitive_clarity}/10</div>
                              <div>Physical: {insight.wellbeing_indicators.physical_comfort}/10</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {insights.length === 0 && (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-muted-foreground">No Conversation Insights</h3>
                    <p className="text-muted-foreground">
                      AI conversation analysis will appear here after your relatives have conversations with their AI companions.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};