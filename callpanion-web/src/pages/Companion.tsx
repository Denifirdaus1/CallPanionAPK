import { Phone, Clock, Calendar, Volume2, Mic, Play, Pause, Settings, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import WarmCard from "@/components/WarmCard";
import Navigation from "@/components/Navigation";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { naturalQuestions, selectRandomQuestion, generateNaturalPrompt } from "@/lib/naturalQuestions";
import { saveAssessmentData, AssessmentData } from "@/lib/assessmentData";
import { aiPromptService } from "@/lib/aiPrompts";
import { familyAlertService } from "@/lib/familyAlerts";
import { companionAIService } from "@/lib/companionAI";

interface ConversationMessage {
  role: string;
  content: string;
  timestamp: Date;
  questionId?: string;
  assessmentData?: any;
}

const Companion = () => {
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState("");
  const [isCallActive, setIsCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [sessionAssessmentData, setSessionAssessmentData] = useState<any>({});
  const [usedQuestions, setUsedQuestions] = useState<string[]>([]);
  const [elderlyPersonName, setElderlyPersonName] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  const callHistory = [
    {
      id: 1,
      date: "Today",
      time: "10:00 AM",
      duration: "12 minutes",
      mood: "Cheerful and engaged",
      highlights: "Shared garden stories, remembered grandchildren's names",
      insights: "Good memory recall, positive mood"
    },
    {
      id: 2,
      date: "Yesterday", 
      time: "10:00 AM",
      duration: "15 minutes",
      mood: "Reflective conversation",
      highlights: "Discussed family achievements, asked about time twice",
      insights: "Some time orientation questions, otherwise engaged"
    },
    {
      id: 3,
      date: "2 days ago",
      time: "10:00 AM", 
      duration: "10 minutes",
      mood: "Encouraging morning chat",
      highlights: "Recipe sharing, mentioned cooking challenges",
      insights: "Possible independence concerns noted"
    }
  ];

  const startDailyCall = async () => {
    if (!elevenLabsApiKey || !elderlyPersonName.trim()) {
      toast({
        title: "Required Information Missing",
        description: "Please enter the person's name and ElevenLabs API key to start the call.",
        variant: "destructive"
      });
      return;
    }

    setIsCallActive(true);
    setConversation([]);
    setSessionAssessmentData({});
    setUsedQuestions([]);
    
    // Start with a warm greeting
    const greeting = "Good morning, dear! I'm so happy to spend some time with you today. How are you feeling this morning?";
    setConversation([{role: 'assistant', content: greeting, timestamp: new Date()}]);
    
    // Use ElevenLabs to speak the greeting
    await speakMessage(greeting);
    
    toast({
      title: "Daily Call Started",
      description: "Your AI companion is ready for your daily check-in!"
    });
  };

  const speakMessage = async (message: string) => {
    if (!elevenLabsApiKey) return;
    
    setIsSpeaking(true);
    
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/9BWtsMINqrJLrRacOk9x', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: message,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.onended = () => setIsSpeaking(false);
          await audioRef.current.play();
        }
      }
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsSpeaking(false);
    }
  };

  const analyzeResponseAndIntegrateQuestion = async (userMessage: string, conversationHistory: ConversationMessage[]): Promise<string> => {
    // Enhanced AI analysis for main wellbeing check
    try {
      const [conversationAnalysis, moodTag] = await Promise.all([
        aiPromptService.analyzeConversation(elderlyPersonName || "user", userMessage),
        aiPromptService.tagMood(userMessage)
      ]);

      // Store AI analysis in session data
      if (!sessionAssessmentData.aiAnalysis) {
        setSessionAssessmentData(prev => ({
          ...prev,
          aiAnalysis: {
            status: conversationAnalysis.status,
            summary: conversationAnalysis.summary,
            moodTag: moodTag.mood
          }
        }));
      }

      // Generate follow-up if needed
      if (conversationAnalysis.status === 'Concern' || conversationAnalysis.status === 'No Answer') {
        const followUp = await aiPromptService.generateFollowUp(userMessage);
        setSessionAssessmentData(prev => ({
          ...prev,
          aiAnalysis: {
            ...prev.aiAnalysis,
            followUpGenerated: followUp
          }
        }));
        
        // Send family alert for concerning responses
        if (conversationAnalysis.status === 'Concern') {
          await familyAlertService.processCallAndAlert(elderlyPersonName || "user", userMessage);
          setSessionAssessmentData(prev => ({
            ...prev,
            aiAnalysis: {
              ...prev.aiAnalysis,
              familyAlertSent: true
            }
          }));
        }
        
        return `${followUp} `;
      }
    } catch (error) {
      console.error('AI analysis failed:', error);
    }

    // Existing natural questions logic
    const shouldAskQuestion = Math.random() < 0.3 && usedQuestions.length < naturalQuestions.length;
    
    if (shouldAskQuestion && !currentQuestion) {
      const selectedQuestion = selectRandomQuestion(usedQuestions);
      if (selectedQuestion) {
        setCurrentQuestion(selectedQuestion);
        setUsedQuestions(prev => [...prev, selectedQuestion.id]);
        
        const naturalPrompt = generateNaturalPrompt(selectedQuestion);
        return `That's wonderful to hear! ${naturalPrompt}`;
      }
    }

    if (currentQuestion) {
      const analysis = currentQuestion.responseAnalysis(userMessage);
      
      setSessionAssessmentData(prev => ({
        ...prev,
        [currentQuestion.id]: {
          value: userMessage,
          score: analysis.score,
          naturalResponse: userMessage,
          confidence: analysis.confidence
        }
      }));
      
      setCurrentQuestion(null);
      
      const acknowledgments = [
        "Thank you for sharing that with me.",
        "I appreciate you telling me about that.",
        "That gives me a good picture of how things are going."
      ];
      const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];
      
      return `${ack} Let's talk about something else - what has been the highlight of your week so far?`;
    }

    return "";
  };

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    const newConversation = [...conversation, {role: 'user', content: userMessage, timestamp: new Date()}];
    setConversation(newConversation);
    setCurrentMessage("");

    try {
      // Analyze if we should integrate assessment
      const questionResponse = await analyzeResponseAndIntegrateQuestion(userMessage, newConversation);
      
      if (questionResponse) {
        // Use pre-generated response for assessment integration
        const aiResponse = questionResponse;
        setConversation(prev => [...prev, {role: 'assistant', content: aiResponse, timestamp: new Date()}]);
        await speakMessage(aiResponse);
        return;
      }

      // Regular conversation flow using CompanionAIService
      const chatMessages = newConversation.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      const aiResponse = await companionAIService.generateCompanionResponse(chatMessages, elderlyPersonName);
      
      setConversation(prev => [...prev, {role: 'assistant', content: aiResponse, timestamp: new Date()}]);
      await speakMessage(aiResponse);
      
    } catch (error) {
      toast({
        title: "Connection Issue",
        description: "Sorry, I had trouble hearing you. Let's try again.",
        variant: "destructive"
      });
    }
  };

  const endCall = () => {
    // Save assessment data from this session
    if (Object.keys(sessionAssessmentData).length > 0) {
      const assessmentData: AssessmentData = {
        date: new Date().toISOString(),
        responses: sessionAssessmentData,
        overallMood: 7, // Could be calculated from conversation analysis
        conversationQuality: 8, // Could be calculated from engagement metrics
        responseTime: 1200 // Could be calculated from actual response times
      };
      
      saveAssessmentData(assessmentData);
      
      toast({
        title: "Session Insights Saved",
        description: "Today's conversation insights have been added to your health dashboard."
      });
    }
    
    setIsCallActive(false);
    setConversation([]);
    setCurrentQuestion(null);
    setSessionAssessmentData({});
    setUsedQuestions([]);
    setIsSpeaking(false);
    
    toast({
      title: "Call Ended",
      description: "Thank you for the lovely chat! See you tomorrow at the same time."
    });
  };

  return (
    <div className="min-h-screen bg-gradient-peace">
      <Navigation />
      <audio ref={audioRef} style={{ display: 'none' }} />
      
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Daily Companion Call</h1>
          <p className="text-xl text-muted-foreground">Your caring AI friend with gentle wellness monitoring</p>
        </div>

        {/* API Keys Input */}
        {!isCallActive && (
          <WarmCard className="mb-8">
            <div className="space-y-4">
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  This enhanced companion uses OpenAI through Supabase for intelligent conversations and integrates gentle wellness questions to help monitor cognitive health over time.
                </AlertDescription>
              </Alert>
              
            {/* Person Name Input */}
            <div className="mb-4">
              <Label htmlFor="person-name" className="text-base font-medium">
                Who are we calling today?
              </Label>
              <Input
                id="person-name"
                placeholder="Enter their name (e.g., Grandma Mary)"
                value={elderlyPersonName}
                onChange={(e) => setElderlyPersonName(e.target.value)}
                className="text-base mt-2"
              />
            </div>

            <div>
              <Label htmlFor="elevenLabsKey" className="text-base font-medium">
                ElevenLabs API Key
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                For natural voice interactions. AI conversation powered by OpenAI through Supabase.
              </p>
              <Input
                id="elevenLabsKey"
                type="password"
                value={elevenLabsApiKey}
                onChange={(e) => setElevenLabsApiKey(e.target.value)}
                placeholder="Enter ElevenLabs API key"
                className="text-base"
              />
            </div>
            </div>
          </WarmCard>
        )}

        {/* Active Call Interface */}
        {isCallActive ? (
          <div className="space-y-6">
            <WarmCard gradient="warmth" className="text-center">
              <div className="flex items-center justify-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center animate-pulse">
                  {isSpeaking ? (
                    <Volume2 className="h-8 w-8 text-primary-foreground" />
                  ) : (
                    <Phone className="h-8 w-8 text-primary-foreground" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Call Active</h3>
                  <p className="text-muted-foreground">
                    {isSpeaking ? "AI is speaking..." : "Listening and monitoring wellness"}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-center space-x-4 mb-4">
                <Button
                  size="lg"
                  variant={isListening ? "destructive" : "default"}
                  onClick={() => setIsListening(!isListening)}
                  className="bg-primary hover:bg-primary/90"
                  disabled={isSpeaking}
                >
                  <Mic className="h-5 w-5 mr-2" />
                  {isListening ? "Stop Listening" : "Start Speaking"}
                </Button>
                
                <Button size="lg" variant="outline" onClick={endCall} className="border-primary/20">
                  End Call
                </Button>
              </div>

              {/* Assessment Progress */}
              {usedQuestions.length > 0 && (
                <div className="bg-white/20 rounded-lg p-3">
                  <div className="flex items-center justify-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-sm">
                      Wellness insights: {usedQuestions.length} topics explored naturally
                    </span>
                  </div>
                </div>
              )}
            </WarmCard>

            {/* Conversation Display */}
            <WarmCard>
              <h3 className="text-lg font-semibold text-foreground mb-4">Today's Conversation</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {conversation.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-love/30 text-foreground border border-love/20'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <span className="text-xs opacity-75">
                        {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 flex space-x-2">
                <Input
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  placeholder="Type your message..."
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage(currentMessage)}
                  className="flex-1"
                  disabled={isSpeaking}
                />
                <Button 
                  onClick={() => sendMessage(currentMessage)} 
                  className="bg-primary hover:bg-primary/90"
                  disabled={isSpeaking || !currentMessage.trim()}
                >
                  Send
                </Button>
              </div>
            </WarmCard>
          </div>
        ) : (
          <>
            {/* Start Call Section */}
            <WarmCard className="text-center mb-8" gradient="love">
              <div className="mb-6">
                <div className="w-24 h-24 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">Ready for Your Daily Check-in?</h3>
                <p className="text-foreground">Your AI companion will chat naturally while gently monitoring your wellness</p>
              </div>
              
              <Button 
                size="lg" 
                onClick={startDailyCall}
                className="bg-primary hover:bg-primary/90 shadow-gentle"
                disabled={!elevenLabsApiKey || !elderlyPersonName.trim()}
              >
                <Phone className="h-5 w-5 mr-2" />
                Start Daily Call
              </Button>
            </WarmCard>

            {/* Call Schedule */}
            <WarmCard className="mb-8">
              <div className="flex items-center space-x-3 mb-4">
                <Clock className="h-6 w-6 text-primary" />
                <h3 className="text-xl font-semibold text-foreground">Your Call Schedule</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-warmth rounded-lg">
                  <div className="text-2xl font-bold text-primary">10:00 AM</div>
                  <div className="text-sm text-muted-foreground">Morning Check-in</div>
                </div>
                <div className="text-center p-4 bg-peace rounded-lg">
                  <div className="text-2xl font-bold text-primary">3:00 PM</div>
                  <div className="text-sm text-muted-foreground">Afternoon Chat</div>
                </div>
                <div className="text-center p-4 bg-joy rounded-lg">
                  <div className="text-2xl font-bold text-primary">8:00 PM</div>
                  <div className="text-sm text-muted-foreground">Evening Reflection</div>
                </div>
              </div>
            </WarmCard>

            {/* Enhanced Call History with Insights */}
            <WarmCard>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-6 w-6 text-primary" />
                  <h3 className="text-xl font-semibold text-foreground">Recent Conversations</h3>
                </div>
                <Badge variant="outline" className="border-primary/30">
                  Wellness Monitoring Active
                </Badge>
              </div>
              
              <div className="space-y-4">
                {callHistory.map((call) => (
                  <Card key={call.id} className="border-l-4 border-l-primary/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-semibold text-foreground">{call.date} at {call.time}</div>
                        <div className="text-sm text-muted-foreground">{call.duration}</div>
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">{call.mood}</div>
                      <div className="text-sm text-foreground mb-2">💝 {call.highlights}</div>
                      <div className="bg-comfort/20 rounded p-2">
                        <div className="text-xs font-medium text-primary mb-1">Wellness Insights:</div>
                        <div className="text-xs text-muted-foreground">{call.insights}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              <div className="mt-6 text-center">
                <Button variant="outline" className="border-primary/20">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  View Health Dashboard
                </Button>
              </div>
            </WarmCard>
          </>
        )}
      </div>
    </div>
  );
};

export default Companion;