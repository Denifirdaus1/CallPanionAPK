/**
 * Utility functions for date/time handling and common operations
 */

/**
 * Gets current time in London timezone formatted as HH:MM
 * @returns Time string in HH:MM format (24-hour)
 */
export function londonHHMM(): string {
  const now = new Date();
  
  // Convert to London timezone
  const londonTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  
  return londonTime;
}

/**
 * Checks if the current time is within a specified window of a target time
 * @param target Target time in HH:MM format (24-hour)
 * @param now Current time in HH:MM format (24-hour), defaults to current London time
 * @param windowMins Window in minutes (±)
 * @returns True if current time is within the window
 */
export function withinWindow(target: string, now?: string, windowMins: number = 30): boolean {
  const currentTime = now || londonHHMM();
  
  // Parse time strings
  const parseTime = (timeStr: string): { hours: number; minutes: number } => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw new Error(`Invalid time format: ${timeStr}. Expected HH:MM`);
    }
    return { hours, minutes };
  };
  
  try {
    const targetTime = parseTime(target);
    const currentTimeParsed = parseTime(currentTime);
    
    // Convert to minutes since midnight
    const targetMinutes = targetTime.hours * 60 + targetTime.minutes;
    const currentMinutes = currentTimeParsed.hours * 60 + currentTimeParsed.minutes;
    
    // Calculate difference, handling day boundary
    let diff = Math.abs(currentMinutes - targetMinutes);
    
    // Handle case where times are on opposite sides of midnight
    const dayMinutes = 24 * 60;
    if (diff > dayMinutes / 2) {
      diff = dayMinutes - diff;
    }
    
    return diff <= windowMins;
  } catch (error) {
    console.error('Error in withinWindow:', error);
    return false;
  }
}

/**
 * Converts a Date object to London timezone ISO string
 * @param date Date to convert
 * @returns ISO string in London timezone
 */
export function toLondonISO(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date).replace(' ', 'T') + 'Z';
}

/**
 * Safely parses JSON with error handling
 * @param jsonString JSON string to parse
 * @param fallback Fallback value if parsing fails
 * @returns Parsed object or fallback
 */
export function safeJsonParse<T>(jsonString: string, fallback: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return fallback;
  }
}

/**
 * Generates a simple hash of a string (for non-cryptographic purposes)
 * @param str String to hash
 * @returns Simple hash number
 */
export function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Validates UUID format
 * @param uuid String to validate
 * @returns True if valid UUID format
 */
export function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}