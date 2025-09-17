import { Camera, Volume2, Play, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import WarmCard from "@/components/WarmCard";
import RelativeNavigation from "@/components/RelativeNavigation";
import familyMemoriesImg from "@/assets/family-memories.jpg";

const Memories = () => {
  const recentMemories = [
    {
      id: 1,
      title: "Emma's First Steps",
      type: "video",
      date: "3 days ago",
      description: "Little Emma took her first steps toward you during the video call!",
      thumbnail: "👶",
      duration: "2:15"
    },
    {
      id: 2,
      title: "Sunday Garden Chat",
      type: "voice",
      date: "1 week ago",
      description: "Your beautiful story about growing roses with grandpa",
      thumbnail: "🌹",
      duration: "5:42"
    },
    {
      id: 3,
      title: "Family Pasta Night",
      type: "photo",
      date: "2 weeks ago",
      description: "Everyone enjoying the lasagna recipe you shared",
      thumbnail: "🍝",
      duration: null
    },
    {
      id: 4,
      title: "Christmas Morning Joy",
      type: "video",
      date: "3 months ago",
      description: "The whole family opening presents together",
      thumbnail: "🎄",
      duration: "8:30"
    }
  ];

  const voiceReplies = [
    {
      id: 1,
      message: "Love you too, darling",
      date: "Today",
      occasion: "Morning love message"
    },
    {
      id: 2,
      message: "Thank you, sweetheart",
      date: "Yesterday",
      occasion: "After task completion"
    },
    {
      id: 3,
      message: "You make me so proud",
      date: "3 days ago",
      occasion: "Emma's piano practice"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-love">
      <RelativeNavigation />
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Our Precious Memories</h1>
          <p className="text-xl text-muted-foreground">Every moment with you is a treasure</p>
        </div>

        {/* Memory Gallery Hero */}
        <WarmCard className="mb-8 overflow-hidden">
          <div className="relative h-64 -m-6 mb-6">
            <img 
              src={familyMemoriesImg} 
              alt="Family memories collage" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <h3 className="text-3xl font-bold">A Lifetime of Love</h3>
              <p className="text-white/90">Every photo tells our story</p>
            </div>
          </div>
          <div className="text-center">
            <Button size="lg" className="bg-primary hover:bg-primary/90">
              <Camera className="h-5 w-5 mr-2" />
              Add New Memory
            </Button>
          </div>
        </WarmCard>

        {/* Recent Memories */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Recent Beautiful Moments</h2>
          <div className="space-y-4">
            {recentMemories.map((memory) => (
              <WarmCard key={memory.id} className="hover:shadow-lg transition-all duration-300">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-16 h-16 bg-warmth rounded-lg flex items-center justify-center text-2xl">
                      {memory.thumbnail}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-foreground">{memory.title}</h3>
                      <span className="text-sm text-muted-foreground">{memory.date}</span>
                    </div>
                    
                    <p className="text-foreground mb-3">{memory.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button size="sm" className="bg-primary hover:bg-primary/90">
                          <Play className="h-4 w-4 mr-1" />
                          {memory.type === 'photo' ? 'View' : 'Play'}
                        </Button>
                        {memory.duration && (
                          <span className="text-sm text-muted-foreground">{memory.duration}</span>
                        )}
                      </div>
                      
                      <Button size="sm" variant="outline" className="border-primary/20">
                        <Download className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              </WarmCard>
            ))}
          </div>
        </div>

        {/* Voice Replies Collection */}
        <WarmCard gradient="peace">
          <h3 className="text-xl font-semibold text-foreground mb-4 text-center">
            <Volume2 className="h-6 w-6 inline mr-2" />
            Your Loving Replies
          </h3>
          <p className="text-muted-foreground text-center mb-6">
            Your voice messages saved in our hearts
          </p>
          
          <div className="space-y-3">
            {voiceReplies.map((reply) => (
              <div key={reply.id} className="flex items-center justify-between p-3 bg-white/50 rounded-lg">
                <div>
                  <div className="font-medium text-foreground">"{reply.message}"</div>
                  <div className="text-sm text-muted-foreground">{reply.occasion} • {reply.date}</div>
                </div>
                <Button size="sm" variant="outline" className="border-primary/20">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-6">
            <Button variant="outline" className="border-primary/20">
              View All Saved Replies
            </Button>
          </div>
        </WarmCard>
      </div>
    </div>
  );
};

export default Memories;