import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tool, getCategoryInfo } from '@/lib/tool-definitions';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

interface ToolCardProps {
  tool: Tool;
  variant?: 'default' | 'compact';
}

export const ToolCard = ({ tool, variant = 'default' }: ToolCardProps) => {
  const Icon = tool.icon;
  const categoryInfo = getCategoryInfo(tool.category);
  
  const colorClasses: Record<string, { icon: string; hover: string; glow: string }> = {
    organize: { 
      icon: 'bg-primary/10 text-primary',
      hover: 'group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-lg group-hover:shadow-primary/20',
      glow: 'group-hover:ring-primary/20'
    },
    optimize: { 
      icon: 'bg-success/10 text-success',
      hover: 'group-hover:bg-success group-hover:text-success-foreground group-hover:shadow-lg group-hover:shadow-success/20',
      glow: 'group-hover:ring-success/20'
    },
    'convert-to': { 
      icon: 'bg-info/10 text-info',
      hover: 'group-hover:bg-info group-hover:text-info-foreground group-hover:shadow-lg group-hover:shadow-info/20',
      glow: 'group-hover:ring-info/20'
    },
    'convert-from': { 
      icon: 'bg-[hsl(280,67%,75%)]/10 text-[hsl(280,67%,75%)]',
      hover: 'group-hover:bg-[hsl(280,67%,75%)] group-hover:text-white group-hover:shadow-lg group-hover:shadow-[hsl(280,67%,75%)]/20',
      glow: 'group-hover:ring-[hsl(280,67%,75%)]/20'
    },
    edit: { 
      icon: 'bg-warning/10 text-warning',
      hover: 'group-hover:bg-warning group-hover:text-warning-foreground group-hover:shadow-lg group-hover:shadow-warning/20',
      glow: 'group-hover:ring-warning/20'
    },
    security: { 
      icon: 'bg-security/10 text-security',
      hover: 'group-hover:bg-security group-hover:text-white group-hover:shadow-lg group-hover:shadow-security/20',
      glow: 'group-hover:ring-security/20'
    },
  };

  const colors = colorClasses[tool.category];

  if (variant === 'compact') {
    return (
      <Link
        to={tool.comingSoon ? '#' : tool.path}
        className={cn(
          "group flex items-center gap-3 p-4 rounded-2xl transition-all duration-300",
          "bg-card border border-border hover:shadow-lg hover:border-transparent",
          "ring-0 ring-transparent hover:ring-4",
          colors.glow,
          tool.comingSoon && "opacity-60 cursor-not-allowed"
        )}
      >
        <div className={cn(
          "flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300",
          colors.icon,
          colors.hover
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{tool.name}</p>
        </div>
        {tool.comingSoon && (
          <Badge variant="secondary" className="text-xs shrink-0">Soon</Badge>
        )}
      </Link>
    );
  }

  return (
    <Link
      to={tool.comingSoon ? '#' : tool.path}
      className={cn(
        "group relative flex flex-col p-6 rounded-2xl transition-all duration-300",
        "bg-card border border-border",
        "hover:shadow-lg hover:border-transparent hover:-translate-y-1",
        "ring-0 ring-transparent hover:ring-4",
        colors.glow,
        tool.comingSoon && "opacity-60 cursor-not-allowed"
      )}
    >
      {tool.comingSoon && (
        <Badge variant="secondary" className="absolute top-4 right-4 text-xs">Coming Soon</Badge>
      )}
      
      <div className={cn(
        "flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 mb-5",
        colors.icon,
        colors.hover
      )}>
        <Icon className="h-7 w-7" />
      </div>
      
      <h3 className="text-lg font-bold text-foreground mb-2">{tool.name}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">{tool.description}</p>
      
      <div className="flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span>Use tool</span>
        <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
      </div>
    </Link>
  );
};
