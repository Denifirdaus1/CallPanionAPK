import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, User, Calendar } from 'lucide-react';

const FamilyCareNotes = () => {
  const [notes] = useState([
    {
      id: '1',
      elderName: 'Margaret Thompson',
      author: 'Sarah Wilson',
      content: 'Margaret seems to be responding well to the new medication. She mentioned feeling more energetic during our call today. Will monitor for any side effects.',
      category: 'medication',
      timestamp: '2024-01-15 14:30',
      priority: 'normal'
    },
    {
      id: '2',
      elderName: 'George Wilson',
      author: 'Dr. Johnson',
      content: 'Patient missed his afternoon medication reminder. Recommend setting up additional reminders or consider automatic dispensing system.',
      category: 'health',
      timestamp: '2024-01-15 10:15',
      priority: 'high'
    },
    {
      id: '3',
      elderName: 'Margaret Thompson',
      author: 'Care Worker - Lisa',
      content: 'Weekly visit completed. House is clean and tidy. Margaret prepared her own lunch successfully. Social interaction was positive.',
      category: 'visit',
      timestamp: '2024-01-14 16:00',
      priority: 'normal'
    },
    {
      id: '4',
      elderName: 'George Wilson',
      author: 'John Wilson',
      content: 'Called Dad this morning. He sounded a bit confused about today\'s date but otherwise in good spirits. Reminder: discuss with doctor at next appointment.',
      category: 'call',
      timestamp: '2024-01-14 09:30',
      priority: 'medium'
    }
  ]);

  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState('');

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'medication':
        return 'bg-blue-100 text-blue-800';
      case 'health':
        return 'bg-red-100 text-red-800';
      case 'visit':
        return 'bg-green-100 text-green-800';
      case 'call':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-orange-500';
      case 'normal':
        return 'border-l-green-500';
      default:
        return 'border-l-gray-300';
    }
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      // In real app, this would save to the database
      console.log('Adding new note:', newNote);
      setNewNote('');
      setShowAddNote(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Care Notes</h1>
          <p className="text-muted-foreground">
            Document important observations and care updates
          </p>
        </div>
        <Button 
          className="gap-2"
          onClick={() => setShowAddNote(true)}
        >
          <Plus className="h-4 w-4" />
          Add Note
        </Button>
      </div>

      {/* Add Note Form */}
      {showAddNote && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Care Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Enter your care note here... Include any important observations, medication changes, or concerns."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={4}
            />
            <div className="flex space-x-2">
              <Button onClick={handleAddNote}>Save Note</Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddNote(false);
                  setNewNote('');
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {notes.map((note) => (
          <Card key={note.id} className={`border-l-4 ${getPriorityColor(note.priority)}`}>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{note.elderName}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(note.timestamp).toLocaleString()}</span>
                      <span>•</span>
                      <span>by {note.author}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getCategoryColor(note.category)}>
                      {note.category}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Content */}
                <p className="text-sm leading-relaxed">{note.content}</p>

                {/* Priority indicator */}
                {note.priority !== 'normal' && (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-medium">Priority:</span>
                    <Badge 
                      variant={note.priority === 'high' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {note.priority}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {notes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="space-y-4">
              <Edit className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <h3 className="text-lg font-medium">No care notes yet</h3>
                <p className="text-muted-foreground">
                  Start documenting important care observations and updates
                </p>
              </div>
              <Button onClick={() => setShowAddNote(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FamilyCareNotes;