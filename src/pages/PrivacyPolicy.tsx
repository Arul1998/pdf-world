import { Layout } from '@/components/layout/Layout';
import { Shield } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <Layout>
      <div className="container py-12 md:py-20">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: December 2024</p>
          </div>

          {/* Content */}
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                At PDF World, we take your privacy seriously. This Privacy Policy explains how we handle your information when you use our PDF tools and services. The good news? We collect virtually no data because all processing happens directly in your browser.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data We Do NOT Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Unlike most online services, we prioritize your privacy by design:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Your Files:</strong> All PDF processing happens 100% in your browser. Your files are never uploaded to our servers.</li>
                <li><strong className="text-foreground">File Contents:</strong> We cannot see, access, or store the contents of any documents you process.</li>
                <li><strong className="text-foreground">Personal Documents:</strong> Sensitive information in your PDFs stays on your device at all times.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">How Our Tools Work</h2>
              <p className="text-muted-foreground leading-relaxed">
                PDF World uses client-side processing powered by WebAssembly and JavaScript. When you use our tools:
              </p>
              <ol className="list-decimal pl-6 space-y-2 text-muted-foreground mt-4">
                <li>Your files are loaded into your browser's memory</li>
                <li>All processing happens locally on your device</li>
                <li>Processed files are available for download directly from your browser</li>
                <li>When you close the page or refresh, all data is automatically deleted</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Information We May Collect</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                We may collect minimal, non-personal information to improve our service:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><strong className="text-foreground">Analytics Data:</strong> Anonymous usage statistics like page views and tool usage counts (no personal identifiers).</li>
                <li><strong className="text-foreground">Contact Form:</strong> If you contact us, we collect the information you provide (name, email, message) solely to respond to your inquiry.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Cookies</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use minimal cookies for essential functionality like remembering your theme preference (dark/light mode). We do not use tracking cookies or share data with advertisers.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Third-Party Services</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may use third-party services for analytics or email delivery. These services have their own privacy policies and are selected for their commitment to user privacy.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                Since your files never leave your device, they benefit from your own device's security. We use HTTPS encryption for all website communications to protect any data transmitted.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Your Rights</h2>
              <p className="text-muted-foreground leading-relaxed">
                You have the right to access, correct, or delete any personal information you have provided to us (such as through our contact form). Contact us to exercise these rights.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Changes to This Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-foreground mb-4">Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have questions about this Privacy Policy, please contact us through our{' '}
                <a href="/contact" className="text-primary hover:underline">contact page</a>.
              </p>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PrivacyPolicy;
