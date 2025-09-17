import { Play, User, Clock, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import WarmCard from "@/components/WarmCard";
import Navigation from "@/components/Navigation";

const Messages = () => {
  const todaysMessages = [
    {
      id: 1,
      sender: "Sarah",
      message: "Good morning, Mum! Just wanted you to know I'm thinking of you while I have my coffee. Hope you're having a lovely start to your day!",
      time: "9:00 AM",
      type: "voice",
      duration: "32 seconds"
    },
    {
      id: 2,
      sender: "Little Emma",
      message: "Hi Grandma! I drew you a picture of us together. Mummy says you'll love it!",
      time: "2:30 PM",
      type: "video",
      duration: "1 minute"
    },
    {
      id: 3,
      sender: "David",
      message: "Thinking of you, Mum. Can't wait to see you this Sunday for our usual chat over tea.",
      time: "6:15 PM",
      type: "voice",
      duration: "28 seconds"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-warmth">
      <Navigation />
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">You Are Loved</h1>
          <p className="text-xl text-muted-foreground">Daily messages from your family</p>
        </div>

        <div className="space-y-6">
          {todaysMessages.map((message) => (
            <WarmCard key={message.id} className="relative overflow-hidden">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-love rounded-full flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-foreground">{message.sender}</h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {message.time}
                    </div>
                  </div>
                  
                  <p className="text-foreground mb-4 leading-relaxed">{message.message}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Button 
                        size="lg" 
                        className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-gentle"
                      >
                        <Play className="h-5 w-5 mr-2" />
                        Play {message.type}
                      </Button>
                      <span className="text-sm text-muted-foreground">{message.duration}</span>
                    </div>
                    
                    <Button variant="outline" size="sm" className="border-primary/20">
                      <Volume2 className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                  </div>
                </div>
              </div>
            </WarmCard>
          ))}
        </div>

        <WarmCard className="mt-8 text-center" gradient="peace">
          <h3 className="text-xl font-semibold text-foreground mb-2">Tomorrow's Love</h3>
          <p className="text-muted-foreground mb-4">You have 2 more messages scheduled for tomorrow</p>
          <Button variant="outline" className="border-primary/20">
            Preview Tomorrow
          </Button>
        </WarmCard>
      </div>
    </div>
  );
};

export default Messages;