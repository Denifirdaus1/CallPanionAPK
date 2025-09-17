import { aiPromptService, FamilyAlert } from './aiPrompts';

export interface FamilyContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  relationship: string;
  notificationPreferences: {
    sms: boolean;
    email: boolean;
    priority: 'all' | 'medium_high' | 'high_only';
  };
}

export interface AlertRecord {
  id: string;
  timestamp: Date;
  elderlyPersonName: string;
  speechInput: string;
  analysis: {
    status: string;
    summary: string;
    mood: string;
  };
  alert: FamilyAlert;
  sentTo: string[];
  acknowledged: boolean;
}

class FamilyAlertService {
  private alerts: AlertRecord[] = [];
  private contacts: FamilyContact[] = [];

  // In production, this would load from Supabase
  private loadContacts(): FamilyContact[] {
    const stored = localStorage.getItem('family_contacts');
    if (stored) {
      return JSON.parse(stored);
    }
    
    // Default contacts for demo
    return [
      {
        id: '1',
        name: 'Sarah (Daughter)',
        phone: '+1234567890',
        email: 'sarah@example.com',
        relationship: 'Daughter',
        notificationPreferences: {
          sms: true,
          email: true,
          priority: 'medium_high'
        }
      },
      {
        id: '2',
        name: 'Michael (Son)',
        phone: '+1987654321',
        email: 'michael@example.com',
        relationship: 'Son',
        notificationPreferences: {
          sms: true,
          email: false,
          priority: 'high_only'
        }
      }
    ];
  }

  private saveContacts(contacts: FamilyContact[]): void {
    localStorage.setItem('family_contacts', JSON.stringify(contacts));
  }

  private saveAlerts(): void {
    localStorage.setItem('family_alerts', JSON.stringify(this.alerts));
  }

  private loadAlerts(): void {
    const stored = localStorage.getItem('family_alerts');
    if (stored) {
      this.alerts = JSON.parse(stored).map((alert: any) => ({
        ...alert,
        timestamp: new Date(alert.timestamp)
      }));
    }
  }

  constructor() {
    this.contacts = this.loadContacts();
    this.loadAlerts();
  }

  async processCallAndAlert(elderlyPersonName: string, speechInput: string): Promise<AlertRecord> {
    try {
      // Generate AI analysis and alert
      const [analysis, moodTag, familyAlert] = await Promise.all([
        aiPromptService.analyzeConversation(elderlyPersonName, speechInput),
        aiPromptService.tagMood(speechInput),
        aiPromptService.generateFamilyAlert(elderlyPersonName, speechInput)
      ]);

      // Create alert record
      const alertRecord: AlertRecord = {
        id: Date.now().toString(),
        timestamp: new Date(),
        elderlyPersonName,
        speechInput,
        analysis: {
          status: analysis.status,
          summary: analysis.summary,
          mood: moodTag.mood
        },
        alert: familyAlert,
        sentTo: [],
        acknowledged: false
      };

      // Determine who should receive this alert
      const eligibleContacts = this.getEligibleContacts(familyAlert.priority);
      
      // Send notifications
      for (const contact of eligibleContacts) {
        await this.sendNotification(contact, alertRecord);
        alertRecord.sentTo.push(contact.id);
      }

      // Save alert
      this.alerts.unshift(alertRecord);
      this.saveAlerts();

      return alertRecord;
    } catch (error) {
      console.error('Failed to process call and alert:', error);
      throw error;
    }
  }

  private getEligibleContacts(priority: string): FamilyContact[] {
    return this.contacts.filter(contact => {
      const prefs = contact.notificationPreferences;
      switch (prefs.priority) {
        case 'all':
          return true;
        case 'medium_high':
          return priority === 'medium' || priority === 'high';
        case 'high_only':
          return priority === 'high';
        default:
          return false;
      }
    });
  }

  private async sendNotification(contact: FamilyContact, alert: AlertRecord): Promise<void> {
    // In production, this would use Supabase Edge Functions to send actual SMS/emails
    // SECURITY FIX: Remove contact details logging to prevent PII exposure

    // Simulate sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  getRecentAlerts(limit: number = 10): AlertRecord[] {
    return this.alerts.slice(0, limit);
  }

  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.saveAlerts();
    }
  }

  addContact(contact: Omit<FamilyContact, 'id'>): FamilyContact {
    const newContact: FamilyContact = {
      ...contact,
      id: Date.now().toString()
    };
    this.contacts.push(newContact);
    this.saveContacts(this.contacts);
    return newContact;
  }

  updateContact(id: string, updates: Partial<FamilyContact>): void {
    const index = this.contacts.findIndex(c => c.id === id);
    if (index !== -1) {
      this.contacts[index] = { ...this.contacts[index], ...updates };
      this.saveContacts(this.contacts);
    }
  }

  removeContact(id: string): void {
    this.contacts = this.contacts.filter(c => c.id !== id);
    this.saveContacts(this.contacts);
  }

  getContacts(): FamilyContact[] {
    return this.contacts;
  }
}

export const familyAlertService = new FamilyAlertService();