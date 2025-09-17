import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Phone, PhoneOff, ArrowLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const ElderCall = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isInCall, setIsInCall] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [savedContacts, setSavedContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [relativeId, setRelativeId] = useState<string | null>(null);

  // Load saved contacts and relative ID
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      try {
        // Get the current relative (elder) from household members
        const { data: memberData } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('user_id', user.id)
          .single();

        if (memberData) {
          // Get relative info from relatives table
          const { data: relativeData } = await supabase
            .from('relatives')
            .select('id')
            .eq('household_id', memberData.household_id)
            .single();

          if (relativeData) {
            setRelativeId(relativeData.id);
          }
        }

        // In production, load actual family contacts
        // For now, showing empty state until contacts are added
        setSavedContacts([]);
      } catch (error) {
        console.error('Error loading contacts:', error);
        toast({
          title: "Error",
          description: "Failed to load contacts",
          variant: "destructive"
        });
      }
    };

    loadData();
  }, [user]);

  const startCall = async (contact: { id: string; name: string; phone: string }) => {
    if (!relativeId) {
      toast({
        title: "Error",
        description: "Relative information not found",
        variant: "destructive"
      });
      return;
    }

    setSelectedContact(contact);
    setIsConnecting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-call', {
        body: {
          action: 'start_call',
          contactId: contact.id,
          relativeId: relativeId
        }
      });

      if (error) throw error;

      if (data.success) {
        setConversationId(data.conversation_id);
        setIsInCall(true);
        setIsConnecting(false);
        
        toast({
          title: "Calling",
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Failed to start call');
      }
    } catch (error) {
      console.error('Error starting call:', error);
      setIsConnecting(false);
      toast({
        title: "Call Failed",
        description: error instanceof Error ? error.message : 'Failed to start call',
        variant: "destructive"
      });
    }
  };

  const endCall = async () => {
    if (!conversationId) {
      setIsInCall(false);
      setSelectedContact(null);
      return;
    }

    try {
      await supabase.functions.invoke('elevenlabs-call', {
        body: {
          action: 'end_call',
          conversationId: conversationId
        }
      });

      toast({
        title: "Call Ended",
        description: "Call ended successfully",
      });
    } catch (error) {
      console.error('Error ending call:', error);
    } finally {
      setIsInCall(false);
      setSelectedContact(null);
      setConversationId(null);
    }
  };

  if (isConnecting) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-foreground">
            Connecting to {selectedContact?.name}
          </h1>
          
          <div className="flex justify-center">
            <Loader2 size={120} className="animate-spin text-primary" />
          </div>

          <p className="text-2xl text-muted-foreground">
            Please wait while we connect your call...
          </p>
        </div>

        <div className="text-center pt-8">
          <Button 
            size="lg" 
            variant="outline"
            className="text-2xl py-8 px-16 h-auto rounded-full"
            onClick={() => {
              setIsConnecting(false);
              setSelectedContact(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (isInCall) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-foreground">
            Talking with {selectedContact?.name}
          </h1>
          
          <div className="animate-pulse">
            <Phone size={120} className="mx-auto text-green-600" />
          </div>

          <p className="text-2xl text-muted-foreground">
            Call in progress...
          </p>
        </div>

        <div className="text-center pt-8">
          <Button 
            size="lg" 
            variant="destructive"
            className="text-2xl py-8 px-16 h-auto rounded-full"
            onClick={endCall}
          >
            <PhoneOff className="mr-4" size={32} />
            End Call
          </Button>
        </div>
      </div>
    );
  }

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
          Who would you like to call?
        </h1>
        <p className="text-xl text-muted-foreground">
          Choose from your saved contacts
        </p>
      </div>

      <div className="max-w-4xl mx-auto">
        {savedContacts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {savedContacts.map((contact) => (
              <Card 
                key={contact.id}
                className="p-6 cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg border-2 hover:border-green-300"
                onClick={() => startCall(contact)}
              >
                <div className="flex items-center space-x-6">
                  <div className="bg-green-100 p-4 rounded-full">
                    <Phone size={32} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold">{contact.name}</h3>
                    <p className="text-lg text-muted-foreground">{contact.phone}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <div className="space-y-4">
              <div className="bg-blue-100 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                <Phone size={32} className="text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold">No contacts available</h3>
              <p className="text-muted-foreground">
                Your family will need to add contacts for you before you can make calls.
              </p>
              <p className="text-sm text-muted-foreground">
                Ask a family member to add contacts through their CallPanion app.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ElderCall;