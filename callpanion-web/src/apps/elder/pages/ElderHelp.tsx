import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Phone, MessageCircle, Users, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ElderHelp = () => {
  const navigate = useNavigate();

  const helpOptions = [
    {
      id: '1',
      icon: Phone,
      title: 'Call Emergency',
      description: 'For immediate help or emergencies',
      action: () => window.location.href = 'tel:999',
      color: 'bg-red-100 hover:bg-red-200 text-red-800',
      urgent: true
    },
    {
      id: '2',
      icon: Users,
      title: 'Call Family',
      description: 'Talk to your family members',
      action: () => navigate('/call'),
      color: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
    },
    {
      id: '3',
      icon: MessageCircle,
      title: 'Send Message',
      description: 'Send a message to your family',
      action: () => {
        // In real app, this would open a simple message interface
        alert('This would open a simple message interface for elders');
      },
      color: 'bg-green-100 hover:bg-green-200 text-green-800'
    },
    {
      id: '4',
      icon: Settings,
      title: 'Technical Help',
      description: 'Get help with the device',
      action: () => {
        // In real app, this could start a support call or show simple instructions
        alert('This would provide technical support options');
      },
      color: 'bg-purple-100 hover:bg-purple-200 text-purple-800'
    }
  ];

  const commonQuestions = [
    {
      question: 'How do I make a call?',
      answer: 'Go to the home screen and press the "Make a Call" button. Choose who you want to call from your contacts.'
    },
    {
      question: 'How do I see my messages?',
      answer: 'Press the "Messages" button on the home screen to see photos and messages from your family.'
    },
    {
      question: 'What does the red button do?',
      answer: 'The red emergency button will call 999 for immediate help. Only use it in real emergencies.'
    },
    {
      question: 'How do I check my schedule?',
      answer: 'Press the "Today" button to see what you have planned for today, including appointments and reminders.'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="lg"
          onClick={() => navigate('/home')}
          className="text-xl p-4"
        >
          <ArrowLeft className="mr-2" size={24} />
          Back
        </Button>
      </div>

      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-foreground">
          Help & Support
        </h1>
        <p className="text-xl text-muted-foreground">
          How can we help you today?
        </p>
      </div>

      {/* Quick help options */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-center">Quick Help</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {helpOptions.map((option) => {
            const IconComponent = option.icon;
            return (
              <Card 
                key={option.id}
                className={`p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border-2 ${option.color} ${option.urgent ? 'ring-2 ring-red-400' : ''}`}
                onClick={option.action}
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-white bg-opacity-50 p-3 rounded-full">
                    <IconComponent size={32} className="text-current" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold">{option.title}</h3>
                    <p className="text-lg opacity-80">{option.description}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Common questions */}
      <div className="space-y-6 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-center">Common Questions</h2>
        {commonQuestions.map((faq, index) => (
          <Card key={index} className="p-6 border-2">
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-primary">{faq.question}</h3>
              <p className="text-lg leading-relaxed">{faq.answer}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Emergency contact info */}
      <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 max-w-3xl mx-auto">
        <div className="text-center space-y-4">
          <h3 className="text-2xl font-bold text-red-800">
            Emergency Information
          </h3>
          <div className="space-y-2 text-lg">
            <p><strong>Emergency Services:</strong> 999</p>
            <p><strong>NHS Non-Emergency:</strong> 111</p>
            <p><strong>Family Emergency Contact:</strong> Saved in your contacts</p>
          </div>
          <p className="text-sm text-red-600">
            If you're not sure if it's an emergency, it's always better to call for help.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ElderHelp;