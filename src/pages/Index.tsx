import { Link } from 'react-router-dom';
import { Shield, Zap, Cloud, ArrowRight, Sparkles, FileText, Star } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ToolCard } from '@/components/ToolCard';
import { Button } from '@/components/ui/button';
import { toolCategories, getToolsByCategory } from '@/lib/tool-definitions';
import { cn } from '@/lib/utils';
import { useHomeStructuredData } from '@/components/StructuredData';

const features = [
  {
    icon: Shield,
    title: '100% Private',
    description: 'All processing happens in your browser. Files never leave your device.',
    color: 'from-primary/20 to-primary/5',
    iconColor: 'text-primary',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'No upload or download delays. Instant processing using WebAssembly.',
    color: 'from-accent/20 to-accent/5',
    iconColor: 'text-accent',
  },
  {
    icon: Cloud,
    title: 'No Storage',
    description: 'Files are automatically deleted when you refresh. Zero data retention.',
    color: 'from-success/20 to-success/5',
    iconColor: 'text-success',
  },
];

const categoryColors: Record<string, { bg: string; border: string; gradient: string; iconBg: string }> = {
  organize: { 
    bg: 'bg-primary/5', 
    border: 'border-primary/20',
    gradient: 'from-primary/10 via-primary/5 to-transparent',
    iconBg: 'bg-primary/10 text-primary'
  },
  optimize: { 
    bg: 'bg-success/5', 
    border: 'border-success/20',
    gradient: 'from-success/10 via-success/5 to-transparent',
    iconBg: 'bg-success/10 text-success'
  },
  'convert-to': { 
    bg: 'bg-info/5', 
    border: 'border-info/20',
    gradient: 'from-info/10 via-info/5 to-transparent',
    iconBg: 'bg-info/10 text-info'
  },
  'convert-from': { 
    bg: 'bg-[hsl(280,67%,75%)]/5', 
    border: 'border-[hsl(280,67%,75%)]/20',
    gradient: 'from-[hsl(280,67%,75%)]/10 via-[hsl(280,67%,75%)]/5 to-transparent',
    iconBg: 'bg-[hsl(280,67%,75%)]/10 text-[hsl(280,67%,75%)]'
  },
  edit: { 
    bg: 'bg-warning/5', 
    border: 'border-warning/20',
    gradient: 'from-warning/10 via-warning/5 to-transparent',
    iconBg: 'bg-warning/10 text-warning'
  },
  security: { 
    bg: 'bg-security/5', 
    border: 'border-security/20',
    gradient: 'from-security/10 via-security/5 to-transparent',
    iconBg: 'bg-security/10 text-security'
  },
};

const Index = () => {
  // Add structured data for homepage SEO
  useHomeStructuredData();

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero min-h-[80vh] flex items-center">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(280,67%,75%)]/5 rounded-full blur-3xl" />
        
        <div className="container relative py-20 md:py-28 lg:py-36">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass border border-border mb-8 animate-slide-down">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-warning fill-warning" />
                <Star className="h-4 w-4 text-warning fill-warning" />
                <Star className="h-4 w-4 text-warning fill-warning" />
              </div>
              <span className="text-sm font-medium text-foreground">100% Free • No Sign Up • Works Offline</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-foreground tracking-tight mb-8 animate-slide-up">
              Every PDF tool you need,{' '}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_auto]">
                in your browser
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-slide-up leading-relaxed" style={{ animationDelay: '0.1s' }}>
              Merge, split, compress, convert, and edit PDFs with ease. 
              Your files stay private—they never leave your device.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Button asChild size="lg" className="text-base h-14 px-10 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary via-primary to-accent hover:from-primary hover:via-accent hover:to-primary bg-[length:200%_auto] hover:bg-right">
                <a href="#all-tools">
                  Explore All Tools
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>

            {/* Stats */}
            <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 mt-16 animate-fade-in" style={{ animationDelay: '0.4s' }}>
              {[
                { value: '35+', label: 'PDF Tools' },
                { value: '100%', label: 'Free Forever' },
                { value: '∞', label: 'Unlimited Usage' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 md:py-28 relative">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Why choose PDF World?</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Built for privacy, speed, and simplicity</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="group relative p-8 rounded-3xl bg-card border border-border hover:border-transparent hover:shadow-lg transition-all duration-500 animate-slide-up overflow-hidden"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                {/* Background gradient on hover */}
                <div className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                  feature.color
                )} />
                
                <div className="relative">
                  <div className={cn(
                    "flex h-16 w-16 items-center justify-center rounded-2xl mb-6 transition-transform duration-300 group-hover:scale-110",
                    "bg-gradient-to-br",
                    feature.color
                  )}>
                    <feature.icon className={cn("h-8 w-8", feature.iconColor)} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Tools */}
      <section className="py-20 md:py-28 bg-gradient-to-b from-secondary/50 to-background">
        <div className="container">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              Most Popular
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">Popular Tools</h2>
            <p className="text-muted-foreground text-lg">Most used PDF tools by our users</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {['merge', 'split', 'compress', 'rotate', 'jpg-to-pdf', 'pdf-to-jpg', 'page-numbers', 'watermark'].map((toolId) => {
              const tool = getToolsByCategory('organize')
                .concat(getToolsByCategory('optimize'))
                .concat(getToolsByCategory('convert-to'))
                .concat(getToolsByCategory('convert-from'))
                .concat(getToolsByCategory('edit'))
                .find(t => t.id === toolId);
              if (!tool) return null;
              return <ToolCard key={tool.id} tool={tool} />;
            })}
          </div>
        </div>
      </section>

      {/* All Tools by Category */}
      <section id="all-tools" className="py-20 md:py-28">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">All PDF Tools</h2>
            <p className="text-muted-foreground text-lg">Everything you need to work with PDFs</p>
          </div>

          <div className="space-y-16">
            {toolCategories.map((category) => {
              const categoryTools = getToolsByCategory(category.id);
              const colors = categoryColors[category.id];
              
              return (
                <div key={category.id} id={category.id} className="scroll-mt-24">
                  <div className={cn(
                    "relative p-8 md:p-10 rounded-3xl border mb-8 overflow-hidden",
                    colors.bg,
                    colors.border
                  )}>
                    {/* Background decoration */}
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-r opacity-50",
                      colors.gradient
                    )} />
                    
                    <div className="relative flex items-center gap-4">
                      <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", colors.iconBg)}>
                        <FileText className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-foreground mb-1">
                          {category.name}
                        </h3>
                        <p className="text-muted-foreground">{category.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {categoryTools.map((tool) => (
                      <ToolCard key={tool.id} tool={tool} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="relative max-w-4xl mx-auto text-center p-12 md:p-16 rounded-[2rem] overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 gradient-primary opacity-90" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--accent)/0.3),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(280,67%,75%,0.2),transparent_50%)]" />
            
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 text-white text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                Start for free
              </div>
              
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
                Ready to work with your PDFs?
              </h2>
              <p className="text-white/80 text-lg mb-10 max-w-xl mx-auto">
                All tools are completely free, with no limits. Your files never leave your browser.
              </p>
              <Button asChild size="lg" variant="secondary" className="text-base h-14 px-10 rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 font-semibold">
                <a href="#all-tools">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
