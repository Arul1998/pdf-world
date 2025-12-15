import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toolCategories } from '@/lib/tool-definitions';
import logoIcon from '@/assets/logo-icon.png';

export const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 glass-strong">
      <div className="container flex h-18 items-center justify-between py-4">
        <Link to="/" className="flex items-center gap-2.5 text-foreground hover:opacity-90 transition-opacity">
          <img src={logoIcon} alt="PDF World" className="h-9 w-9 md:h-10 md:w-10" />
          <span className="text-xl font-bold tracking-tight">PDF World</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {toolCategories.slice(0, 4).map(category => (
            <Link
              key={category.id}
              to={`/#${category.id}`}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all duration-200"
            >
              {category.name}
            </Link>
          ))}
          <Button asChild size="sm" className="ml-3 rounded-xl h-10 px-6">
            <Link to="/#all-tools">All Tools</Link>
          </Button>
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10 rounded-xl"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-lg animate-slide-down">
          <nav className="container py-4 flex flex-col gap-1">
            {toolCategories.map(category => (
              <Link
                key={category.id}
                to={`/#${category.id}`}
                className="px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {category.name}
              </Link>
            ))}
            <Button asChild className="mt-2 rounded-xl">
              <Link to="/#all-tools" onClick={() => setMobileMenuOpen(false)}>
                View All Tools
              </Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};
