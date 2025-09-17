import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ElderMessages = () => {
  const navigate = useNavigate();

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
          <h1 className="text-4xl font-bold text-foreground">Messages</h1>
        </div>

        <div className="text-center py-16">
          <div className="mb-8">
            <MessageCircle size={120} className="mx-auto text-muted-foreground/50" />
          </div>
          
          <h2 className="text-3xl font-bold text-foreground mb-4">
            No Messages Yet
          </h2>
          
          <p className="text-xl text-muted-foreground mb-8">
            Your messages from family and caregivers will appear here
          </p>

          <Card className="max-w-2xl mx-auto p-8 bg-muted/30">
            <p className="text-lg text-muted-foreground">
              When your family sends you messages, photos, or updates, 
              they will be displayed here in large, easy-to-read format.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ElderMessages;