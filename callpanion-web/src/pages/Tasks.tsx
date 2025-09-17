import { CheckCircle, Clock, Star, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import WarmCard from "@/components/WarmCard";
import Navigation from "@/components/Navigation";
import purposeTasksImg from "@/assets/purpose-tasks.jpg";

const Tasks = () => {
  const tasks = [
    {
      id: 1,
      title: "Choose our Sunday recipe",
      description: "Pick your favorite recipe for our family dinner this Sunday. Sarah loves when you choose!",
      dueTime: "Before Saturday",
      completed: false,
      priority: "high",
      requestedBy: "Sarah"
    },
    {
      id: 2,
      title: "Water the lavender by the back door",
      description: "The little lavender plant misses your gentle touch. It always blooms better when you care for it.",
      dueTime: "This afternoon",
      completed: true,
      priority: "medium",
      requestedBy: "David"
    },
    {
      id: 3,
      title: "Pick a photo for the family calendar",
      description: "Choose your favorite family photo from last Christmas for this month's calendar.",
      dueTime: "End of week",
      completed: false,
      priority: "low",
      requestedBy: "Little Emma"
    },
    {
      id: 4,
      title: "Record a story from your childhood",
      description: "Tell us about your favorite memory from when you were young. We love hearing your stories!",
      dueTime: "Whenever you feel like it",
      completed: false,
      priority: "medium",
      requestedBy: "The whole family"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-peace">
      <Navigation />
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">I Still Matter</h1>
          <p className="text-xl text-muted-foreground">Small ways you help our family every day</p>
        </div>

        {/* Hero image */}
        <WarmCard className="mb-8 overflow-hidden">
          <div className="relative h-48 -m-6 mb-4">
            <img 
              src={purposeTasksImg} 
              alt="Meaningful tasks" 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <h3 className="text-2xl font-bold">Your Family Needs You</h3>
              <p className="text-white/90">Every task shows how much you matter to us</p>
            </div>
          </div>
        </WarmCard>

        <div className="space-y-6">
          {tasks.map((task) => (
            <WarmCard 
              key={task.id} 
              className={`relative ${task.completed ? 'opacity-75' : ''}`}
              gradient={task.completed ? undefined : "warmth"}
            >
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 pt-1">
                  {task.completed ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <div className="w-8 h-8 border-2 border-primary rounded-full flex items-center justify-center">
                      {task.priority === "high" && <Star className="h-4 w-4 text-primary" />}
                    </div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`text-xl font-semibold ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.title}
                    </h3>
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 mr-1" />
                      {task.dueTime}
                    </div>
                  </div>
                  
                  <p className="text-foreground mb-3 leading-relaxed">{task.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Requested by <span className="font-medium text-primary">{task.requestedBy}</span>
                    </div>
                    
                    {!task.completed && (
                      <div className="space-x-2">
                        <Button size="sm" variant="outline" className="border-primary/20">
                          <Camera className="h-4 w-4 mr-2" />
                          Add Photo
                        </Button>
                        <Button size="sm" className="bg-primary hover:bg-primary/90">
                          Mark Complete
                        </Button>
                      </div>
                    )}
                    
                    {task.completed && (
                      <span className="text-green-600 font-medium text-sm">✓ Completed with love</span>
                    )}
                  </div>
                </div>
              </div>
            </WarmCard>
          ))}
        </div>

        <WarmCard className="mt-8 text-center" gradient="love">
          <h3 className="text-xl font-semibold text-foreground mb-2">You're Amazing!</h3>
          <p className="text-muted-foreground mb-4">You've completed 3 family tasks this week. Your help means everything to us.</p>
          <Button variant="outline" className="border-primary/20">
            See All Completed Tasks
          </Button>
        </WarmCard>
      </div>
    </div>
  );
};

export default Tasks;