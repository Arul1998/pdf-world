import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToolLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  category: string;
  categoryColor: string;
  children: ReactNode;
}

export const ToolLayout = ({
  title,
  description,
  icon: Icon,
  category,
  categoryColor,
  children,
}: ToolLayoutProps) => {
  const colorClasses: Record<string, string> = {
    organize: 'bg-primary/10 text-primary',
    optimize: 'bg-success/10 text-success',
    'convert-to': 'bg-info/10 text-info',
    'convert-from': 'bg-[hsl(262,83%,58%)]/10 text-[hsl(262,83%,58%)]',
    edit: 'bg-warning/10 text-warning',
    security: 'bg-foreground/10 text-foreground',
  };

  return (
    <Layout>
      <div className="container py-8 md:py-12 max-w-7xl mx-auto px-4 lg:px-8">
        {/* Back Link */}
        <Button variant="ghost" asChild className="mb-6 -ml-2">
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            All Tools
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl shrink-0",
            colorClasses[categoryColor]
          )}>
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1 capitalize">{category.replace('-', ' ')}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
            <p className="text-muted-foreground mt-1">{description}</p>
          </div>
        </div>

        {/* Content */}
        <div>
          {children}
        </div>
      </div>
    </Layout>
  );
};
