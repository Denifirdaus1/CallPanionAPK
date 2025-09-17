import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Phone, Users, AlertTriangle, Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ElderHelpPage = () => {
  const navigate = useNavigate();

  const emergencyContacts = [
    { name: 'Emergency Services', number: '999', icon: AlertTriangle, urgent: true },
    { name: 'NHS 111', number: '111', icon: Heart, urgent: false },
    { name: 'Family Contact', number: 'Contact Family', icon: Users, urgent: false },
  ];

  const handleCall = (number: string) => {
    if (number === 'Contact Family') {
      // In a real app, this would show family contacts or send an alert
      alert('This would contact your designated family member');
    } else {
      window.location.href = `tel:${number}`;
    }
  };

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
          <h1 className="text-4xl font-bold text-foreground">Help & Support</h1>
        </div>

        <div className="space-y-8">
          {/* Emergency Banner */}
          <Card className="p-6 bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800">
            <div className="flex items-center gap-4 text-center">
              <AlertTriangle size={48} className="text-red-600" />
              <div>
                <h2 className="text-2xl font-bold text-red-800 dark:text-red-400">
                  In Case of Emergency
                </h2>
                <p className="text-lg text-red-700 dark:text-red-300">
                  Call 999 immediately for police, fire, or ambulance
                </p>
              </div>
            </div>
          </Card>

          {/* Emergency Contacts */}
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Emergency Contacts
            </h2>
            
            {emergencyContacts.map((contact) => {
              const IconComponent = contact.icon;
              return (
                <Card 
                  key={contact.name}
                  className={`p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${
                    contact.urgent 
                      ? 'bg-red-50 border-red-200 hover:border-red-300 dark:bg-red-950/20 dark:border-red-800' 
                      : 'hover:border-primary/30'
                  }`}
                  onClick={() => handleCall(contact.number)}
                >
                  <div className="flex items-center gap-6">
                    <div className={`p-4 rounded-full ${
                      contact.urgent 
                        ? 'bg-red-600' 
                        : contact.name.includes('NHS') 
                          ? 'bg-blue-600' 
                          : 'bg-green-600'
                    }`}>
                      <IconComponent size={32} className="text-white" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-foreground">
                        {contact.name}
                      </h3>
                      <p className="text-xl text-muted-foreground">
                        {contact.number}
                      </p>
                    </div>
                    
                    <Phone size={32} className="text-muted-foreground" />
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Quick Help Actions */}
          <Card className="p-8">
            <h2 className="text-3xl font-bold text-foreground mb-6 text-center">
              Other Ways to Get Help
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Button 
                size="lg"
                className="text-xl py-8 h-auto bg-blue-600 hover:bg-blue-700"
                onClick={() => navigate('/elder/voice')}
              >
                <Phone className="mr-3" size={24} />
                Talk to AI Assistant
              </Button>
              
              <Button 
                size="lg"
                variant="outline"
                className="text-xl py-8 h-auto"
                onClick={() => navigate('/elder/messages')}
              >
                <Users className="mr-3" size={24} />
                Check Messages
              </Button>
            </div>
          </Card>

          {/* Information Card */}
          <Card className="p-8 bg-muted/30">
            <h3 className="text-2xl font-bold text-foreground mb-4">
              Remember
            </h3>
            <div className="space-y-3 text-lg text-muted-foreground">
              <p>• Your family is always available to help you</p>
              <p>• Use the voice assistant for everyday questions</p>
              <p>• Don't hesitate to call if you need assistance</p>
              <p>• Emergency services are available 24/7</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ElderHelpPage;