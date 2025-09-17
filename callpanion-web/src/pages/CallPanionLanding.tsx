import React, { useState, useEffect } from 'react';
import { Heart, Shield, Clock, Users, CheckCircle, Mail, Phone, ArrowRight, Facebook, Instagram } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface SiteContent {
  hero_headline: string;
  hero_subhead: string;
  social_proof_enabled: string;
  social_proof_text: string;
}


const CallPanionLanding: React.FC = () => {
  const { user } = useAuth();
  const [siteContent, setSiteContent] = useState<SiteContent>({
    hero_headline: 'Near, when you are far.',
    hero_subhead: 'AI wellbeing calls and a private family dashboard to help older adults live well at home.',
    social_proof_enabled: 'false',
    social_proof_text: ''
  });

  // Microsoft Forms URL
  const formsUrl = "https://forms.office.com/Pages/ResponsePage.aspx?id=DQSIkWdsW0yxEjajBLZtrQAAAAAAAAAAAAZ__sJYrcdUNjEyTzNMSVBHNFBDQjlGNVhPWEtJTTVCTy4u";

  useEffect(() => {
    // Load site content from database
    loadSiteContent();
    
    // Preload hero image to prevent flickering
    const heroImage = new Image();
    heroImage.src = '/src/assets/hero-warmth.jpg';
  }, []);

  const loadSiteContent = async () => {
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('key, value');
      
      if (!error && data) {
        const content: any = {};
        data.forEach(item => {
          content[item.key] = item.value;
        });
        setSiteContent(prev => ({ ...prev, ...content }));
      }
    } catch (error) {
      console.error('Error loading site content:', error);
    }
  };


  return (
    <>
      <div className="min-h-screen" style={{ backgroundColor: 'var(--callpanion-cream)' }}>
        {/* Header */}
        <header className="sticky top-0 z-50 bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 py-5 md:py-6 flex items-center justify-between">
            <div className="flex items-center">
              <picture>
                <source 
                  srcSet="/lovable-uploads/38e53f64-a857-4a09-bd7b-3fd6af6d66ed.webp" 
                  type="image/webp"
                  width="64"
                  height="64"
                />
                <img 
                  src="/lovable-uploads/38e53f64-a857-4a09-bd7b-3fd6af6d66ed.png" 
                  alt="CallPanion - Near, When You Are Far" 
                  className="h-14 w-14 md:h-16 md:w-16 mr-3"
                  width="64"
                  height="64"
                  loading="eager"
                />
              </picture>
              <span 
                className="text-3xl md:text-4xl font-bold" 
                style={{ color: 'var(--callpanion-green)' }}
              >
                CallPanion
              </span>
            </div>
            <nav className="flex items-center space-x-4">
              {user ? (
                <Link to="/dashboard">
                  <Button 
                    size="sm" 
                    className="font-semibold"
                    style={{ 
                      backgroundColor: 'var(--callpanion-green)',
                      color: 'white'
                    }}
                  >
                    Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/auth">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="font-semibold"
                    >
                      Sign Up
                    </Button>
                  </Link>
                  <Button 
                    onClick={() => window.open(formsUrl, '_blank', 'noopener,noreferrer')}
                    size="sm" 
                    className="font-semibold"
                    style={{ 
                      backgroundColor: 'var(--callpanion-green)',
                      color: 'white'
                    }}
                  >
                    Register Interest
                  </Button>
                </>
              )}
            </nav>
          </div>
        </header>

        {/* Hero Image Section */}
        <section className="relative">
          <div className="w-full h-80 lg:h-[460px] overflow-hidden">
            <picture>
              <source 
                srcSet="/lovable-uploads/999e3615-6a7f-4d82-ba06-a6b0bf749a85.webp" 
                type="image/webp"
                width="1920"
                height="500"
              />
              <img
                src="/lovable-uploads/999e3615-6a7f-4d82-ba06-a6b0bf749a85.png"
                alt="Older adult enjoying peaceful time outdoors in nature"
                className="w-full h-full object-cover"
                width="1920"
                height="500"
                loading="eager"
                fetchPriority="high"
              />
            </picture>
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          </div>
        </section>

        {/* Hero Content Section */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 
              className="text-5xl lg:text-6xl font-bold mb-6 leading-tight"
              style={{ 
                color: 'var(--callpanion-green)',
                fontFamily: "'Playfair Display', serif"
              }}
            >
              {siteContent.hero_headline}
            </h1>
            <p 
              className="text-lg lg:text-xl mb-8 font-medium leading-relaxed"
              style={{ color: 'var(--callpanion-charcoal)' }}
            >
              Nothing replaces family. CallPanion is your extra layer of care when life means you can't be there in person.
            </p>
            <h2 
              className="text-xl lg:text-2xl mb-12 leading-relaxed"
              style={{ color: 'var(--callpanion-charcoal)' }}
            >
              {siteContent.hero_subhead}
            </h2>

            {/* Sign Up CTA moved to header */}

            {/* Call to Action Button */}
            <div className="max-w-2xl mx-auto">
              {user ? (
                <Link to="/dashboard">
                  <Button 
                    size="lg"
                    className="font-semibold text-lg px-8 py-4 h-auto"
                    style={{ 
                      backgroundColor: 'var(--callpanion-green)',
                      color: 'white'
                    }}
                  >
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Link to="/auth">
                      <Button 
                        size="lg"
                        className="font-semibold text-lg px-8 py-4 h-auto w-full sm:w-auto"
                        style={{ 
                          backgroundColor: 'var(--callpanion-green)',
                          color: 'white'
                        }}
                      >
                        Get Started Today
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    <Button 
                      onClick={() => window.open(formsUrl, '_blank', 'noopener,noreferrer')}
                      size="lg"
                      variant="outline"
                      className="font-semibold text-lg px-8 py-4 h-auto w-full sm:w-auto"
                    >
                      Join Waitlist
                    </Button>
                  </div>
                  <p 
                    className="text-sm mt-4 text-center"
                    style={{ color: 'var(--callpanion-charcoal)' }}
                  >
                    Start your free trial today or join our waitlist
                  </p>
                </>
              )}
            </div>
          </div>
        </section>


        {/* Benefits Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--callpanion-green)' }}
                >
                  <Phone className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--callpanion-green)' }}>
                  Friendly AI wellbeing calls
                </h3>
                <p className="text-sm" style={{ color: 'var(--callpanion-charcoal)' }}>
                  Personalised to interests and preferences.
                </p>
              </div>

              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--callpanion-green)' }}
                >
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--callpanion-green)' }}>
                  Private family dashboard
                </h3>
                <p className="text-sm" style={{ color: 'var(--callpanion-charcoal)' }}>
                  Simple, secure, UK-hosted platform.
                </p>
              </div>

              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--callpanion-green)' }}
                >
                  <Clock className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--callpanion-green)' }}>
                  Optional wearable integration
                </h3>
                <p className="text-sm" style={{ color: 'var(--callpanion-charcoal)' }}>
                  Spot changes early with gentle monitoring.
                </p>
              </div>

              <div className="text-center">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--callpanion-green)' }}
                >
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--callpanion-green)' }}>
                  Peace of mind
                </h3>
                <p className="text-sm" style={{ color: 'var(--callpanion-charcoal)' }}>
                  Gentle check-ins, fewer "are you OK?" texts.
                </p>
              </div>
            </div>
          </div>
        </section>


        {/* Social Proof */}
        {siteContent.social_proof_enabled === 'true' && (
          <section className="py-12 px-4 bg-white">
            <div className="max-w-4xl mx-auto text-center">
              <p 
                className="text-lg font-medium"
                style={{ color: 'var(--callpanion-gold)' }}
              >
                {siteContent.social_proof_text}
              </p>
            </div>
          </section>
        )}

        {/* How It Works */}
        <section className="py-16 px-4" style={{ backgroundColor: 'var(--callpanion-cream)' }}>
          <div className="max-w-4xl mx-auto text-center">
            <h2 
              className="text-3xl lg:text-4xl font-bold mb-12"
              style={{ 
                color: 'var(--callpanion-green)',
                fontFamily: "'Playfair Display', serif"
              }}
            >
              How it works
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl"
                  style={{ backgroundColor: 'var(--callpanion-gold)' }}
                >
                  1
                </div>
                <p className="text-lg" style={{ color: 'var(--callpanion-charcoal)' }}>
                  Choose call times that suit your loved one.
                </p>
              </div>

              <div className="text-center">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl"
                  style={{ backgroundColor: 'var(--callpanion-gold)' }}
                >
                  2
                </div>
                <p className="text-lg" style={{ color: 'var(--callpanion-charcoal)' }}>
                  AI checks in, listens and summarises mood & wellbeing.
                </p>
              </div>

              <div className="text-center">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-xl"
                  style={{ backgroundColor: 'var(--callpanion-gold)' }}
                >
                  3
                </div>
                <p className="text-lg" style={{ color: 'var(--callpanion-charcoal)' }}>
                  Family sees insights and gentle alerts in one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 bg-white border-t">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <div className="flex items-center space-x-6">
                <Link 
                  to="/privacy"
                  className="text-sm hover:opacity-70"
                  style={{ color: 'var(--callpanion-charcoal)' }}
                >
                  Privacy Policy
                </Link>
                <Link 
                  to="/terms"
                  className="text-sm hover:opacity-70"
                  style={{ color: 'var(--callpanion-charcoal)' }}
                >
                  Terms of Use
                </Link>
                <Link 
                  to="/cookies"
                  className="text-sm hover:opacity-70"
                  style={{ color: 'var(--callpanion-charcoal)' }}
                >
                  Cookies
                </Link>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <a 
                    href="https://facebook.com/CallPanion" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                    aria-label="Follow CallPanion on Facebook"
                  >
                    <Facebook 
                      className="h-5 w-5" 
                      style={{ color: 'var(--callpanion-green)' }}
                    />
                  </a>
                  <a 
                    href="https://instagram.com/CallPanion" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:opacity-70 transition-opacity"
                    aria-label="Follow CallPanion on Instagram"
                  >
                    <Instagram 
                      className="h-5 w-5" 
                      style={{ color: 'var(--callpanion-green)' }}
                    />
                  </a>
                </div>
                
                <p 
                  className="text-sm"
                  style={{ color: 'var(--callpanion-charcoal)' }}
                >
                  © CallPanion Ltd, All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
};

export default CallPanionLanding;