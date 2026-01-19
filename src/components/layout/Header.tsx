import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';

const navItems = [
  { label: 'Organize PDF', sectionId: 'organize' },
  { label: 'Optimize PDF', sectionId: 'optimize' },
  { label: 'Convert to PDF', sectionId: 'convert-to' },
  { label: 'Convert from PDF', sectionId: 'convert-from' },
  { label: 'Edit PDF', sectionId: 'edit' },
  { label: 'PDF Security', sectionId: 'security' },
];

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const scrollToSection = useCallback((sectionId: string) => {
    setMobileMenuOpen(false);
    
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [location.pathname, navigate]);

  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  }, [location.pathname, navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, sectionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      scrollToSection(sectionId);
    }
  }, [scrollToSection]);

  return (
    <header 
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md"
      role="banner"
    >
      <div className="container flex h-14 items-center justify-between">
        <a 
          href="/" 
          onClick={handleLogoClick} 
          className="hover:opacity-90 transition-opacity cursor-pointer"
          aria-label="PDF World - Go to homepage"
        >
          <Logo iconClassName="h-7 w-7" />
        </a>

        {/* Desktop Navigation */}
        <nav 
          className="hidden lg:flex items-center gap-5"
          role="navigation"
          aria-label="Main navigation"
        >
          {navItems.map(item => (
            <button
              key={item.sectionId}
              onClick={() => scrollToSection(item.sectionId)}
              onKeyDown={(e) => handleKeyDown(e, item.sectionId)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1"
              aria-label={`Navigate to ${item.label} section`}
            >
              {item.label}
            </button>
          ))}
          <Link 
            to="/contact" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-2 py-1"
          >
            Contact
          </Link>
          <ThemeToggle />
        </nav>

        {/* Mobile: Theme Toggle + Menu Button */}
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <nav 
          id="mobile-navigation"
          className="lg:hidden border-t border-border bg-background"
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div className="container py-4 flex flex-col gap-1">
            {navItems.map(item => (
              <button
                key={item.sectionId}
                onClick={() => scrollToSection(item.sectionId)}
                onKeyDown={(e) => handleKeyDown(e, item.sectionId)}
                className="px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`Navigate to ${item.label} section`}
              >
                {item.label}
              </button>
            ))}
            <Link
              to="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Contact
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
};
