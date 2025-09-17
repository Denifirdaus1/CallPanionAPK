import { Calendar, Video, Coffee, Music, Gift } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFamilyEvents } from '@/hooks/useFamilyEvents';
import WarmCard from './WarmCard';

const getEventIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('call') || lowerTitle.includes('video')) return Video;
  if (lowerTitle.includes('dinner') || lowerTitle.includes('meal') || lowerTitle.includes('lunch')) return Coffee;
  if (lowerTitle.includes('music') || lowerTitle.includes('recital') || lowerTitle.includes('piano')) return Music;
  if (lowerTitle.includes('birthday') || lowerTitle.includes('party') || lowerTitle.includes('celebration')) return Gift;
  return Calendar;
};

const getEventColor = (title: string) => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('call') || lowerTitle.includes('video')) return 'text-blue-600';
  if (lowerTitle.includes('dinner') || lowerTitle.includes('meal') || lowerTitle.includes('lunch')) return 'text-orange-600';
  if (lowerTitle.includes('music') || lowerTitle.includes('recital') || lowerTitle.includes('piano')) return 'text-pink-600';
  if (lowerTitle.includes('birthday') || lowerTitle.includes('party') || lowerTitle.includes('celebration')) return 'text-purple-600';
  return 'text-primary';
};

const ElderUpcomingEvents = () => {
  const { events, loading } = useFamilyEvents();

  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const eventDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (eventDate.getTime() === today.getTime()) return 'Today';
    if (eventDate.getTime() === tomorrow.getTime()) return 'Tomorrow';
    
    const diffDays = Math.floor((eventDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays > 0 && diffDays <= 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatEventTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Filter to upcoming events only (next 7 days)
  const upcomingEvents = events
    .filter(event => {
      const eventDate = new Date(event.starts_at);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return eventDate >= now && eventDate <= weekFromNow;
    })
    .slice(0, 4); // Limit to 4 events

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading your upcoming events...</div>
        </CardContent>
      </Card>
    );
  }

  if (upcomingEvents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Events
          </CardTitle>
          <CardDescription>
            Your family is planning special moments for you
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              No upcoming events in the next week. Your family may be planning something special!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Joyful Moments Ahead
        </CardTitle>
        <CardDescription>
          Beautiful connections waiting for you
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingEvents.map((event) => {
          const Icon = getEventIcon(event.title);
          const iconColor = getEventColor(event.title);
          
          return (
            <div key={event.id} className="flex items-center space-x-4 p-3 rounded-lg bg-muted/30">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-love rounded-full flex items-center justify-center">
                  <Icon className={`h-6 w-6 ${iconColor}`} />
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-semibold text-foreground">{event.title}</h4>
                  <div className="text-right">
                    <div className="text-sm font-medium text-primary">{formatEventDate(event.starts_at)}</div>
                    <div className="text-xs text-muted-foreground">{formatEventTime(event.starts_at)}</div>
                  </div>
                </div>
                
                {event.description && (
                  <p className="text-sm text-foreground/80 leading-relaxed">{event.description}</p>
                )}
              </div>
            </div>
          );
        })}
        
        {upcomingEvents.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 rounded-lg text-center">
            <p className="text-sm text-primary font-medium">
              You have {upcomingEvents.length} beautiful moment{upcomingEvents.length !== 1 ? 's' : ''} planned this week
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ElderUpcomingEvents;