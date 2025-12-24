import { Layout } from '@/components/layout/Layout';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

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
    answer: "Use our contact form to send us your feedback. We read every message and appreciate your input!"
  }
];

const FAQ = () => {
  return (
    <Layout>
      <div className="container py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-6">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-muted-foreground text-lg">
              Find answers to common questions about our PDF tools.
            </p>
          </div>

          {/* FAQ Accordion */}
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
    </Layout>
  );
};

export default FAQ;
