import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tool, getCategoryInfo } from '@/lib/tool-definitions';
import { Badge } from '@/components/ui/badge';

interface ToolCardProps {
  tool: Tool;
  variant?: 'default' | 'compact';
}

export const ToolCard = ({ tool, variant = 'default' }: ToolCardProps) => {
  const Icon = tool.icon;
  const categoryInfo = getCategoryInfo(tool.category);
  
  const colorClasses: Record<string, string> = {
    organize: 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground',
    optimize: 'bg-success/10 text-success group-hover:bg-success group-hover:text-success-foreground',
    'convert-to': 'bg-info/10 text-info group-hover:bg-info group-hover:text-info-foreground',
    'convert-from': 'bg-[hsl(262,83%,58%)]/10 text-[hsl(262,83%,58%)] group-hover:bg-[hsl(262,83%,58%)] group-hover:text-white',
    edit: 'bg-warning/10 text-warning group-hover:bg-warning group-hover:text-warning-foreground',
    security: 'bg-foreground/10 text-foreground group-hover:bg-foreground group-hover:text-background',
  };

  if (variant === 'compact') {
    return (
      <Link
        to={tool.comingSoon ? '#' : tool.path}
        className={cn(
          "group flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
          "bg-card border border-border hover:shadow-card-hover hover:border-transparent",
          tool.comingSoon && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200",
          colorClasses[tool.category]
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{tool.name}</p>
        </div>
        {tool.comingSoon && (
          <Badge variant="secondary" className="text-xs">Soon</Badge>
        )}
      </Link>
    );
  }

  return (
    <Link
      to={tool.comingSoon ? '#' : tool.path}
      className={cn(
        "group relative flex flex-col p-5 rounded-2xl transition-all duration-300",
        "bg-card border border-border hover:shadow-card-hover hover:border-transparent hover:-translate-y-1",
        tool.comingSoon && "opacity-60 cursor-not-allowed"
      )}
    >
      {tool.comingSoon && (
        <Badge variant="secondary" className="absolute top-3 right-3 text-xs">Coming Soon</Badge>
      )}
      
      <div className={cn(
        "flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 mb-4",
        colorClasses[tool.category]
      )}>
        <Icon className="h-6 w-6" />
      </div>
      
      <h3 className="text-base font-semibold text-foreground mb-1">{tool.name}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
    </Link>
  );
};
