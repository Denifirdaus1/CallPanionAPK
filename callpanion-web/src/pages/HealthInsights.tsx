import { useState } from "react";
import { TrendingUp, TrendingDown, Activity, Brain, AlertTriangle, Users, Calendar, FileText, Loader2, AlertCircle, Phone, MessageSquare } from "lucide-react";
import Navigation from "@/components/Navigation";
import WarmCard from "@/components/WarmCard";
import DementiaAssessment from "@/components/DementiaAssessment";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert } from "@/components/ui/alert";
import { useHealthInsightsData } from "@/hooks/useHealthInsightsData";
import { useHealthAccess } from "@/hooks/useHealthAccess";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

const HealthInsights = () => {
  const [showAssessment, setShowAssessment] = useState(false);
  const { canViewHealthInsights, loading: accessLoading } = useHealthAccess();
  const {
    loading: dataLoading,
    error,
    moodActivityData,
    healthMetrics,
    alerts,
    communicationData,
    callSummary,
    hasData
  } = useHealthInsightsData();

  const renderTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-love" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-destructive" />;
    return <div className="h-4 w-4" />;
  };

  const getAlertBadgeVariant = (severity: string) => {
    switch (severity) {
      case "high": return "destructive";
      case "medium": return "secondary";
      default: return "outline";
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "warning": return AlertTriangle;
      case "concern": return AlertCircle;
      case "positive": return Activity;
      default: return AlertTriangle;
    }
  };

  // Loading state
  if (accessLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading health insights...</span>
          </div>
        </div>
      </div>
    );
  }

  // Access denied state
  if (!canViewHealthInsights) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Alert className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <div>
              <h3 className="font-semibold">Access Restricted</h3>
              <p className="text-sm text-muted-foreground">
                You don't have permission to view health insights. Contact your family administrator for access.
              </p>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Alert className="max-w-md mx-auto">
            <AlertCircle className="h-4 w-4" />
            <div>
              <h3 className="font-semibold">Error Loading Data</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </Alert>
        </div>
      </div>
    );
  }

  if (showAssessment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Cognitive Assessment</h1>
              <p className="text-muted-foreground">NICE guidelines-based screening questionnaire</p>
            </div>
            <Button onClick={() => setShowAssessment(false)} variant="outline">
              Back to Dashboard
            </Button>
          </div>
          <DementiaAssessment onComplete={(results) => {
            console.log("Assessment completed:", results);
            // You could save results to local storage or send to a backend here
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Health & Wellbeing Insights</h1>
          <p className="text-muted-foreground">
            Monitor patterns and trends based on daily calls, check-ins, and family communications
          </p>
          {!hasData && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                <Phone className="h-4 w-4 inline mr-2" />
                No data available yet. Health insights are generated from daily calls, check-ins, and family messages.
              </p>
            </div>
          )}
        </div>

        {/* Alert Summary */}
        {alerts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {alerts.slice(0, 3).map((alert) => {
              const IconComponent = getAlertIcon(alert.type);
              return (
                <Card key={alert.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <IconComponent className="h-5 w-5 text-primary" />
                        <CardTitle className="text-sm font-medium">{alert.title}</CardTitle>
                      </div>
                      <Badge variant={getAlertBadgeVariant(alert.severity)}>
                        {alert.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{alert.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mood">Mood & Activity</TabsTrigger>
            <TabsTrigger value="health">Health Metrics</TabsTrigger>
            <TabsTrigger value="social">Social Connection</TabsTrigger>
            <TabsTrigger value="assessment">Cognitive Assessment</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {healthMetrics.map((metric) => (
                <WarmCard key={metric.name} className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-muted-foreground">{metric.name}</h3>
                    {renderTrendIcon(metric.trend)}
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold text-foreground">{metric.value}%</div>
                    <Progress value={metric.value} className="h-2" />
                  </div>
                </WarmCard>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-5 w-5 text-primary" />
                    <span>Weekly Mood & Activity Trends</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={moodActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="mood" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      name="Mood Score"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="activity" 
                      stroke="hsl(var(--love))" 
                      strokeWidth={2}
                      name="Activity Level"
                    />
                  </LineChart>
                </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Communication Breakdown</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={communicationData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {communicationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center space-x-4 mt-4">
                    {communicationData.map((entry, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-sm text-muted-foreground">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mood" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mood & Activity Correlation</CardTitle>
                <CardDescription>
                  Track how mood and activity levels relate to each other over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={moodActivityData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="mood" 
                      stackId="1"
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary) / 0.3)"
                      name="Mood Score"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="activity" 
                      stackId="2"
                      stroke="hsl(var(--love))" 
                      fill="hsl(var(--love) / 0.3)"
                      name="Activity Level"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="health" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Health Metrics Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={healthMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Health Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {healthMetrics.map((metric) => (
                    <div key={metric.name} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">{metric.name}</span>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm text-muted-foreground">{metric.value}%</span>
                          {renderTrendIcon(metric.trend)}
                        </div>
                      </div>
                      <Progress value={metric.value} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social Engagement Analysis</CardTitle>
                <CardDescription>
                  Monitor communication patterns and social connections
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-comfort/20 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{callSummary.totalCalls}</div>
                    <div className="text-sm text-muted-foreground">Total Calls This Week</div>
                  </div>
                  <div className="text-center p-4 bg-love/20 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">{callSummary.completedCalls}</div>
                    <div className="text-sm text-muted-foreground">Completed Calls</div>
                  </div>
                  <div className="text-center p-4 bg-peace/20 rounded-lg">
                    <div className="text-2xl font-bold text-foreground">
                      {callSummary.totalCalls > 0 ? Math.round((callSummary.completedCalls / callSummary.totalCalls) * 100) : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Success Rate</div>
                  </div>
                </div>
                
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={communicationData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="assessment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>NICE Guidelines Cognitive Assessment</span>
                </CardTitle>
                <CardDescription>
                  Structured questionnaire to help identify potential cognitive changes based on NICE dementia guidelines
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-comfort/10 p-4 rounded-lg border border-comfort/20">
                  <h3 className="font-semibold text-foreground mb-2">About This Assessment</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Based on NICE (National Institute for Health and Care Excellence) guidelines</li>
                    <li>• Designed to identify early signs of cognitive change</li>
                    <li>• Takes approximately 10-15 minutes to complete</li>
                    <li>• Results provide guidance on next steps and recommendations</li>
                    <li>• Not a diagnostic tool - always consult healthcare professionals</li>
                  </ul>
                </div>
                
                <div className="flex justify-center">
                  <Button 
                    onClick={() => setShowAssessment(true)}
                    className="px-8 py-3"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Start Cognitive Assessment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="mr-4">
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Check-in
          </Button>
          <Button>
            <Brain className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HealthInsights;