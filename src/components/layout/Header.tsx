import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { tools } from '@/lib/tool-definitions';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get first 4 popular tools for quick access
  const popularTools = tools.filter(t => !t.comingSoon).slice(0, 4);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <Logo iconClassName="h-7 w-7" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {popularTools.map(tool => (
            <Link
              key={tool.id}
              to={tool.path}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {tool.name}
            </Link>
          ))}
          <Link to="/contact">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              Contact
            </Button>
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-9 w-9"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container py-4 flex flex-col gap-1">
            {tools.filter(t => !t.comingSoon).map(tool => (
              <Link
                key={tool.id}
                to={tool.path}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 text-sm text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                {tool.name}
              </Link>
            ))}
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full mt-3">
                Contact Us
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
