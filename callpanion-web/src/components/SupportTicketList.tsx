import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Clock, User, Mail, Phone } from "lucide-react";

interface SupportTicket {
  id: string;
  ticket_number: string;
  subject: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  channel: 'APP' | 'EMAIL' | 'PHONE';
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: string | null;
  household_id: string | null;
  user_id: string | null;
  profiles?: { display_name?: string } | null;
}

export function SupportTicketList() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          profiles(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTickets(data as SupportTicket[] || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast({
        title: "Error",
        description: "Failed to load support tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const priorityColors = {
    'P1': 'destructive' as const,
    'P2': 'secondary' as const,
    'P3': 'outline' as const
  };

  const statusColors = {
    'OPEN': 'destructive' as const,
    'IN_PROGRESS': 'secondary' as const,
    'RESOLVED': 'default' as const,
    'CLOSED': 'outline' as const
  };

  if (loading) {
    return <div className="p-4 text-center">Loading support tickets...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Support Tickets</h2>
        <Button onClick={loadTickets} variant="outline">
          Refresh
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">No support tickets found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{ticket.ticket_number}</CardTitle>
                    <p className="text-sm text-muted-foreground">{ticket.subject}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={priorityColors[ticket.priority]}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant={statusColors[ticket.status as keyof typeof statusColors]}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.profiles?.display_name || 'Unknown User'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{ticket.contact_email}</span>
                  </div>
                  {ticket.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{ticket.contact_phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    {ticket.channel} • Created {new Date(ticket.created_at).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}