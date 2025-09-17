import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, MessageCircle, Calendar, HelpCircle, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ElderHome = () => {
  const navigate = useNavigate();

  const tiles = [
    {
      icon: Phone,
      label: 'Make a Call',
      description: 'Call your family or friends',
      path: '/call',
      color: 'bg-green-100 hover:bg-green-200 text-green-800'
    },
    {
      icon: MessageCircle,
      label: 'Messages',
      description: 'See photos and messages from family',
      path: '/messages',
      color: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
    },
    {
      icon: Calendar,
      label: 'Today',
      description: 'See what\'s happening today',
      path: '/today',
      color: 'bg-purple-100 hover:bg-purple-200 text-purple-800'
    },
    {
      icon: Heart,
      label: 'Check In',
      description: 'Let family know how you\'re feeling',
      path: '/checkin',
      color: 'bg-red-100 hover:bg-red-200 text-red-800'
    },
    {
      icon: HelpCircle,
      label: 'Help',
      description: 'Get help or support',
      path: '/help',
      color: 'bg-orange-100 hover:bg-orange-200 text-orange-800'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome message */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          Welcome Home
        </h1>
        <p className="text-xl text-muted-foreground">
          What would you like to do today?
        </p>
      </div>

      {/* Kiosk tiles - max 5, extra large */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {tiles.map((tile, index) => {
          const IconComponent = tile.icon;
          return (
            <Card 
              key={index}
              className={`p-8 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border-2 ${tile.color}`}
              onClick={() => navigate(tile.path)}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <IconComponent size={64} className="text-current" />
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">{tile.label}</h3>
                  <p className="text-lg opacity-80">{tile.description}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Large emergency button */}
      <div className="text-center pt-8">
        <Button 
          size="lg" 
          variant="destructive"
          className="text-2xl py-6 px-12 h-auto"
          onClick={() => {
            // Emergency call functionality
            window.location.href = 'tel:999';
          }}
        >
          <Phone className="mr-4" size={32} />
          Emergency Call 999
        </Button>
      </div>
    </div>
  );
};

export default ElderHome;