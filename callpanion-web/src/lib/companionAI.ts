import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class CompanionAIService {
  private async callChatAI(messages: ChatMessage[], elderlyPersonName?: string): Promise<string> {
    try {
      // Call Supabase Edge Function directly using the central client
      const { data, error } = await supabase.functions.invoke('ai-companion-chat', {
        body: {
          messages,
          elderlyPersonName
        }
      });


      if (error) {
        console.error('Supabase function error:', error);
        return this.simulateChatResponse(messages);
      }

      return data.response;
    } catch (error) {
      console.error('AI chat call failed:', error);
      return this.simulateChatResponse(messages);
    }
  }

  private simulateChatResponse(messages: ChatMessage[]): string {
    const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';
    
    // Simple fallback responses
    if (lastMessage.includes('good') || lastMessage.includes('fine') || lastMessage.includes('well')) {
      return "That's wonderful to hear! It sounds like you're having a good day. Is there anything specific that's making you feel good today?";
    } else if (lastMessage.includes('tired') || lastMessage.includes('sleepy')) {
      return "I understand you're feeling tired. Have you been getting enough rest lately? Sometimes a little rest can make a big difference.";
    } else if (lastMessage.includes('pain') || lastMessage.includes('hurt')) {
      return "I'm sorry to hear you're experiencing some discomfort. If this continues, it might be good to mention it to your doctor or family.";
    } else if (lastMessage.includes('lonely') || lastMessage.includes('alone')) {
      return "It's completely natural to feel that way sometimes. You're not alone though - people care about you. Have you been able to connect with family or friends recently?";
    } else {
      return "Thank you for sharing that with me. How are you feeling about your day overall?";
    }
  }

  async generateCompanionResponse(conversationHistory: ChatMessage[], elderlyPersonName?: string): Promise<string> {
    return await this.callChatAI(conversationHistory, elderlyPersonName);
  }
}

export const companionAIService = new CompanionAIService();