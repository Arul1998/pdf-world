import { useEffect } from 'react';

interface ToolStructuredDataProps {
  name: string;
  description: string;
  category: string;
  url?: string;
}

export const useToolStructuredData = ({
  name,
  description,
  category,
}: ToolStructuredDataProps) => {
  useEffect(() => {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": `${name} - PDF World`,
      "description": description,
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "1250"
      },
      "provider": {
        "@type": "Organization",
        "name": "PDF World",
        "url": "https://pdfworld.app"
      },
      "featureList": [
        "100% Free",
        "No Sign Up Required", 
        "Works Offline",
        "Files Never Leave Your Browser",
        "Client-Side Processing"
      ],
      "browserRequirements": "Requires JavaScript. Works in all modern browsers.",
      "softwareVersion": "1.0",
      "category": category
    };

    // Create or update the script tag
    let scriptTag = document.querySelector('script[data-structured-data="tool"]');
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.setAttribute('type', 'application/ld+json');
      scriptTag.setAttribute('data-structured-data', 'tool');
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(structuredData);

    // Cleanup on unmount
    return () => {
      const existingScript = document.querySelector('script[data-structured-data="tool"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [name, description, category]);
};

// Homepage structured data
export const useHomeStructuredData = () => {
  useEffect(() => {
    const websiteData = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "PDF World",
      "description": "Free online PDF tools: merge, split, compress, rotate, convert PDFs. 100% client-side, your files never leave your browser.",
      "url": "https://pdfworld.app",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://pdfworld.app/#all-tools",
        "query-input": "required name=search_term_string"
      }
    };

    const organizationData = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "PDF World",
      "url": "https://pdfworld.app",
      "logo": "https://pdfworld.app/pwa-icon-512.png",
      "description": "Free, privacy-first PDF tools that work entirely in your browser.",
      "sameAs": []
    };

    const softwareData = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "PDF World",
      "applicationCategory": "UtilitiesApplication",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "2500"
      },
      "featureList": [
        "Merge PDF",
        "Split PDF", 
        "Compress PDF",
        "Convert PDF to Word",
        "Convert Word to PDF",
        "Rotate PDF",
        "Add Watermark",
        "Sign PDF",
        "Protect PDF",
        "OCR PDF"
      ]
    };

    // Create script tags
    const scripts = [
      { id: 'website', data: websiteData },
      { id: 'organization', data: organizationData },
      { id: 'software', data: softwareData }
    ];

    scripts.forEach(({ id, data }) => {
      let scriptTag = document.querySelector(`script[data-structured-data="${id}"]`);
      if (!scriptTag) {
        scriptTag = document.createElement('script');
        scriptTag.setAttribute('type', 'application/ld+json');
        scriptTag.setAttribute('data-structured-data', id);
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(data);
    });

    // Cleanup on unmount
    return () => {
      scripts.forEach(({ id }) => {
        const existingScript = document.querySelector(`script[data-structured-data="${id}"]`);
        if (existingScript) {
          existingScript.remove();
        }
      });
    };
  }, []);
};

// FAQ page structured data
export const useFAQStructuredData = (faqs: { question: string; answer: string }[]) => {
  useEffect(() => {
    const faqData = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    let scriptTag = document.querySelector('script[data-structured-data="faq"]');
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.setAttribute('type', 'application/ld+json');
      scriptTag.setAttribute('data-structured-data', 'faq');
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(faqData);

    return () => {
      const existingScript = document.querySelector('script[data-structured-data="faq"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [faqs]);
};
