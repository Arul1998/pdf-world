import { Shield, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { tools, toolCategories, getToolsByCategory } from '@/lib/tool-definitions';

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="container py-12">
        {/* Brand Section */}
        <div className="mb-10">
          <Link to="/" className="inline-block mb-4">
            <Logo iconClassName="h-7 w-7" />
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <p className="text-muted-foreground text-sm max-w-sm">
              Free online PDF tools that work 100% in your browser. 
              Your files never leave your device.
            </p>
            <ul className="flex flex-wrap gap-6 text-sm">
              <li><Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</Link></li>
              <li><Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">Terms</Link></li>
              <li><Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">FAQ</Link></li>
              <li><Link to="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-success" />
              <span>100% Private</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4 text-warning" />
              <span>No Upload</span>
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 mb-10">
          {toolCategories.map((category) => {
            const categoryTools = getToolsByCategory(category.id);
            return (
              <div key={category.id}>
                <h4 className="font-semibold text-foreground mb-4 text-sm">{category.name}</h4>
                <ul className="space-y-2 text-sm">
                  {categoryTools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <li key={tool.id}>
                        <Link 
                          to={tool.path} 
                          className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {tool.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Copyright */}
        <div className="pt-8 border-t border-border">
          <p className="text-sm text-muted-foreground text-center">
            © 2025 PDF World. Free forever. No account required.
          </p>
        </div>
      </div>
    </footer>
  );
};
