import { Shield } from 'lucide-react';

/**
 * Small privacy reassurance badge shown on every tool page.
 * Reminds users that files never leave their browser.
 */
export const PrivacyBadge = () => {
  return (
    <div className="flex items-center justify-center gap-2 py-3 px-4 bg-success/5 border border-success/20 rounded-xl text-sm text-muted-foreground">
      <Shield className="h-4 w-4 text-success shrink-0" />
      <span>
        <span className="font-medium text-foreground">100% Private</span> — Your files never leave your browser
      </span>
    </div>
  );
};
