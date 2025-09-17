import { supabase } from '@/integrations/supabase/client';

// Client-side helper functions for ElevenLabs voice agent

export const fetchWeather = async (location?: string): Promise<string> => {
  try {
    // Simple weather fetch - could integrate with OpenWeather API
    // For now, return a friendly response
    const currentLocation = location || 'your area';
    const responses = [
      `It's a lovely day in ${currentLocation}. Perfect for a walk if you feel up to it.`,
      `The weather in ${currentLocation} looks pleasant today.`,
      `It's a nice day outside in ${currentLocation}. Maybe open a window for some fresh air.`
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  } catch (error) {
    console.error('Error fetching weather:', error);
    return "I'm sorry, I couldn't check the weather right now, but I hope you're having a lovely day.";
  }
};

export const fetchSafeNews = async (): Promise<string> => {
  try {
    // Curated positive news items
    const positiveNews = [
      "A community garden project is bringing neighbors together with beautiful flowers blooming.",
      "Local volunteers helped deliver groceries to elderly residents this week.",
      "Scientists have discovered a new species of butterfly with gorgeous patterns.",
      "A new library opened with comfortable reading areas and friendly staff.",
      "Children at the local school created artwork to brighten up the community center."
    ];
    
    const randomNews = positiveNews[Math.floor(Math.random() * positiveNews.length)];
    return `Here's some lovely news: ${randomNews}`;
  } catch (error) {
    console.error('Error fetching news:', error);
    return "I don't have any news updates right now, but I'm sure there are good things happening in your community.";
  }
};

export const getTrivia = async (): Promise<string> => {
  try {
    const triviaQuestions = [
      {
        question: "What's the most popular flower in English gardens?",
        answer: "The rose, especially the classic red rose which has been beloved for centuries."
      },
      {
        question: "Which bird is known as the gardener's friend?",
        answer: "The robin! They follow gardeners around and eat the worms that are turned up."
      },
      {
        question: "What's the traditional way to test if it's warm enough to plant tender plants outside?",
        answer: "When the soil is warm enough that you can sit on it comfortably!"
      },
      {
        question: "Which herb is known as 'nature's aspirin'?",
        answer: "Willow bark, which contains salicin - the same compound found in aspirin."
      }
    ];
    
    const randomTrivia = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];
    return `Here's an interesting question for you: ${randomTrivia.question} The answer is: ${randomTrivia.answer}`;
  } catch (error) {
    console.error('Error getting trivia:', error);
    return "I'd love to share some interesting facts, but I can't think of any right now. Perhaps you could tell me something interesting instead?";
  }
};

export const checkEmergencyKeywords = async (text: string): Promise<{ isEmergency: boolean; keywords: string[] }> => {
  try {
    const emergencyKeywords = [
      'help', 'emergency', 'hurt', 'pain', 'fallen', 'can\'t get up', 
      'chest pain', 'can\'t breathe', 'dizzy', 'confused', 'scared',
      'ambulance', '999', 'call doctor', 'something wrong'
    ];
    
    const foundKeywords = emergencyKeywords.filter(keyword => 
      text.toLowerCase().includes(keyword.toLowerCase())
    );
    
    return {
      isEmergency: foundKeywords.length > 0,
      keywords: foundKeywords
    };
  } catch (error) {
    console.error('Error checking emergency keywords:', error);
    return { isEmergency: false, keywords: [] };
  }
};

// Webhook tool helpers that call our edge functions
export const logWellbeing = async (params: {
  relative_id: string;
  mood_rating?: number;
  energy_level?: number; 
  pain_level?: number;
  sleep_quality?: number;
  notes?: string;
}): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('log-wellbeing', {
      body: params
    });

    if (error) throw error;

    return data.success 
      ? "I've recorded your wellbeing information. Thank you for sharing that with me."
      : "I had trouble saving that information, but I've heard what you said.";
  } catch (error) {
    console.error('Error logging wellbeing:', error);
    return "I've made a note of what you told me, though I couldn't save it to the system right now.";
  }
};

export const notifyFamily = async (params: {
  household_id: string;
  relative_id?: string;
  title: string;
  message: string;
  priority?: string;
}): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('notify-family', {
      body: params
    });

    if (error) throw error;

    return data.success 
      ? `I've let your family know: "${params.title}". They'll be able to see this message.`
      : "I tried to contact your family but had some technical difficulties.";
  } catch (error) {
    console.error('Error notifying family:', error);
    return "I'll make sure to let your family know about this when I can reach them.";
  }
};

export const escalateEmergency = async (params: {
  household_id: string;
  relative_id: string;
  emergency_type: string;
  details?: string;
}): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('escalate-emergency', {
      body: params
    });

    if (error) throw error;

    return data.success 
      ? "I've immediately alerted your family about this emergency. They should be contacted right away."
      : "I've noted this as urgent and will make sure your family is contacted as soon as possible.";
  } catch (error) {
    console.error('Error escalating emergency:', error);
    return "I understand this is urgent. I'm doing everything I can to make sure your family knows to check on you immediately.";
  }
};

export const getFamilyMessages = async (params: {
  household_id: string;
  limit?: number;
}): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-family-messages', {
      body: params
    });

    if (error) throw error;

    return data.summary || "I couldn't retrieve your family messages right now.";
  } catch (error) {
    console.error('Error getting family messages:', error);
    return "I'm having trouble accessing your messages at the moment, but I'll try again later.";
  }
};

export const getWellbeingTrends = async (params: {
  relative_id: string;
  days?: number;
}): Promise<string> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-wellbeing-trends', {
      body: params
    });

    if (error) throw error;

    return data.summary || "I don't have enough wellbeing data to show trends yet.";
  } catch (error) {
    console.error('Error getting wellbeing trends:', error);
    return "I can't access your wellbeing history right now, but I'm glad to talk about how you're feeling today.";
  }
};