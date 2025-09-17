import { useState, useMemo, useEffect } from "react";
import { Search, Mail, ChevronDown, ChevronUp, HelpCircle, Users, Send, Clock, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Priority = 'P1' | 'P2' | 'P3';

interface SupportFormData {
  subject: string;
  message: string;
  priority: Priority;
  category: string;
  contact_email: string;
  contact_phone: string;
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistName, setWaitlistName] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistConsent, setWaitlistConsent] = useState(false);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  
  // Support ticket form state
  const [supportForm, setSupportForm] = useState<SupportFormData>({
    subject: '',
    message: '',
    priority: 'P3',
    category: 'general',
    contact_email: '',
    contact_phone: ''
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSubmitted, setTicketSubmitted] = useState<string | null>(null);
  
  const { toast } = useToast();

  // Load FAQs when modal opens
  useEffect(() => {
    if (open && faqs.length === 0) {
      loadFaqs();
    }
  }, [open, faqs.length]);

  // Load user email when modal opens
  useEffect(() => {
    if (open) {
      loadUserEmail();
    }
  }, [open]);

  const loadUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setSupportForm(prev => ({ ...prev, contact_email: user.email || '' }));
    }
  };

  const loadFaqs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('id, question, answer, tags')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setFaqs(data || []);
    } catch (error) {
      console.error('Error loading FAQs:', error);
      toast({
        title: "Error",
        description: "Failed to load FAQ data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter FAQs based on search query
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    
    const query = searchQuery.toLowerCase();
    return faqs.filter(faq => 
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query) ||
      faq.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  }, [faqs, searchQuery]);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!waitlistConsent) {
      toast({
        title: "Consent Required",
        description: "Please agree to receive updates to continue",
        variant: "destructive",
      });
      return;
    }

    setSubmittingWaitlist(true);
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({
          email: waitlistEmail,
          consent: waitlistConsent,
          consent_text: "I agree to receive updates about CallPanion. I can unsubscribe at any time."
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "You've been added to our waitlist. We'll be in touch soon!",
      });

      // Reset form
      setWaitlistName("");
      setWaitlistEmail("");
      setWaitlistConsent(false);
      setShowWaitlistForm(false);
    } catch (error: any) {
      console.error('Error submitting waitlist:', error);
      if (error.code === '23505') {
        toast({
          title: "Already Registered",
          description: "This email is already on our waitlist",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to join waitlist. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!supportForm.subject.trim() || !supportForm.message.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a subject and message",
        variant: "destructive",
      });
      return;
    }

    setSubmittingTicket(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to submit a support ticket",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('support-create-ticket', {
        body: supportForm
      });

      if (error) throw error;

      setTicketSubmitted(data.ticket.ticket_number);
      toast({
        title: "Support Ticket Created!",
        description: `Your ticket ${data.ticket.ticket_number} has been created. You'll receive a confirmation email shortly.`,
      });

      // Reset form
      setSupportForm({
        subject: '',
        message: '',
        priority: 'P3',
        category: 'general',
        contact_email: supportForm.contact_email,
        contact_phone: ''
      });
    } catch (error: any) {
      console.error('Error submitting support ticket:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create support ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const priorityInfo = {
    'P1': { 
      label: 'Critical', 
      description: 'System down, security breach, or customer safety issue',
      sla: '1 hour',
      color: 'destructive' as const,
      icon: <AlertTriangle className="h-3 w-3" />
    },
    'P2': { 
      label: 'High', 
      description: 'Major functionality impaired, multiple users affected',
      sla: '4 hours',
      color: 'secondary' as const,
      icon: <Clock className="h-3 w-3" />
    },
    'P3': { 
      label: 'Normal', 
      description: 'General questions, feature requests, minor issues',
      sla: '24 hours',
      color: 'outline' as const,
      icon: <HelpCircle className="h-3 w-3" />
    }
  };

  if (ticketSubmitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-green-600">✅ Ticket Submitted!</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <p className="text-muted-foreground">
              Your support ticket <strong>{ticketSubmitted}</strong> has been created successfully.
            </p>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">What happens next?</h4>
              <ul className="text-sm text-green-700 space-y-1 text-left">
                <li>• You'll receive a confirmation email shortly</li>
                <li>• Our team will review your request</li>
                <li>• We'll respond within our SLA timeframe</li>
                <li>• You can reply to the email to add more info</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setTicketSubmitted(null)}
                className="flex-1"
              >
                Submit Another
              </Button>
              <Button 
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">👋</span>
            Hi, I'm Callie!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-muted-foreground">
            I can help with FAQs, support tickets, or putting you in touch with our team. We provide 24/7 support for critical issues.
          </p>

          <Tabs defaultValue="faq" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="faq">📚 FAQs</TabsTrigger>
              <TabsTrigger value="support">🎫 Support Ticket</TabsTrigger>
              <TabsTrigger value="contact">📞 Contact</TabsTrigger>
            </TabsList>

            <TabsContent value="faq" className="space-y-4 mt-6">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search help topics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* FAQs */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Frequently Asked Questions</h3>
                
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading FAQs...
                  </div>
                ) : filteredFaqs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No FAQs match your search" : "No FAQs available"}
                  </div>
                ) : (
                  <Accordion type="single" collapsible className="w-full">
                    {filteredFaqs.map((faq, index) => (
                      <AccordionItem key={faq.id} value={`item-${index}`}>
                        <AccordionTrigger className="text-left">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground whitespace-pre-wrap">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </TabsContent>

            <TabsContent value="support" className="space-y-4 mt-6">
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2">🎫 Create Support Ticket</h3>
                  <p className="text-sm text-blue-700">
                    Submit a detailed support request. Our team provides 24/7 monitoring for critical issues.
                  </p>
                </div>

                <form onSubmit={handleSupportSubmit} className="space-y-4">
                  {/* Priority Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Priority Level</label>
                    <Select 
                      value={supportForm.priority} 
                      onValueChange={(value: Priority) => setSupportForm(prev => ({ ...prev, priority: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(priorityInfo).map(([key, info]) => (
                          <SelectItem key={key} value={key} className="py-3">
                            <div className="flex items-center gap-3">
                              <Badge variant={info.color} className="flex items-center gap-1">
                                {info.icon}
                                {info.label}
                              </Badge>
                              <div className="text-left">
                                <div className="font-medium">{info.sla} response</div>
                                <div className="text-xs text-muted-foreground">{info.description}</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category</label>
                    <Select 
                      value={supportForm.category} 
                      onValueChange={(value) => setSupportForm(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Question</SelectItem>
                        <SelectItem value="technical">Technical Issue</SelectItem>
                        <SelectItem value="billing">Billing & Subscriptions</SelectItem>
                        <SelectItem value="account">Account Management</SelectItem>
                        <SelectItem value="feature">Feature Request</SelectItem>
                        <SelectItem value="bug">Bug Report</SelectItem>
                        <SelectItem value="security">Security Concern</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject *</label>
                    <Input
                      value={supportForm.subject}
                      onChange={(e) => setSupportForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Brief description of your issue"
                      required
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message *</label>
                    <Textarea
                      value={supportForm.message}
                      onChange={(e) => setSupportForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Please provide detailed information about your issue, including any error messages"
                      rows={5}
                      required
                    />
                  </div>

                  {/* Contact Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Contact Email *</label>
                      <Input
                        type="email"
                        value={supportForm.contact_email}
                        onChange={(e) => setSupportForm(prev => ({ ...prev, contact_email: e.target.value }))}
                        placeholder="your.email@example.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Phone (Optional)</label>
                      <Input
                        type="tel"
                        value={supportForm.contact_phone}
                        onChange={(e) => setSupportForm(prev => ({ ...prev, contact_phone: e.target.value }))}
                        placeholder="+44 20 1234 5678"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={submittingTicket} className="w-full">
                    <Send className="h-4 w-4 mr-2" />
                    {submittingTicket ? "Creating Ticket..." : "Submit Support Ticket"}
                  </Button>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="contact" className="space-y-4 mt-6">
              {/* Help Guide Links */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  className="justify-center gap-2 h-auto p-4"
                  asChild
                >
                  <Link to="/family/help">
                    <div className="text-center">
                      <Users className="h-6 w-6 mx-auto mb-2" />
                      <div className="font-medium">Family Guide</div>
                      <div className="text-xs text-muted-foreground">Help for family members</div>
                    </div>
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="justify-center gap-2 h-auto p-4"
                  asChild
                >
                  <Link to="/elder/help">
                    <div className="text-center">
                      <HelpCircle className="h-6 w-6 mx-auto mb-2" />
                      <div className="font-medium">Elder Guide</div>
                      <div className="text-xs text-muted-foreground">Help for users</div>
                    </div>
                  </Link>
                </Button>
              </div>
              
              {/* Direct Contact */}
              <div className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-center gap-2"
                  onClick={() => window.open('mailto:support@callpanion.co.uk', '_blank')}
                >
                  <Mail className="h-4 w-4" />
                  Email Support
                </Button>

                {/* 24/7 Support Notice */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">🕐 24/7 Support Available</h4>
                  <p className="text-sm text-green-700">
                    Critical issues (P1) receive immediate attention around the clock. 
                    High priority issues (P2) are escalated to our on-call team outside business hours.
                  </p>
                </div>

                {/* Waitlist Toggle */}
                <Collapsible open={showWaitlistForm} onOpenChange={setShowWaitlistForm}>
                  <CollapsibleTrigger asChild>
                    <Button variant="default" className="w-full justify-center gap-2">
                      Join the waitlist
                      {showWaitlistForm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-4">
                    <form onSubmit={handleWaitlistSubmit} className="space-y-4">
                      <div>
                        <Input
                          placeholder="Your name"
                          value={waitlistName}
                          onChange={(e) => setWaitlistName(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Input
                          type="email"
                          placeholder="Your email"
                          value={waitlistEmail}
                          onChange={(e) => setWaitlistEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="flex items-start space-x-2">
                        <input
                          type="checkbox"
                          id="waitlist-consent"
                          checked={waitlistConsent}
                          onChange={(e) => setWaitlistConsent(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-input"
                          required
                        />
                        <label htmlFor="waitlist-consent" className="text-sm text-muted-foreground leading-relaxed">
                          I agree to receive updates about CallPanion. I can unsubscribe at any time. See our{' '}
                          <a href="/privacy" className="text-primary underline" target="_blank">Privacy Policy</a>.
                        </label>
                      </div>
                      <Button type="submit" disabled={submittingWaitlist} className="w-full">
                        {submittingWaitlist ? "Joining..." : "Join Waitlist"}
                      </Button>
                    </form>
                  </CollapsibleContent>
                </Collapsible>

                <div className="text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    <strong>Business Hours:</strong> Monday-Friday, 09:00-17:00 UK Time
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <strong>Emergency Support:</strong> Available 24/7 for critical issues
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}