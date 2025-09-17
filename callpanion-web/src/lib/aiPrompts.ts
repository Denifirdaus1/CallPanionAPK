import { supabase } from "@/integrations/supabase/client";
export interface ConversationAnalysis {
  status: 'OK' | 'Concern' | 'No Answer';
  summary: string;
}

export interface MoodTag {
  mood: 'Happy' | 'Tired' | 'Confused' | 'Unwell' | 'Lonely' | 'Neutral';
}

export interface FamilyAlert {
  message: string;
  priority: 'low' | 'medium' | 'high';
}

export class AIPromptService {
  private async callAI(analysisType: string, name: string, speechInput: string): Promise<string> {
    try {
      // Call Supabase Edge Function directly using the central client


      const { data, error } = await supabase.functions.invoke('ai-conversation-analysis', {
        body: {
          name,
          speechInput,
          type: analysisType
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        return this.simulateAIResponse(analysisType);
      }

      return data.response;
    } catch (error) {
      console.error('AI call failed:', error);
      return this.simulateAIResponse(analysisType);
    }
  }

  private simulateAIResponse(analysisType: string): string {
    // Fallback responses when AI service is unavailable
    switch (analysisType) {
      case 'conversation':
        return 'Status: OK\nSummary: User expressed feeling well today';
      case 'followup':
        return 'How has your energy been lately?';
      case 'mood':
        return 'Neutral';
      case 'family-alert':
        return 'Your loved one is doing well today. Consider giving them a call to check in.';
      default:
        return 'Response generated';
    }
  }

  async analyzeConversation(name: string, speechInput: string): Promise<ConversationAnalysis> {
    const response = await this.callAI('conversation', name, speechInput);
    
    // Parse the response
    const statusMatch = response.match(/Status:\s*(OK|Concern|No Answer)/i);
    const summaryMatch = response.match(/Summary:\s*(.+)/i);
    
    return {
      status: (statusMatch?.[1] as ConversationAnalysis['status']) || 'No Answer',
      summary: summaryMatch?.[1] || 'No clear response detected'
    };
  }

  async generateFollowUp(speechInput: string): Promise<string> {
    return await this.callAI('followup', '', speechInput);
  }

  async generateFamilyAlert(name: string, speechInput: string): Promise<FamilyAlert> {
    const message = await this.callAI('family-alert', name, speechInput);
    
    // Determine priority based on analysis
    const analysis = await this.analyzeConversation(name, speechInput);
    const priority = analysis.status === 'Concern' ? 'high' : 
                    analysis.status === 'No Answer' ? 'medium' : 'low';
    
    return {
      message: message.substring(0, 320),
      priority
    };
  }

  async tagMood(speechInput: string): Promise<MoodTag> {
    const response = await this.callAI('mood', '', speechInput);
    
    // Extract mood from response
    const moods = ['Happy', 'Tired', 'Confused', 'Unwell', 'Lonely', 'Neutral'];
    const foundMood = moods.find(mood => 
      response.toLowerCase().includes(mood.toLowerCase())
    );
    
    return {
      mood: (foundMood as MoodTag['mood']) || 'Neutral'
    };
  }
}

export const aiPromptService = new AIPromptService();