export interface NaturalQuestion {
  id: string;
  category: string;
  naturalVariations: string[];
  followUpQuestions: string[];
  responseAnalysis: (response: string) => {
    score: number;
    confidence: number;
    indicators: string[];
  };
}

export const naturalQuestions: NaturalQuestion[] = [
  {
    id: "memory1",
    category: "Memory & Learning",
    naturalVariations: [
      "Have you told me this story before? I love hearing it again!",
      "You mentioned something similar yesterday - could you remind me of the details?",
      "I feel like we've talked about this recently. Could you refresh my memory?"
    ],
    followUpQuestions: [
      "When did this happen?",
      "Who else was involved?",
      "What was the most memorable part?"
    ],
    responseAnalysis: (response: string) => {
      const indicators = [];
      let score = 0;
      let confidence = 0.5;

      // Analyze for repetition patterns
      if (response.toLowerCase().includes("told you") || response.toLowerCase().includes("said before")) {
        indicators.push("Shows awareness of repetition");
        confidence = 0.8;
      } else if (response.length < 10) {
        score = 1;
        indicators.push("Short response may indicate confusion");
        confidence = 0.6;
      } else if (response.toLowerCase().includes("don't remember") || response.toLowerCase().includes("forgot")) {
        score = 2;
        indicators.push("Explicit memory difficulty mentioned");
        confidence = 0.9;
      }

      return { score, confidence, indicators };
    }
  },
  {
    id: "orientation1", 
    category: "Orientation & Awareness",
    naturalVariations: [
      "What day is it today? I sometimes lose track myself!",
      "It feels like time flies by so quickly. What month are we in?",
      "I was just thinking - what season does it feel like to you right now?"
    ],
    followUpQuestions: [
      "What are your plans for today?",
      "Any special events coming up this week?",
      "How has the weather been affecting your mood?"
    ],
    responseAnalysis: (response: string) => {
      const indicators = [];
      let score = 0;
      let confidence = 0.7;

      const today = new Date();
      const currentDay = today.toLocaleDateString('en-US', { weekday: 'long' });
      const currentMonth = today.toLocaleDateString('en-US', { month: 'long' });
      
      if (response.toLowerCase().includes(currentDay.toLowerCase()) || 
          response.toLowerCase().includes(currentMonth.toLowerCase())) {
        indicators.push("Correct time orientation");
        confidence = 0.9;
      } else if (response.toLowerCase().includes("don't know") || 
                 response.toLowerCase().includes("not sure")) {
        score = 2;
        indicators.push("Uncertainty about date/time");
        confidence = 0.8;
      } else if (response.length < 5) {
        score = 1;
        indicators.push("Minimal response to time question");
        confidence = 0.6;
      }

      return { score, confidence, indicators };
    }
  },
  {
    id: "activities1",
    category: "Daily Living Activities", 
    naturalVariations: [
      "How do you like to stay organized with your bills and finances?",
      "Do you still handle your own banking, or does someone help you?",
      "Managing money can be tricky these days with all the technology. How do you find it?"
    ],
    followUpQuestions: [
      "Do you prefer cash or cards?",
      "Any tips for staying organized?",
      "How has online banking been for you?"
    ],
    responseAnalysis: (response: string) => {
      const indicators = [];
      let score = 0;
      let confidence = 0.6;

      if (response.toLowerCase().includes("help") || response.toLowerCase().includes("someone else")) {
        score = 2;
        indicators.push("Requires assistance with finances");
        confidence = 0.8;
      } else if (response.toLowerCase().includes("difficult") || response.toLowerCase().includes("struggle")) {
        score = 1;
        indicators.push("Some financial management difficulties");
        confidence = 0.7;
      } else if (response.toLowerCase().includes("manage") && response.toLowerCase().includes("myself")) {
        indicators.push("Independent financial management");
        confidence = 0.8;
      }

      return { score, confidence, indicators };
    }
  },
  {
    id: "social1",
    category: "Communication & Social",
    naturalVariations: [
      "I love our chats! Do you find it easy to follow along when we talk?",
      "Sometimes conversations can move fast. How do you find keeping up?",
      "When you're with family, do you enjoy the group conversations?"
    ],
    followUpQuestions: [
      "What topics do you enjoy most?",
      "Who do you like talking with?",
      "Any conversations that stick in your memory?"
    ],
    responseAnalysis: (response: string) => {
      const indicators = [];
      let score = 0;
      let confidence = 0.6;

      if (response.toLowerCase().includes("hard to follow") || response.toLowerCase().includes("lose track")) {
        score = 2;
        indicators.push("Difficulty following conversations");
        confidence = 0.8;
      } else if (response.toLowerCase().includes("sometimes") && response.toLowerCase().includes("difficult")) {
        score = 1;
        indicators.push("Occasional conversation challenges");
        confidence = 0.7;
      } else if (response.toLowerCase().includes("easy") || response.toLowerCase().includes("enjoy")) {
        indicators.push("Good conversation engagement");
        confidence = 0.8;
      }

      return { score, confidence, indicators };
    }
  },
  {
    id: "behavior1",
    category: "Mood & Behavior",
    naturalVariations: [
      "How has your mood been lately? I want to make sure you're feeling supported.",
      "Have you been feeling more like yourself recently?",
      "Sometimes we all go through changes. How have you been feeling emotionally?"
    ],
    followUpQuestions: [
      "What makes you feel happiest?",
      "Any particular challenges lately?",
      "What helps when you're feeling down?"
    ],
    responseAnalysis: (response: string) => {
      const indicators = [];
      let score = 0;
      let confidence = 0.7;

      if (response.toLowerCase().includes("different") || response.toLowerCase().includes("changed")) {
        score = 1;
        indicators.push("Acknowledges mood changes");
        confidence = 0.8;
      } else if (response.toLowerCase().includes("anxious") || response.toLowerCase().includes("worried")) {
        score = 2;
        indicators.push("Reports anxiety or worry");
        confidence = 0.9;
      } else if (response.toLowerCase().includes("good") || response.toLowerCase().includes("fine")) {
        indicators.push("Reports stable mood");
        confidence = 0.7;
      }

      return { score, confidence, indicators };
    }
  }
];

export const selectRandomQuestion = (usedQuestions: string[] = []): NaturalQuestion | null => {
  const availableQuestions = naturalQuestions.filter(q => !usedQuestions.includes(q.id));
  if (availableQuestions.length === 0) return null;
  
  return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
};

export const generateNaturalPrompt = (question: NaturalQuestion): string => {
  const variation = question.naturalVariations[Math.floor(Math.random() * question.naturalVariations.length)];
  return variation;
};