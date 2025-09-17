import { serviceClient } from './client.ts';
import { isValidUUID } from './util.ts';

/**
 * Consent-related utility functions
 */

/**
 * Checks if we can store transcript data for a given user
 * @param userId User ID to check consent for
 * @returns Promise<boolean> True if transcript storage is consented
 */
export async function canStoreTranscript(userId: string): Promise<boolean> {
  if (!isValidUUID(userId)) {
    console.error('Invalid user ID format:', userId);
    return false;
  }

  try {
    const supabase = serviceClient();
    
    // Check if there's an active consent record for data processing
    const { data: consents, error } = await supabase
      .from('app.consent_settings')
      .select('type, status, updated_at')
      .eq('customer_id', userId)
      .eq('type', 'DATA_PROCESSING')
      .eq('status', 'GRANTED')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Error checking consent:', error);
      return false;
    }

    // If no consent record found, default to not allowing storage
    if (!consents || consents.length === 0) {
      console.log('No data processing consent found for user:', userId);
      return false;
    }

    const latestConsent = consents[0];
    
    // Check if consent is still valid (not older than 1 year)
    const consentDate = new Date(latestConsent.updated_at);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (consentDate < oneYearAgo) {
      console.log('Consent expired for user:', userId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error checking consent:', error);
    return false;
  }
}

/**
 * Checks if we can process health data for a given user
 * @param userId User ID to check consent for
 * @returns Promise<boolean> True if health data processing is consented
 */
export async function canProcessHealthData(userId: string): Promise<boolean> {
  if (!isValidUUID(userId)) {
    console.error('Invalid user ID format:', userId);
    return false;
  }

  try {
    const supabase = serviceClient();
    
    // Check for health data processing consent
    const { data: consents, error } = await supabase
      .from('app.consent_settings')
      .select('type, status, updated_at')
      .eq('customer_id', userId)
      .in('type', ['HEALTH_MONITORING', 'DATA_PROCESSING'])
      .eq('status', 'GRANTED')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error checking health data consent:', error);
      return false;
    }

    // Need both health monitoring and data processing consent
    const healthConsent = consents?.find(c => c.type === 'HEALTH_MONITORING');
    const dataConsent = consents?.find(c => c.type === 'DATA_PROCESSING');
    
    if (!healthConsent || !dataConsent) {
      console.log('Missing required health data consents for user:', userId);
      return false;
    }

    // Check if consents are still valid (not older than 1 year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const healthConsentDate = new Date(healthConsent.updated_at);
    const dataConsentDate = new Date(dataConsent.updated_at);
    
    if (healthConsentDate < oneYearAgo || dataConsentDate < oneYearAgo) {
      console.log('Health data consents expired for user:', userId);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Unexpected error checking health data consent:', error);
    return false;
  }
}

/**
 * Records that consent was checked for audit purposes
 * @param userId User ID
 * @param consentType Type of consent checked
 * @param result Result of consent check
 * @param context Additional context
 */
export async function logConsentCheck(
  userId: string,
  consentType: string,
  result: boolean,
  context?: string
): Promise<void> {
  try {
    const supabase = serviceClient();
    
    await supabase
      .from('app.audit_log')
      .insert({
        actor_user_id: null, // System action
        actor_email: 'system@eldercareai.com',
        action: 'consent_check',
        entity_type: 'consent',
        entity_id: userId,
        details: {
          consent_type: consentType,
          result,
          context,
          timestamp: new Date().toISOString(),
        },
      });
  } catch (error) {
    console.error('Error logging consent check:', error);
    // Don't throw - this is just for auditing
  }
}