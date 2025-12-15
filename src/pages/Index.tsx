import { Link } from 'react-router-dom';
import { Shield, Zap, Cloud, ArrowRight, Sparkles } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { ToolCard } from '@/components/ToolCard';
import { Button } from '@/components/ui/button';
import { toolCategories, getToolsByCategory } from '@/lib/tool-definitions';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Shield,
    title: '100% Private',
    description: 'All processing happens in your browser. Files never leave your device.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'No upload or download delays. Instant processing using WebAssembly.',
  },
  {
    icon: Cloud,
    title: 'No Storage',
    description: 'Files are automatically deleted when you refresh. Zero data retention.',
  },
];

const categoryColors: Record<string, { bg: string; text: string; gradient: string }> = {
  organize: { 
    bg: 'bg-primary/10', 
    text: 'text-primary',
    gradient: 'from-primary/20 to-primary/5'
  },
  optimize: { 
    bg: 'bg-success/10', 
    text: 'text-success',
    gradient: 'from-success/20 to-success/5'
  },
  'convert-to': { 
    bg: 'bg-info/10', 
    text: 'text-info',
    gradient: 'from-info/20 to-info/5'
  },
  'convert-from': { 
    bg: 'bg-[hsl(262,83%,58%)]/10', 
    text: 'text-[hsl(262,83%,58%)]',
    gradient: 'from-[hsl(262,83%,58%)]/20 to-[hsl(262,83%,58%)]/5'
  },
  edit: { 
    bg: 'bg-warning/10', 
    text: 'text-warning',
    gradient: 'from-warning/20 to-warning/5'
  },
  security: { 
    bg: 'bg-foreground/10', 
    text: 'text-foreground',
    gradient: 'from-foreground/20 to-foreground/5'
  },
};

const Index = () => {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden gradient-hero">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--primary)/0.1),transparent_50%)]" />
        
        <div className="container relative py-16 md:py-24 lg:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-fade-in">
              <Sparkles className="h-4 w-4" />
              <span>100% Free • No Sign Up • Works Offline</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight mb-6 animate-slide-up">
              Every PDF tool you need,{' '}
              <span className="text-primary">in your browser</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto animate-slide-up" style={{ animationDelay: '0.1s' }}>
              Merge, split, compress, convert, and edit PDFs with ease. 
              Your files stay private—they never leave your device.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <Button asChild size="lg" className="text-base h-12 px-8">
                <a href="#all-tools">
                  Explore All Tools
                  <ArrowRight className="ml-2 h-5 w-5" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-base h-12 px-8">
                <Link to="/tools/merge">Try Merge PDF</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-12 md:py-16 border-b border-border">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {features.map((feature, index) => (
              <div 
                key={feature.title}
                className="flex items-start gap-4 p-6 rounded-2xl bg-card border border-border animate-slide-up"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Tools */}
      <section className="py-12 md:py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">Popular Tools</h2>
            <p className="text-muted-foreground">Most used PDF tools by our users</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <section id="all-tools" className="py-12 md:py-16 bg-muted/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">All PDF Tools</h2>
            <p className="text-muted-foreground">Everything you need to work with PDFs</p>
          </div>

          <div className="space-y-12">
            {toolCategories.map((category) => {
              const categoryTools = getToolsByCategory(category.id);
              const colors = categoryColors[category.id];
              
              return (
                <div key={category.id} id={category.id} className="scroll-mt-24">
                  <div className={cn(
                    "p-6 md:p-8 rounded-2xl bg-gradient-to-br mb-6",
                    colors.gradient
                  )}>
                    <h3 className={cn("text-xl font-bold mb-2", colors.text)}>
                      {category.name}
                    </h3>
                    <p className="text-muted-foreground">{category.description}</p>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
      <section className="py-16 md:py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center p-8 md:p-12 rounded-3xl gradient-primary text-primary-foreground">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to work with your PDFs?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              All tools are completely free, with no limits. Your files never leave your browser.
            </p>
            <Button asChild size="lg" variant="secondary" className="text-base h-12 px-8">
              <a href="#all-tools">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Index;
