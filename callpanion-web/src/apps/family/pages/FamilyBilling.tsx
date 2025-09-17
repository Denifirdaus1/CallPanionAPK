import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Download, Eye, Calendar, ExternalLink, Loader2 } from 'lucide-react';
import { useStripeBilling } from '@/hooks/useStripeBilling';
import { useStripeSubscription } from '@/hooks/useStripeSubscription';
import StripeSubscription from '@/components/StripeSubscription';
import { toast } from 'sonner';

const FamilyBilling = () => {
  const { billingData, isLoading, error, openCustomerPortal } = useStripeBilling();
  const { subscriptionData } = useStripeSubscription();

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
      case 'void':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleManageSubscription = async () => {
    try {
      await openCustomerPortal();
    } catch (err) {
      toast.error('Failed to open billing portal. Please try again.');
    }
  };

  const handleViewInvoice = (url: string) => {
    window.open(url, '_blank');
  };

  const handleDownloadInvoice = (url: string) => {
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your CallPanion subscription and view usage
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Error loading billing data: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!billingData?.hasStripeCustomer) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Start your CallPanion subscription to access all features
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>No Active Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You don't have an active subscription yet. Subscribe to access all CallPanion features.
            </p>
            <StripeSubscription />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { subscription, invoices, paymentMethod } = billingData;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your CallPanion subscription and view usage
        </p>
      </div>

      {/* Current Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-500" />
            Current Subscription
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subscription ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium mb-2">Plan Details</h4>
                <div className="space-y-1">
                  <p className="text-2xl font-bold">{subscription.product.name}</p>
                  <p className="text-muted-foreground">
                    {formatAmount(subscription.price.amount, subscription.price.currency)}/{subscription.price.interval}
                  </p>
                  <Badge className={getStatusColor(subscription.status)}>
                    {subscription.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Current Period</h4>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Started: {subscription.currentPeriodStart.toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Renews: {subscription.currentPeriodEnd.toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Next Billing</h4>
                <div className="space-y-1">
                  <p className="text-lg font-semibold">
                    {subscription.currentPeriodEnd.toLocaleDateString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Auto-renewal enabled
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No active subscription found</p>
              <StripeSubscription />
            </div>
          )}
          
          <div className="flex space-x-4 mt-6">
            <Button onClick={handleManageSubscription} className="flex items-center gap-2">
              Manage Subscription
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length > 0 ? (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{invoice.number || invoice.id}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.created.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="font-medium">
                          {formatAmount(invoice.amount, invoice.currency)}
                        </p>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <div className="flex space-x-1">
                        {invoice.hostedInvoiceUrl && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleViewInvoice(invoice.hostedInvoiceUrl)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        {invoice.invoicePdf && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDownloadInvoice(invoice.invoicePdf)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">No invoices found</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethod?.card ? (
              <div className="p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="font-medium">
                      •••• •••• •••• {paymentMethod.card.last4}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {paymentMethod.card.brand.toUpperCase()} • Expires {paymentMethod.card.expMonth}/{paymentMethod.card.expYear}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 border rounded-lg text-center">
                <p className="text-muted-foreground">No payment method on file</p>
              </div>
            )}
            
            <Button 
              variant="outline" 
              className="w-full flex items-center gap-2"
              onClick={handleManageSubscription}
            >
              Update Payment Details
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FamilyBilling;