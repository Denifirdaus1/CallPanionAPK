import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, PhoneOff, Clock, User, Calendar, Play } from 'lucide-react';

const FamilyCalls = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  
  // Mock call history data
  const callHistory = [
    {
      id: '1',
      elderName: 'Margaret Thompson',
      type: 'outbound',
      status: 'completed',
      duration: '12:34',
      timestamp: '2024-01-15 14:30',
      summary: 'Daily check-in call. Margaret was in good spirits and mentioned enjoying her garden.',
      moodScore: 8.5
    },
    {
      id: '2',
      elderName: 'George Wilson',
      type: 'inbound',
      status: 'missed',
      duration: '0:00',
      timestamp: '2024-01-15 10:15',
      summary: 'Missed call attempt. Follow-up scheduled.',
      moodScore: null
    },
    {
      id: '3',
      elderName: 'Margaret Thompson',
      type: 'outbound',
      status: 'completed',
      duration: '8:42',
      timestamp: '2024-01-14 16:00',
      summary: 'Weekly medication review call. All medications taken correctly.',
      moodScore: 7.2
    },
    {
      id: '4',
      elderName: 'George Wilson',
      type: 'outbound',
      status: 'completed',
      duration: '15:20',
      timestamp: '2024-01-14 09:30',
      summary: 'Morning check-in call. George shared stories about his gardening.',
      moodScore: 9.1
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'missed':
        return 'bg-red-100 text-red-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string, status: string) => {
    if (status === 'missed') {
      return <PhoneOff className="h-4 w-4 text-red-500" />;
    }
    return <Phone className="h-4 w-4 text-green-500" />;
  };

  const getMoodColor = (score: number | null) => {
    if (!score) return 'text-gray-400';
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const stats = {
    totalCalls: callHistory.length,
    completedCalls: callHistory.filter(call => call.status === 'completed').length,
    averageDuration: '11:42',
    completionRate: 75
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Call History</h1>
          <p className="text-muted-foreground">
            Track call patterns and family interactions
          </p>
        </div>
        <div className="flex space-x-2">
          {['day', 'week', 'month'].map((period) => (
            <Button
              key={period}
              variant={selectedPeriod === period ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedPeriod(period)}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Call Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCalls}</div>
            <p className="text-xs text-muted-foreground">This {selectedPeriod}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completedCalls}</div>
            <p className="text-xs text-muted-foreground">{stats.completionRate}% success rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageDuration}</div>
            <p className="text-xs text-muted-foreground">Per call</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mood Score</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">8.2</div>
            <p className="text-xs text-muted-foreground">Average this {selectedPeriod}</p>
          </CardContent>
        </Card>
      </div>

      {/* Call History List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {callHistory.map((call) => (
              <div key={call.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                <div className="flex-shrink-0">
                  {getTypeIcon(call.type, call.status)}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{call.elderName}</span>
                      <Badge className={getStatusColor(call.status)}>
                        {call.status}
                      </Badge>
                      {call.type === 'inbound' && (
                        <Badge variant="outline">Incoming</Badge>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {call.duration}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {new Date(call.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{call.summary}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {call.moodScore && (
                        <>
                          <span className="text-sm">Mood:</span>
                          <span className={`text-sm font-medium ${getMoodColor(call.moodScore)}`}>
                            {call.moodScore.toFixed(1)}/10
                          </span>
                        </>
                      )}
                    </div>
                    
                    {call.status === 'completed' && (
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          <Play className="h-3 w-3 mr-1" />
                          Listen
                        </Button>
                        <Button variant="outline" size="sm">
                          Transcript
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {callHistory.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="space-y-4">
              <Phone className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">No calls yet</h3>
                <p className="text-muted-foreground">
                  Call history will appear here once family members start making calls
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FamilyCalls;