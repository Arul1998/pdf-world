import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { toolCategories, getToolsByCategory } from '@/lib/tool-definitions';
import { Logo } from '@/components/Logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

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

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 glass-strong">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="hover:opacity-90 transition-opacity">
          <Logo iconClassName="h-8 w-8" />
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {toolCategories.map(category => {
            const categoryTools = getToolsByCategory(category.id);
            return (
              <DropdownMenu key={category.id}>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all duration-200">
                    {category.name}
                    <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="start" 
                  className="w-64 max-h-80 overflow-y-auto bg-card border border-border shadow-xl z-[100]"
                >
                  {categoryTools.map(tool => {
                    const Icon = tool.icon;
                    return (
                      <DropdownMenuItem key={tool.id} asChild disabled={tool.comingSoon}>
                        <Link 
                          to={tool.comingSoon ? '#' : tool.path}
                          className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                        >
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="flex-1">{tool.name}</span>
                          {tool.comingSoon && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Soon</Badge>
                          )}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
          <Link to="/contact">
            <Button variant="ghost" size="sm" className="ml-2 rounded-xl h-9 px-5 text-muted-foreground hover:text-foreground">
              Contact
            </Button>
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-9 w-9 rounded-xl"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-border bg-card/95 backdrop-blur-lg animate-slide-down max-h-[80vh] overflow-y-auto">
          <nav className="container py-4 flex flex-col gap-2">
            {toolCategories.map(category => {
              const categoryTools = getToolsByCategory(category.id);
              return (
                <div key={category.id} className="space-y-1">
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {category.name}
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {categoryTools.map(tool => {
                      const Icon = tool.icon;
                      return (
                        <Link
                          key={tool.id}
                          to={tool.comingSoon ? '#' : tool.path}
                          onClick={() => !tool.comingSoon && setMobileMenuOpen(false)}
                          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            tool.comingSoon 
                              ? 'text-muted-foreground/50 cursor-not-allowed' 
                              : 'text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="truncate">{tool.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="outline" className="w-full mt-3 rounded-xl">
                Contact Us
              </Button>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
};
