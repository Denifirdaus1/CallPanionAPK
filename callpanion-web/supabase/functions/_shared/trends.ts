import { serviceClient } from './client.ts';
import { isValidUUID } from './util.ts';

/**
 * Trend analysis and statistical functions
 */

/**
 * Calculates mood change Z-score for anomaly detection
 * Compares recent mood patterns against historical baseline
 * @param householdId Household ID to analyze
 * @param supportedUserId The elderly person's customer ID
 * @param recentN Number of recent days to compare (default 14)
 * @returns Promise<number | null> Z-score (null if insufficient data)
 */
export async function moodChangeZ(
  householdId: string,
  supportedUserId: string,
  recentN: number = 14
): Promise<number | null> {
  if (!isValidUUID(householdId) || !isValidUUID(supportedUserId)) {
    console.error('Invalid UUID format:', { householdId, supportedUserId });
    return null;
  }

  try {
    const supabase = serviceClient();
    
    // Get mood signals for the past 90 days (for baseline) and recent period
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const recentDaysAgo = new Date();
    recentDaysAgo.setDate(recentDaysAgo.getDate() - recentN);
    
    const { data: signals, error } = await supabase
      .from('app.signals')
      .select('value, captured_at')
      .eq('customer_id', supportedUserId)
      .eq('type', 'mood')
      .gte('captured_at', ninetyDaysAgo.toISOString())
      .order('captured_at', { ascending: false });

    if (error) {
      console.error('Error fetching mood signals:', error);
      return null;
    }

    if (!signals || signals.length < 10) {
      console.log('Insufficient mood data for analysis');
      return null;
    }

    // Convert mood values to numeric scores
    const moodToScore = {
      'very_low': 1,
      'low': 2,
      'neutral': 3,
      'good': 4,
      'very_good': 5,
    };

    // Filter and convert to numeric scores
    const numericSignals = signals
      .map(s => ({
        score: moodToScore[s.value as keyof typeof moodToScore],
        date: new Date(s.captured_at),
      }))
      .filter(s => s.score !== undefined);

    if (numericSignals.length < 10) {
      console.log('Insufficient valid mood data for analysis');
      return null;
    }

    // Split into recent and historical data
    const recentSignals = numericSignals.filter(s => s.date >= recentDaysAgo);
    const historicalSignals = numericSignals.filter(s => s.date < recentDaysAgo);

    if (recentSignals.length < 3 || historicalSignals.length < 7) {
      console.log('Insufficient data split for trend analysis');
      return null;
    }

    // Calculate averages
    const recentAvg = recentSignals.reduce((sum, s) => sum + s.score, 0) / recentSignals.length;
    const historicalAvg = historicalSignals.reduce((sum, s) => sum + s.score, 0) / historicalSignals.length;
    
    // Calculate standard deviation of historical data
    const historicalVariance = historicalSignals.reduce(
      (sum, s) => sum + Math.pow(s.score - historicalAvg, 2),
      0
    ) / historicalSignals.length;
    
    const historicalStdDev = Math.sqrt(historicalVariance);

    // Avoid division by zero
    if (historicalStdDev === 0) {
      console.log('No variance in historical mood data');
      return 0;
    }

    // Calculate Z-score
    const zScore = (recentAvg - historicalAvg) / historicalStdDev;
    
    console.log('Mood trend analysis:', {
      supportedUserId,
      recentAvg: recentAvg.toFixed(2),
      historicalAvg: historicalAvg.toFixed(2),
      stdDev: historicalStdDev.toFixed(2),
      zScore: zScore.toFixed(2),
      recentCount: recentSignals.length,
      historicalCount: historicalSignals.length,
    });

    return Number(zScore.toFixed(3));
  } catch (error) {
    console.error('Error calculating mood change Z-score:', error);
    return null;
  }
}

/**
 * Calculates sleep quality trend over time
 * @param supportedUserId Customer ID
 * @param days Number of days to analyze
 * @returns Promise<{ trend: 'improving' | 'declining' | 'stable', confidence: number } | null>
 */
