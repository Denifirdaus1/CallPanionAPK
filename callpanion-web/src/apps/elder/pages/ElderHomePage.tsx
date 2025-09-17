import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, MessageCircle, Calendar, HelpCircle, Fullscreen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

const ElderHomePage = () => {
  const navigate = useNavigate();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    const isInstalled = isStandalone || isInWebAppiOS;

    // Show install prompt if not installed and on mobile
    if (!isInstalled && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      setShowInstallPrompt(true);
    }

    // Request fullscreen on tablets
    if (!isInstalled && (window.innerWidth >= 768 && window.innerWidth <= 1024)) {
      const requestFullscreen = () => {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      };
      
      // Delay to avoid blocking popup
      setTimeout(requestFullscreen, 1000);
    }
  }, []);

  const handleInstallPrompt = () => {
    // For iOS Safari
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
      alert('To install this app on your iOS device, tap the Share button and then "Add to Home Screen"');
    } else {
      // For Android Chrome
      alert('To install this app, tap the menu (⋮) and select "Add to Home screen" or "Install app"');
    }
    setShowInstallPrompt(false);
  };

  const tiles = [
    {
      id: 'voice',
      title: 'Start Voice',
      description: 'Talk with your AI assistant',
      icon: Phone,
      color: 'bg-green-600 hover:bg-green-700',
      path: '/elder/voice'
    },
    {
      id: 'messages',
      title: 'Messages',
      description: 'View your messages',
      icon: MessageCircle,
      color: 'bg-blue-600 hover:bg-blue-700',
      path: '/elder/messages'
    },
    {
      id: 'today',
      title: 'Today',
      description: 'See today\'s activities',
      icon: Calendar,
      color: 'bg-purple-600 hover:bg-purple-700',
      path: '/elder/today'
    },
    {
      id: 'help',
      title: 'Help',
      description: 'Get help and support',
      icon: HelpCircle,
      color: 'bg-orange-600 hover:bg-orange-700',
      path: '/elder/help'
    }
  ];

  return (
    <div className="min-h-screen bg-background p-8">
      {showInstallPrompt && (
        <Card className="mb-8 p-6 bg-primary/10 border-primary/20">
          <div className="flex items-center gap-4">
            <Fullscreen className="text-primary" size={32} />
            <div className="flex-1">
              <h3 className="text-lg font-semibold">Install App for Best Experience</h3>
              <p className="text-muted-foreground">Add this app to your home screen for fullscreen use</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowInstallPrompt(false)}>
                Later
              </Button>
              <Button onClick={handleInstallPrompt}>
                Install
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-foreground mb-4">
            Good afternoon
          </h1>
          <p className="text-2xl text-muted-foreground">
            Your next reminder is at 3:00 PM
          </p>
          <p className="text-lg text-red-600 mt-4 font-medium">
            In an emergency call 999
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {tiles.map((tile) => {
            const IconComponent = tile.icon;
            return (
              <Card 
                key={tile.id}
                className="group cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-xl border-2 hover:border-primary/30 elderly-touch-target"
                onClick={() => navigate(tile.path)}
              >
                <div className="p-12 text-center">
                  <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full ${tile.color} mb-6 group-hover:scale-110 transition-transform duration-200`}>
                    <IconComponent size={64} className="text-white" />
                  </div>
                  
                  <h2 className="text-3xl font-bold text-foreground mb-3">
                    {tile.title}
                  </h2>
                  
                  <p className="text-xl text-muted-foreground">
                    {tile.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-lg text-muted-foreground">
            Touch any button above to get started
          </p>
        </div>
      </div>
    </div>
  );
};

export default ElderHomePage;