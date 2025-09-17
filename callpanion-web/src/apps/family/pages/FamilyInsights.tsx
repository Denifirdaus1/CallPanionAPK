import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Heart, Phone, Calendar, TrendingUp, TrendingDown } from 'lucide-react';

const FamilyInsights = () => {
  // Mock data - in real app this would come from health data analysis
  const insights = {
    overallHealth: {
      score: 82,
      trend: 'improving',
      change: '+5% from last month'
    },
    callPatterns: {
      dailyAverage: 2.4,
      completionRate: 87,
      missedCalls: 3
    },
    wellbeingTrends: [
      {
        metric: 'Mood Score',
        current: 7.8,
        previous: 7.2,
        trend: 'up'
      },
      {
        metric: 'Energy Level',
        current: 6.9,
        previous: 7.4,
        trend: 'down'
      },
      {
        metric: 'Social Interaction',
        current: 8.1,
        previous: 8.0,
        trend: 'up'
      }
    ],
    alerts: [
      {
        id: '1',
        severity: 'medium',
        message: 'Margaret has missed 2 medication reminders this week',
        timestamp: '2 hours ago'
      },
      {
        id: '2',
        severity: 'low',
        message: 'George\'s call duration has decreased by 20% this week',
        timestamp: '1 day ago'
      }
    ]
  };

  const getTrendIcon = (trend: string) => {
    return trend === 'up' ? 
      <TrendingUp className="h-4 w-4 text-green-600" /> : 
      <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-orange-100 text-orange-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Health & Wellbeing Insights</h1>
        <p className="text-muted-foreground">
          AI-powered analysis of your family's wellbeing patterns
        </p>
      </div>

      {/* Overall Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Overall Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="text-4xl font-bold text-green-600">
              {insights.overallHealth.score}%
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  {insights.overallHealth.change}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Trending {insights.overallHealth.trend}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Call Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-500" />
              Call Patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{insights.callPatterns.dailyAverage}</div>
                <p className="text-sm text-muted-foreground">Daily Average</p>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {insights.callPatterns.completionRate}%
                </div>
                <p className="text-sm text-muted-foreground">Completion Rate</p>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-sm">
                <span className="font-medium">{insights.callPatterns.missedCalls}</span> missed calls this week
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Wellbeing Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              Wellbeing Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.wellbeingTrends.map((trend, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium">{trend.metric}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{trend.current}/10</span>
                  {getTrendIcon(trend.trend)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-orange-500" />
            Recent Alerts & Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {insights.alerts.map((alert) => (
              <div key={alert.id} className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50">
                <Badge className={getSeverityColor(alert.severity)}>
                  {alert.severity}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">{alert.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-800">AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-green-700">
            <p>• Consider setting up additional medication reminders for Margaret during busy periods</p>
            <p>• George may benefit from shorter, more frequent calls to maintain engagement</p>
            <p>• Both family members show positive response to morning check-ins - consider making this routine</p>
            <p>• Social interaction scores improve after family video calls - schedule weekly sessions</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FamilyInsights;