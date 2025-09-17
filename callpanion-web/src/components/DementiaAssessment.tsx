import { useState } from "react";
import { Brain, AlertCircle, CheckCircle, Clock, Users, MessageSquare, Calendar, Home } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Question {
  id: string;
  category: string;
  question: string;
  options: { value: string; label: string; score: number }[];
  icon: any;
}

const questions: Question[] = [
  // Memory Domain
  {
    id: "memory1",
    category: "Memory & Learning",
    question: "How often does your loved one repeat questions or stories?",
    options: [
      { value: "never", label: "Never or rarely", score: 0 },
      { value: "sometimes", label: "Sometimes (once a week)", score: 1 },
      { value: "often", label: "Often (several times a week)", score: 2 },
      { value: "daily", label: "Daily or multiple times per day", score: 3 }
    ],
    icon: Brain
  },
  {
    id: "memory2",
    category: "Memory & Learning",
    question: "How often do they forget recent conversations or events?",
    options: [
      { value: "never", label: "Never or rarely", score: 0 },
      { value: "sometimes", label: "Sometimes", score: 1 },
      { value: "often", label: "Often", score: 2 },
      { value: "always", label: "Most of the time", score: 3 }
    ],
    icon: Brain
  },
  {
    id: "memory3",
    category: "Memory & Learning",
    question: "Do they have difficulty learning new information or routines?",
    options: [
      { value: "no", label: "No difficulty", score: 0 },
      { value: "mild", label: "Mild difficulty", score: 1 },
      { value: "moderate", label: "Moderate difficulty", score: 2 },
      { value: "severe", label: "Severe difficulty", score: 3 }
    ],
    icon: Brain
  },
  
  // Orientation Domain
  {
    id: "orientation1",
    category: "Orientation & Awareness",
    question: "How often do they get confused about the date or time?",
    options: [
      { value: "never", label: "Never", score: 0 },
      { value: "sometimes", label: "Sometimes", score: 1 },
      { value: "often", label: "Often", score: 2 },
      { value: "always", label: "Frequently confused", score: 3 }
    ],
    icon: Clock
  },
  {
    id: "orientation2",
    category: "Orientation & Awareness",
    question: "Do they get lost in familiar places?",
    options: [
      { value: "never", label: "Never", score: 0 },
      { value: "rarely", label: "Very rarely", score: 1 },
      { value: "sometimes", label: "Sometimes", score: 2 },
      { value: "often", label: "Often", score: 3 }
    ],
    icon: Home
  },

  // Daily Activities Domain
  {
    id: "activities1",
    category: "Daily Living Activities",
    question: "How has their ability to manage finances changed?",
    options: [
      { value: "unchanged", label: "No change", score: 0 },
      { value: "minor", label: "Minor difficulties", score: 1 },
      { value: "significant", label: "Significant difficulties", score: 2 },
      { value: "unable", label: "Unable to manage", score: 3 }
    ],
    icon: Calendar
  },
  {
    id: "activities2",
    category: "Daily Living Activities",
    question: "How has their ability to use technology (phone, TV remote) changed?",
    options: [
      { value: "unchanged", label: "No change", score: 0 },
      { value: "minor", label: "Minor difficulties", score: 1 },
      { value: "significant", label: "Significant difficulties", score: 2 },
      { value: "unable", label: "Unable to use familiar devices", score: 3 }
    ],
    icon: Calendar
  },
  {
    id: "activities3",
    category: "Daily Living Activities",
    question: "How has their ability to prepare meals changed?",
    options: [
      { value: "unchanged", label: "No change", score: 0 },
      { value: "simple", label: "Only simple meals", score: 1 },
      { value: "assistance", label: "Needs assistance", score: 2 },
      { value: "unable", label: "Unable to prepare meals", score: 3 }
    ],
    icon: Calendar
  },

  // Social & Communication Domain
  {
    id: "social1",
    category: "Communication & Social",
    question: "How has their ability to follow conversations changed?",
    options: [
      { value: "unchanged", label: "No change", score: 0 },
      { value: "minor", label: "Minor difficulties", score: 1 },
      { value: "significant", label: "Often loses track", score: 2 },
      { value: "severe", label: "Very difficult to follow", score: 3 }
    ],
    icon: MessageSquare
  },
  {
    id: "social2",
    category: "Communication & Social",
    question: "How has their interest in social activities changed?",
    options: [
      { value: "unchanged", label: "No change", score: 0 },
      { value: "decreased", label: "Somewhat decreased", score: 1 },
      { value: "withdrawn", label: "More withdrawn", score: 2 },
      { value: "isolated", label: "Very withdrawn/isolated", score: 3 }
    ],
    icon: Users
  },
  {
    id: "social3",
    category: "Communication & Social",
    question: "Do they have difficulty finding the right words?",
    options: [
      { value: "never", label: "Never or rarely", score: 0 },
      { value: "sometimes", label: "Sometimes", score: 1 },
      { value: "often", label: "Often", score: 2 },
      { value: "frequently", label: "Very frequently", score: 3 }
    ],
    icon: MessageSquare
  },

  // Behavioral Changes Domain
  {
    id: "behavior1",
    category: "Mood & Behavior",
    question: "Have you noticed changes in their mood or personality?",
    options: [
      { value: "none", label: "No changes", score: 0 },
      { value: "mild", label: "Mild changes", score: 1 },
      { value: "noticeable", label: "Noticeable changes", score: 2 },
      { value: "significant", label: "Significant changes", score: 3 }
    ],
    icon: Users
  },
  {
    id: "behavior2",
    category: "Mood & Behavior",
    question: "Do they show increased anxiety or agitation?",
    options: [
      { value: "never", label: "Never", score: 0 },
      { value: "sometimes", label: "Sometimes", score: 1 },
      { value: "often", label: "Often", score: 2 },
      { value: "frequently", label: "Very frequently", score: 3 }
    ],
    icon: Users
  }
];

