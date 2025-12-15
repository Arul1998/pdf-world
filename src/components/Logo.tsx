import { cn } from '@/lib/utils';

interface LogoProps {
  showText?: boolean;
  className?: string;
  iconClassName?: string;
}

export const Logo = ({ showText = true, className, iconClassName }: LogoProps) => {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("h-8 w-8", iconClassName)}
      >
        {/* Document shape */}
        <path
          d="M8 4C8 2.89543 8.89543 2 10 2H24L32 10V36C32 37.1046 31.1046 38 30 38H10C8.89543 38 8 37.1046 8 36V4Z"
          fill="hsl(243, 75%, 72%)"
          fillOpacity="0.15"
          stroke="hsl(243, 75%, 72%)"
          strokeWidth="2"
        />
        {/* Folded corner */}
        <path
          d="M24 2V10H32"
          stroke="hsl(243, 75%, 72%)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Globe circle */}
        <circle
          cx="20"
          cy="24"
          r="8"
          fill="hsl(243, 75%, 72%)"
          fillOpacity="0.2"
          stroke="hsl(243, 75%, 72%)"
          strokeWidth="1.5"
        />
        {/* Globe horizontal line */}
        <path
          d="M12 24H28"
          stroke="hsl(243, 75%, 72%)"
          strokeWidth="1.5"
        />
        {/* Globe vertical ellipse */}
        <ellipse
          cx="20"
          cy="24"
          rx="4"
          ry="8"
          fill="none"
          stroke="hsl(243, 75%, 72%)"
          strokeWidth="1.5"
        />
        {/* Text lines at top */}
        <path
          d="M12 13H20"
          stroke="hsl(243, 75%, 72%)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      {showText && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          PDF World
        </span>
      )}
    </div>
  );
};

// Export just the icon for favicon use
export const LogoIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 4C8 2.89543 8.89543 2 10 2H24L32 10V36C32 37.1046 31.1046 38 30 38H10C8.89543 38 8 37.1046 8 36V4Z"
      fill="#9b87f5"
      fillOpacity="0.15"
      stroke="#9b87f5"
      strokeWidth="2"
    />
    <path
      d="M24 2V10H32"
      stroke="#9b87f5"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="20"
      cy="24"
      r="8"
      fill="#9b87f5"
      fillOpacity="0.2"
      stroke="#9b87f5"
      strokeWidth="1.5"
    />
    <path
      d="M12 24H28"
      stroke="#9b87f5"
      strokeWidth="1.5"
    />
    <ellipse
      cx="20"
      cy="24"
      rx="4"
      ry="8"
      fill="none"
      stroke="#9b87f5"
      strokeWidth="1.5"
    />
    <path
      d="M12 13H20"
      stroke="#9b87f5"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);
