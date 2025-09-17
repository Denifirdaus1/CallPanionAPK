import { useState, useEffect } from "react";
import { Plus, Send, Calendar, Clock, MessageSquare, Trash2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import RelativeNavigation from "@/components/RelativeNavigation";
import WarmCard from "@/components/WarmCard";
import { useToast } from "@/hooks/use-toast";
import { listPhotos, uploadPhoto as uploadPhotoRemote, removePhoto as removePhotoRemote, likePhotoRemote, addPhotoCommentRemote, type FamilyPhoto, subscribeToPhotoUpdates } from "@/lib/photoService";
import { sendMessage as sendMessageRemote, getMessages, deleteMessage as deleteMessageRemote, subscribeToMessages, type FamilyMessage } from "@/lib/messageService";
import { useUserHousehold } from "@/hooks/useUserHousehold";

const FamilyMessages = () => {
  const [newMessage, setNewMessage] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [photos, setPhotos] = useState<FamilyPhoto[]>([]);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoCaption, setNewPhotoCaption] = useState("");
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const { toast } = useToast();
  const { household, loading: householdLoading } = useUserHousehold();

  useEffect(() => {
    let unsub = () => {};
    const load = async () => {
      const list = await listPhotos();
      setPhotos(list);
    };
    load();
    try {
      unsub = subscribeToPhotoUpdates(load);
    } catch {}
    return () => unsub();
  }, []);

  useEffect(() => {
    // Load messages when component mounts
    const loadMessages = async () => {
      if (!household?.id || householdLoading) return;
      
      try {
        const messageList = await getMessages(household.id);
        setMessages(messageList);
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [household?.id, householdLoading]);

  useEffect(() => {
    if (!household?.id || householdLoading) return;
    
    // Subscribe to real-time message updates
    const unsubscribe = subscribeToMessages(household.id, setMessages);
    return unsubscribe;
  }, [household?.id, householdLoading]);

  const sendMessage = async (type: 'immediate' | 'scheduled') => {
    if (!newMessage.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message to send.",
        variant: "destructive"
      });
      return;
    }

    if (type === 'scheduled' && (!scheduledDate || !scheduledTime)) {
      toast({
        title: "Schedule Required", 
        description: "Please select both date and time for scheduled messages.",
        variant: "destructive"
      });
      return;
    }

    if (!household?.id) {
      toast({
        title: "No Household",
        description: "Please ensure you're part of a household to send messages.",
        variant: "destructive"
      });
      return;
    }

    try {
      const scheduledFor = type === 'immediate' ? undefined : `${scheduledDate} ${scheduledTime}`;
      
      await sendMessageRemote({
        content: newMessage,
        message_type: 'text',
        household_id: household.id,
        scheduled_for: scheduledFor
      });

      // Clear form
      setNewMessage("");
      setScheduledDate("");
      setScheduledTime("");

      toast({
        title: type === 'immediate' ? "Message Sent!" : "Message Scheduled!",
        description: type === 'immediate' 
          ? "Your message has been delivered to your loved one." 
          : "Your message will be sent at the scheduled time."
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Send Failed",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };

  const deleteMessage = async (id: string) => {
    try {
      await deleteMessageRemote(id);
      toast({
        title: "Message Deleted",
        description: "The message has been removed."
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Delete Failed",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };

  const uploadPhoto = async () => {
    if (!newPhotoUrl.trim() || !newPhotoCaption.trim()) {
      toast({
        title: "Photo Details Required",
        description: "Please provide both photo URL and caption.",
        variant: "destructive"
      });
      return;
    }

    try {
      const created = await uploadPhotoRemote({
        url: newPhotoUrl,
        caption: newPhotoCaption,
        uploadedBy: "Family Member",
        alt: newPhotoCaption
      });

      setPhotos(prev => [created, ...prev]);
      setNewPhotoUrl("");
      setNewPhotoCaption("");
      setShowPhotoUpload(false);

      toast({
        title: "Photo Added!",
        description: "Your photo has been shared with your loved one.",
      });
    } catch (e) {
      toast({ title: "Upload Failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const removePhoto = async (id: string) => {
    try {
      await removePhotoRemote(id);
      // Re-fetch to ensure consistency across backends
      const list = await listPhotos();
      setPhotos(list);
      toast({
        title: "Photo Removed",
        description: "The photo has been removed from the gallery.",
      });
    } catch (e) {
      toast({ title: "Remove Failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Badge className="bg-peace text-foreground">Delivered</Badge>;
      case 'sent':
        return <Badge className="bg-love text-foreground">Sent</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge className="bg-love text-foreground">Sent</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-comfort/20">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Send Love Messages</h1>
          <p className="text-muted-foreground">Stay connected with your loved one throughout their day</p>
        </div>

        {/* Message Composer */}
        <WarmCard className="mb-8" gradient="warmth">
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-semibold text-foreground">Compose Message</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="message" className="text-base font-medium">
                  Your Message
                </Label>
                <Textarea
                  id="message"
                  placeholder="Type your loving message here... Share encouragement, reminders, or just let them know you're thinking of them!"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="min-h-24 text-base resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date" className="text-base font-medium">
                    Schedule Date (Optional)
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="time" className="text-base font-medium">
                    Schedule Time (Optional)
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="text-base"
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <Button
                  onClick={() => sendMessage('immediate')}
                  className="flex-1 h-12 text-lg font-medium"
                >
                  <Send className="h-5 w-5 mr-2" />
                  Send Now
                </Button>
                <Button
                  onClick={() => sendMessage('scheduled')}
                  variant="outline"
                  className="flex-1 h-12 text-lg font-medium border-primary/30"
                  disabled={!scheduledDate || !scheduledTime}
                >
                  <Calendar className="h-5 w-5 mr-2" />
                  Schedule Message
                </Button>
              </div>
            </div>
          </div>
        </WarmCard>

        {/* Quick Message Templates */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Quick Message Templates</CardTitle>
            <CardDescription>Click to use these loving message templates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 max-w-full">
              {[
                "Good morning! Hope you have a wonderful day filled with joy and sunshine! ☀️",
                "Just wanted to remind you how much you mean to our family. You are so loved! ❤️", 
                "Don't forget to take your medication with lunch. Taking care of yourself is important! 💊",
                "Thinking of you today and sending you all my love and warm hugs! 🤗",
                "Remember to drink plenty of water and take breaks when you need them! 💧",
                "You have a doctor's appointment coming up. I'll call to remind you! 📞"
              ].map((template, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="text-left h-auto p-3 text-sm border-comfort/30 whitespace-normal break-words"
                  onClick={() => setNewMessage(template)}
                >
                  {template}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Family Photo Gallery */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Family Photo Gallery</CardTitle>
                <CardDescription>Share photos that will appear on your loved one's screen</CardDescription>
              </div>
              <Button
                onClick={() => setShowPhotoUpload(!showPhotoUpload)}
                className="flex items-center space-x-2"
              >
                <Camera className="h-4 w-4" />
                <span>Add Photo</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showPhotoUpload && (
              <div className="border border-border rounded-lg p-4 mb-6 bg-comfort/10">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="photo-url">Photo URL</Label>
                    <Input
                      id="photo-url"
                      placeholder="https://example.com/photo.jpg"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="photo-caption">Caption</Label>
                    <Input
                      id="photo-caption"
                      placeholder="A wonderful day with the family..."
                      value={newPhotoCaption}
                      onChange={(e) => setNewPhotoCaption(e.target.value)}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={uploadPhoto} className="flex-1">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Photo
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowPhotoUpload(false)}
                      className="flex-1"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative group">
                  <img
                    src={photo.url}
                    alt={photo.alt}
                    className="w-full h-48 object-cover rounded-lg shadow-gentle"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removePhoto(photo.id)}
                      className="opacity-90"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-3 rounded-b-lg">
                    <p className="text-sm font-medium">{photo.caption}</p>
                    <p className="text-xs opacity-75">
                      Added {new Date(photo.uploadedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Photo interactions */}
            <div className="mt-4 space-y-4">
              {photos.map((photo) => (
                <div key={photo.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => { await likePhotoRemote(photo.id); const list = await listPhotos(); setPhotos(list); }}
                      className="border-primary/30"
                    >
                      ❤️ {photo.likes ?? 0}
                    </Button>
                    <div className="flex-1 ml-3 flex items-center gap-2">
                      <Input
                        placeholder="Add a comment"
                        value={commentInputs[photo.id] ?? ''}
                        onChange={(e) => setCommentInputs({ ...commentInputs, [photo.id]: e.target.value })}
                      />
                      <Button
                        size="sm"
                        onClick={async () => {
                          const text = commentInputs[photo.id];
                          if (text && text.trim()) {
                            await addPhotoCommentRemote(photo.id, { author: 'Family', text });
                            setCommentInputs({ ...commentInputs, [photo.id]: '' });
                            const list = await listPhotos();
                            setPhotos(list);
                          }
                        }}
                      >
                        Post
                      </Button>
                    </div>
                  </div>
                  {(photo.comments ?? []).slice(-2).map((c) => (
                    <p key={c.id} className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">{c.author}:</span> {c.text}
                    </p>
                  ))}
                </div>
              ))}
            </div>
            
            {photos.length === 0 && (
              <Alert>
                <Camera className="h-4 w-4" />
                <AlertDescription>
                  No photos yet. Add your first family photo above!
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Message History */}
        <Card>
          <CardHeader>
            <CardTitle>Message History</CardTitle>
            <CardDescription>Recent messages sent to your loved one</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="border border-border rounded-lg p-4 space-y-3 hover:shadow-gentle transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-foreground flex-1 mr-4">{message.content}</p>
                    <Button
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteMessage(message.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <span className="text-muted-foreground flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {message.scheduled_for || 'Immediate'}
                      </span>
                      {getStatusBadge(message.status || 'sent')}
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(message.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {messages.length === 0 && (
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                  No messages yet. Send your first loving message above!
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FamilyMessages;