interface DementiaAssessmentProps {
  onComplete?: (results: AssessmentResults) => void;
}

interface AssessmentResults {
  totalScore: number;
  maxScore: number;
  categoryScores: { [key: string]: { score: number; maxScore: number } };
  riskLevel: 'low' | 'mild' | 'moderate' | 'high';
  recommendations: string[];
}

const DementiaAssessment = ({ onComplete }: DementiaAssessmentProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<AssessmentResults | null>(null);

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      calculateResults();
    }
  };

  const prevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateResults = () => {
    let totalScore = 0;
    const maxScore = questions.length * 3;
    const categoryScores: { [key: string]: { score: number; maxScore: number } } = {};

    questions.forEach(question => {
      const answer = answers[question.id];
      if (answer) {
        const option = question.options.find(opt => opt.value === answer);
        const score = option?.score || 0;
        totalScore += score;

        if (!categoryScores[question.category]) {
          categoryScores[question.category] = { score: 0, maxScore: 0 };
        }
        categoryScores[question.category].score += score;
        categoryScores[question.category].maxScore += 3;
      }
    });

    const percentage = (totalScore / maxScore) * 100;
    let riskLevel: 'low' | 'mild' | 'moderate' | 'high';
    let recommendations: string[];

    if (percentage < 25) {
      riskLevel = 'low';
      recommendations = [
        "Results suggest minimal cognitive concerns",
        "Continue regular health check-ups",
        "Maintain healthy lifestyle habits",
        "Stay socially active and engaged"
      ];
    } else if (percentage < 50) {
      riskLevel = 'mild';
      recommendations = [
        "Some cognitive changes noted",
        "Consider discussing with GP during next routine visit",
        "Monitor changes over time",
        "Maintain mental stimulation activities"
      ];
    } else if (percentage < 75) {
      riskLevel = 'moderate';
      recommendations = [
        "Moderate cognitive concerns identified",
        "Recommend scheduling GP appointment within 2-4 weeks",
        "Consider formal cognitive assessment",
        "Begin documentation of daily functioning"
      ];
    } else {
      riskLevel = 'high';
      recommendations = [
        "Significant cognitive concerns identified",
        "Strongly recommend urgent GP consultation",
        "Request referral to memory clinic",
        "Consider safety assessments for home environment"
      ];
    }

    const assessmentResults: AssessmentResults = {
      totalScore,
      maxScore,
      categoryScores,
      riskLevel,
      recommendations
    };

    setResults(assessmentResults);
    setShowResults(true);
    onComplete?.(assessmentResults);
  };

  const resetAssessment = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setResults(null);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-peace/20 text-peace border-peace/30';
      case 'mild': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'moderate': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'high': return 'bg-destructive/20 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (showResults && results) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-6 w-6 text-primary" />
            <span>Cognitive Assessment Results</span>
          </CardTitle>
          <CardDescription>
            Based on NICE guidelines for cognitive change identification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This assessment is for informational purposes only and does not replace professional medical evaluation. 
              Please consult with a healthcare provider for proper diagnosis and care.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Overall Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center space-y-4">
                  <div className="text-3xl font-bold">
                    {results.totalScore}/{results.maxScore}
                  </div>
                  <Progress value={(results.totalScore / results.maxScore) * 100} className="h-3" />
                  <Badge className={`${getRiskLevelColor(results.riskLevel)} text-sm px-3 py-1`}>
                    {results.riskLevel.toUpperCase()} CONCERN LEVEL
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(results.categoryScores).map(([category, scores]) => (
                  <div key={category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{category}</span>
                      <span>{scores.score}/{scores.maxScore}</span>
                    </div>
                    <Progress value={(scores.score / scores.maxScore) * 100} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {results.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="flex justify-center space-x-4">
            <Button onClick={resetAssessment} variant="outline">
              Take Assessment Again
            </Button>
            <Button onClick={() => window.print()}>
              Print Results
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQ = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const IconComponent = currentQ.icon;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <IconComponent className="h-5 w-5 text-primary" />
            <span>{currentQ.category}</span>
          </CardTitle>
          <Badge variant="outline">
            {currentQuestion + 1} of {questions.length}
          </Badge>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please answer based on changes you have observed over the past 6-12 months.
          </AlertDescription>
        </Alert>

        <div>
          <h3 className="text-lg font-medium mb-4">{currentQ.question}</h3>
          <RadioGroup
            value={answers[currentQ.id] || ""}
            onValueChange={(value) => handleAnswer(currentQ.id, value)}
          >
            {currentQ.options.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="flex justify-between">
          <Button
            onClick={prevQuestion}
            disabled={currentQuestion === 0}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            onClick={nextQuestion}
            disabled={!answers[currentQ.id]}
          >
            {currentQuestion === questions.length - 1 ? "Complete Assessment" : "Next"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DementiaAssessment;