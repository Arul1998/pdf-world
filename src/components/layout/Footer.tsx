import { Github, Shield, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/Logo';

export const Footer = () => {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link to="/" className="inline-block mb-4">
              <Logo iconClassName="h-7 w-7" />
            </Link>
            <p className="text-muted-foreground text-sm max-w-sm">
              Free, open-source PDF tools that work 100% in your browser. 
              Your files never leave your device.
            </p>
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

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Popular Tools</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/tools/merge" className="text-muted-foreground hover:text-foreground transition-colors">Merge PDF</Link></li>
              <li><Link to="/tools/split" className="text-muted-foreground hover:text-foreground transition-colors">Split PDF</Link></li>
              <li><Link to="/tools/compress" className="text-muted-foreground hover:text-foreground transition-colors">Compress PDF</Link></li>
              <li><Link to="/tools/rotate" className="text-muted-foreground hover:text-foreground transition-colors">Rotate PDF</Link></li>
            </ul>
          </div>

          {/* Info */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">About</h4>
            <ul className="space-y-2 text-sm">
              <li className="text-muted-foreground">Built with pdf-lib & PDF.js</li>
              <li className="text-muted-foreground">Client-side processing only</li>
              <li className="text-muted-foreground">Auto-delete on refresh</li>
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="h-4 w-4" />
                  Open Source
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} PDF World. Free forever. No account required.</p>
        </div>
      </div>
    </footer>
  );
};
