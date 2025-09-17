import { useState } from 'react';
import { Calendar, Clock, Plus, Trash2, Edit, Video, Coffee, Music, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useFamilyEvents, type FamilyEvent } from '@/hooks/useFamilyEvents';
import WarmCard from './WarmCard';

const getEventIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('call') || lowerTitle.includes('video')) return Video;
  if (lowerTitle.includes('dinner') || lowerTitle.includes('meal') || lowerTitle.includes('lunch')) return Coffee;
  if (lowerTitle.includes('music') || lowerTitle.includes('recital') || lowerTitle.includes('piano')) return Music;
  if (lowerTitle.includes('birthday') || lowerTitle.includes('party') || lowerTitle.includes('celebration')) return Gift;
  return Calendar;
};

const FamilyEventPlanner = () => {
  const { events, loading, createEvent, updateEvent, deleteEvent } = useFamilyEvents();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    starts_at: '',
    ends_at: ''
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      starts_at: '',
      ends_at: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.starts_at) {
      toast({
        title: "Missing Information",
        description: "Please provide at least a title and start time.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, formData);
        toast({
          title: "Event Updated",
          description: "The event has been successfully updated."
        });
        setEditingEvent(null);
      } else {
        await createEvent(formData);
        toast({
          title: "Event Created",
          description: "The event has been added to your family calendar."
        });
        setIsCreateDialogOpen(false);
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save event",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await deleteEvent(eventId);
      toast({
        title: "Event Deleted",
        description: "The event has been removed from your calendar."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (event: FamilyEvent) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      starts_at: event.starts_at.slice(0, 16), // Format for datetime-local input
      ends_at: event.ends_at?.slice(0, 16) || ''
    });
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-peace">
        <div className="max-w-4xl mx-auto p-6">
          <div className="text-center">Loading events...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-peace">
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Family Event Planner</h1>
          <p className="text-xl text-muted-foreground">Create beautiful moments for your loved ones</p>
        </div>

        {/* Create Event Button */}
        <div className="mb-8">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-16 text-lg">
                <Plus className="h-6 w-6 mr-3" />
                Create New Event
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
                <DialogDescription>
                  Plan a special moment for your family
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Video call with grandma"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Catch up over afternoon tea"
                  />
                </div>
                <div>
                  <Label htmlFor="starts_at">Start Date & Time</Label>
                  <Input
                    id="starts_at"
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="ends_at">End Date & Time (Optional)</Label>
                  <Input
                    id="ends_at"
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, ends_at: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">Create Event</Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsCreateDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Events List */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground text-center mb-6">Upcoming Events</h2>
          
          {events.length === 0 ? (
            <WarmCard className="text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No Events Yet</h3>
              <p className="text-muted-foreground">
                Create your first event to start planning beautiful moments with your family
              </p>
            </WarmCard>
          ) : (
            events.map((event) => {
              const Icon = getEventIcon(event.title);
              
              return (
                <WarmCard key={event.id} hover={false}>
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-love rounded-full flex items-center justify-center">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-semibold text-foreground">{event.title}</h3>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(event)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm font-medium text-primary mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatEventDate(event.starts_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatEventTime(event.starts_at)}
                        </div>
                      </div>
                      
                      {event.description && (
                        <p className="text-foreground leading-relaxed">{event.description}</p>
                      )}
                    </div>
                  </div>
                </WarmCard>
              );
            })
          )}
        </div>

        {/* Edit Event Dialog */}
        {editingEvent && (
          <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Event</DialogTitle>
                <DialogDescription>
                  Update your event details
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="edit-title">Event Title</Label>
                  <Input
                    id="edit-title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-starts_at">Start Date & Time</Label>
                  <Input
                    id="edit-starts_at"
                    type="datetime-local"
                    value={formData.starts_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, starts_at: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-ends_at">End Date & Time (Optional)</Label>
                  <Input
                    id="edit-ends_at"
                    type="datetime-local"
                    value={formData.ends_at}
                    onChange={(e) => setFormData(prev => ({ ...prev, ends_at: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">Update Event</Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setEditingEvent(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default FamilyEventPlanner;