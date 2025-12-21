import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Mail, MessageSquare, Send, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

const faqs = [
  {
    question: "Is my PDF data secure?",
    answer: "Yes! All PDF processing happens directly in your browser. Your files are never uploaded to any server, ensuring complete privacy and security."
  },
  {
    question: "What file size limits are there?",
    answer: "Since processing happens in your browser, file size limits depend on your device's memory. Generally, files up to 100MB work smoothly on most devices."
  },
  {
    question: "Are these tools free to use?",
    answer: "Yes, all our PDF tools are completely free to use with no hidden fees or subscriptions required."
  },
  {
    question: "Can I use these tools on mobile?",
    answer: "Absolutely! Our tools are fully responsive and work on smartphones, tablets, and desktop computers."
  },
  {
    question: "Why did my PDF processing fail?",
    answer: "This can happen with corrupted PDFs, password-protected files, or very large documents. Try with a different file or contact us if the issue persists."
  },
  {
    question: "How do I report a bug or suggest a feature?",
    answer: "Use the contact form below to send us your feedback. We read every message and appreciate your input!"
  }
];

const Contact = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const contactEmail = 'support@pdftools.com'; // Replace with your actual email

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSending(true);

    // Create mailto link with pre-filled content
    const mailtoSubject = encodeURIComponent(subject || 'Contact from PDF Tools');
    const mailtoBody = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );
    
    window.location.href = `mailto:${contactEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;
    
    setTimeout(() => {
      setSending(false);
      toast.success('Email client opened! Please send the email to complete your message.');
    }, 500);
  };

  return (
    <Layout>
      <div className="container py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-muted-foreground text-lg">
              Found an issue or have a suggestion? We'd love to hear from you.
            </p>
          </div>

          {/* Contact Card */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Send us a message
              </CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you as soon as possible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="What is this about?"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Describe your issue or suggestion..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    required
                  />
                </div>

                <Button type="submit" className="w-full rounded-xl" disabled={sending}>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? 'Opening email client...' : 'Send Message'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          <div className="mt-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
            </div>
            
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`} className="border-border/50">
                  <AccordionTrigger className="text-left hover:no-underline hover:text-primary">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Contact;
