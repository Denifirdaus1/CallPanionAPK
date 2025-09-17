import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Heart className="h-6 w-6 text-primary" />
              <span className="text-xl font-semibold text-foreground">Callpanion</span>
            </div>
            <p className="text-muted-foreground mb-4">
              Keeping families connected with love, care, and the warmth of regular contact.
            </p>
            <p className="text-sm text-muted-foreground">
              © 2025 Gail Cook Consulting (trading as CallPanion). All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Sole Trader • 10 Ballinderry Road, Aghalee, BT67 0DZ, Northern Ireland
            </p>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  to="/legal/privacy" 
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/terms" 
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  Terms of Use
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/cookies" 
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/accessibility" 
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  Accessibility
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/health-disclaimer" 
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  Health Disclaimer
                </Link>
              </li>
              <li>
                <Link 
                  to="/legal/family-consent" 
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  Family Consent
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground mb-4">Support</h3>
            <ul className="space-y-2">
               <li>
                 <a 
                   href="mailto:privacy@callpanion.co.uk" 
                   className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                 >
                   Privacy Enquiries
                 </a>
               </li>
               <li>
                 <a 
                   href="mailto:support@callpanion.co.uk" 
                   className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                 >
                   General Support
                 </a>
               </li>
              <li>
                <a 
                  href="https://ico.org.uk" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  ICO (Data Protection)
                </a>
              </li>
              <li>
                <a 
                  href="mailto:security@callpanion.co.uk" 
                  className="text-sm text-muted-foreground hover:text-brand-accent transition-colors"
                >
                  Report a vulnerability
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-8 pt-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              UK GDPR compliant • Data stored securely in UK/EU • Your privacy rights protected
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">
                UK Trading Business • Not VAT Registered
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;