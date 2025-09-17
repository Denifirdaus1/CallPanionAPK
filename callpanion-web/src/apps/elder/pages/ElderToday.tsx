import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Calendar, Clock, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ElderToday = () => {
  const navigate = useNavigate();
  const today = new Date();
  const dayName = today.toLocaleDateString('en-GB', { weekday: 'long' });
  const date = today.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
  const time = today.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Button 
            variant="ghost" 
            size="lg"
            onClick={() => navigate('/elder/home')}
            className="text-xl p-4 mr-4"
          >
            <ArrowLeft className="mr-2" size={24} />
            Back
          </Button>
          <h1 className="text-4xl font-bold text-foreground">Today</h1>
        </div>

        <div className="space-y-8">
          {/* Current Time */}
          <Card className="p-8 text-center bg-primary/5 border-primary/20">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Clock size={48} className="text-primary" />
              <div>
                <div className="text-5xl font-bold text-foreground">
                  {time}
                </div>
                <div className="text-2xl text-primary font-semibold">
                  {dayName}
                </div>
                <div className="text-xl text-muted-foreground">
                  {date}
                </div>
              </div>
            </div>
          </Card>

          {/* Weather */}
          <Card className="p-8">
            <div className="flex items-center gap-4 mb-4">
              <Sun size={40} className="text-yellow-500" />
              <h2 className="text-3xl font-bold text-foreground">Weather</h2>
            </div>
            <div className="text-center py-8">
              <div className="text-6xl font-bold text-foreground mb-2">
                18°C
              </div>
              <div className="text-2xl text-muted-foreground">
                Partly Cloudy
              </div>
              <div className="text-lg text-muted-foreground mt-2">
                A pleasant day with some clouds
              </div>
            </div>
          </Card>

          {/* Activities */}
          <Card className="p-8">
            <div className="flex items-center gap-4 mb-6">
              <Calendar size={40} className="text-blue-600" />
              <h2 className="text-3xl font-bold text-foreground">Today's Activities</h2>
            </div>
            
            <div className="text-center py-8">
              <Calendar size={80} className="mx-auto text-muted-foreground/50 mb-6" />
              <p className="text-xl text-muted-foreground">
                No activities scheduled for today
              </p>
              <p className="text-lg text-muted-foreground mt-4">
                Enjoy a relaxing day! Your family can schedule activities for you.
              </p>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-8 bg-muted/30">
            <h3 className="text-2xl font-bold text-foreground mb-6 text-center">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                size="lg"
                className="text-xl py-6 h-auto"
                onClick={() => navigate('/elder/voice')}
              >
                Start Voice Call
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="text-xl py-6 h-auto"
                onClick={() => navigate('/elder/help')}
              >
                Get Help
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ElderToday;