export async function sleepTrend(
  supportedUserId: string,
  days: number = 30
): Promise<{ trend: 'improving' | 'declining' | 'stable'; confidence: number } | null> {
  if (!isValidUUID(supportedUserId)) {
    console.error('Invalid user ID format:', supportedUserId);
    return null;
  }

  try {
    const supabase = serviceClient();
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);
    
    const { data: signals, error } = await supabase
      .from('app.signals')
      .select('value, captured_at')
      .eq('customer_id', supportedUserId)
      .eq('type', 'sleep')
      .gte('captured_at', daysAgo.toISOString())
      .order('captured_at', { ascending: true });

    if (error) {
      console.error('Error fetching sleep signals:', error);
      return null;
    }

    if (!signals || signals.length < 5) {
      return null;
    }

    const sleepToScore = {
      'very_poor': 1,
      'poor': 2,
      'fair': 3,
      'good': 4,
      'excellent': 5,
    };

    const numericSignals = signals
      .map((s, index) => ({
        score: sleepToScore[s.value as keyof typeof sleepToScore],
        index,
      }))
      .filter(s => s.score !== undefined);

    if (numericSignals.length < 5) {
      return null;
    }

    // Calculate linear regression slope
    const n = numericSignals.length;
    const sumX = numericSignals.reduce((sum, s) => sum + s.index, 0);
    const sumY = numericSignals.reduce((sum, s) => sum + s.score, 0);
    const sumXY = numericSignals.reduce((sum, s) => sum + s.index * s.score, 0);
    const sumXX = numericSignals.reduce((sum, s) => sum + s.index * s.index, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Calculate correlation coefficient for confidence
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = numericSignals.reduce((sum, s) => sum + (s.index - meanX) * (s.score - meanY), 0);
    const denomX = Math.sqrt(numericSignals.reduce((sum, s) => sum + Math.pow(s.index - meanX, 2), 0));
    const denomY = Math.sqrt(numericSignals.reduce((sum, s) => sum + Math.pow(s.score - meanY, 2), 0));
    
    const correlation = denomX === 0 || denomY === 0 ? 0 : numerator / (denomX * denomY);
    const confidence = Math.abs(correlation);

    let trend: 'improving' | 'declining' | 'stable';
    if (Math.abs(slope) < 0.1) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'improving';
    } else {
      trend = 'declining';
    }

    return { trend, confidence: Number(confidence.toFixed(3)) };
  } catch (error) {
    console.error('Error calculating sleep trend:', error);
    return null;
  }
}

/**
 * Detects anomalies across multiple signal types
 * @param supportedUserId Customer ID
 * @param signalTypes Types of signals to analyze
 * @param lookbackDays Days to look back for comparison
 * @returns Promise<Array<{ type: string, anomaly_score: number, severity: string }>>
 */
export async function detectAnomalies(
  supportedUserId: string,
  signalTypes: string[] = ['mood', 'sleep', 'pain'],
  lookbackDays: number = 30
): Promise<Array<{ type: string; anomaly_score: number; severity: string }>> {
  if (!isValidUUID(supportedUserId)) {
    console.error('Invalid user ID format:', supportedUserId);
    return [];
  }

  const anomalies: Array<{ type: string; anomaly_score: number; severity: string }> = [];

  try {
    const supabase = serviceClient();
    
    for (const signalType of signalTypes) {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - lookbackDays);
      
      const { data: signals, error } = await supabase
        .from('app.signals')
        .select('value, captured_at')
        .eq('customer_id', supportedUserId)
        .eq('type', signalType)
        .gte('captured_at', daysAgo.toISOString())
        .order('captured_at', { ascending: false });

      if (error || !signals || signals.length < 10) {
        continue;
      }

      // Simple anomaly detection based on standard deviation
      const values = signals.map(s => parseFloat(s.value) || 0).filter(v => !isNaN(v));
      
      if (values.length < 10) continue;

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      // Check recent values (last 3 days)
      const recentValues = values.slice(0, Math.min(5, values.length));
      const recentMean = recentValues.reduce((sum, v) => sum + v, 0) / recentValues.length;

      if (stdDev > 0) {
        const zScore = Math.abs(recentMean - mean) / stdDev;
        
        if (zScore > 1.5) {
          let severity = 'low';
          if (zScore > 2.5) severity = 'high';
          else if (zScore > 2.0) severity = 'medium';

          anomalies.push({
            type: signalType,
            anomaly_score: Number(zScore.toFixed(3)),
            severity,
          });
        }
      }
    }

    return anomalies;
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    return [];
  }
}