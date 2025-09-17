export interface AssessmentData {
  date: string;
  responses: {
    [questionId: string]: {
      value: string;
      score: number;
      naturalResponse: string;
      confidence: number;
    };
  };
  overallMood: number;
  conversationQuality: number;
  responseTime: number;
  // New AI-generated fields
  aiAnalysis?: {
    status: 'OK' | 'Concern' | 'No Answer';
    summary: string;
    moodTag: 'Happy' | 'Tired' | 'Confused' | 'Unwell' | 'Lonely' | 'Neutral';
    followUpGenerated?: string;
    familyAlertSent?: boolean;
  };
}

export interface ConversationInsights {
  memoryIndicators: {
    repetition: number;
    forgetsConversation: boolean;
    difficultyLearning: boolean;
  };
  orientationIndicators: {
    timeConfusion: boolean;
    placeConfusion: boolean;
  };
  dailyLivingIndicators: {
    financesDifficulty: boolean;
    technologyDifficulty: boolean;
    mealPrepDifficulty: boolean;
  };
  socialIndicators: {
    conversationDifficulty: boolean;
    socialWithdrawal: boolean;
    wordFinding: boolean;
  };
  behaviorIndicators: {
    moodChanges: boolean;
    anxietyIncreased: boolean;
  };
}

export const saveAssessmentData = (data: AssessmentData): void => {
  const existing = getAssessmentHistory();
  existing.push(data);
  localStorage.setItem('assessment-data', JSON.stringify(existing));
};

export const getAssessmentHistory = (): AssessmentData[] => {
  const stored = localStorage.getItem('assessment-data');
  return stored ? JSON.parse(stored) : [];
};

export const getLatestInsights = (): ConversationInsights | null => {
  const history = getAssessmentHistory();
  if (history.length === 0) return null;
  
  // Aggregate insights from recent conversations (last 7 days)
  const recentData = history.filter(d => {
    const date = new Date(d.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return date >= weekAgo;
  });

  if (recentData.length === 0) return null;

  // Analyze patterns across recent conversations
  return {
    memoryIndicators: {
      repetition: recentData.filter(d => d.responses['memory1']?.score > 1).length / recentData.length,
      forgetsConversation: recentData.some(d => d.responses['memory2']?.score > 1),
      difficultyLearning: recentData.some(d => d.responses['memory3']?.score > 1)
    },
    orientationIndicators: {
      timeConfusion: recentData.some(d => d.responses['orientation1']?.score > 1),
      placeConfusion: recentData.some(d => d.responses['orientation2']?.score > 1)
    },
    dailyLivingIndicators: {
      financesDifficulty: recentData.some(d => d.responses['activities1']?.score > 1),
      technologyDifficulty: recentData.some(d => d.responses['activities2']?.score > 1),
      mealPrepDifficulty: recentData.some(d => d.responses['activities3']?.score > 1)
    },
    socialIndicators: {
      conversationDifficulty: recentData.some(d => d.responses['social1']?.score > 1),
      socialWithdrawal: recentData.some(d => d.responses['social2']?.score > 1),
      wordFinding: recentData.some(d => d.responses['social3']?.score > 1)
    },
    behaviorIndicators: {
      moodChanges: recentData.some(d => d.responses['behavior1']?.score > 1),
      anxietyIncreased: recentData.some(d => d.responses['behavior2']?.score > 1)
    }
  };
};