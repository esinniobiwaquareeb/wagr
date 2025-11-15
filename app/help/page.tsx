import Link from "next/link";
import { HelpCircle, Book, MessageCircle, FileText } from "lucide-react";

export default function HelpPage() {
  const helpSections = [
    {
      icon: Book,
      title: "Getting Started",
      description: "Learn the basics of using wagr",
      links: [
        { text: "How to create a wager", href: "/faq#create" },
        { text: "How to join a wager", href: "/faq#join" },
        { text: "Understanding winnings", href: "/faq#winnings" },
      ],
    },
    {
      icon: HelpCircle,
      title: "Common Questions",
      description: "Find answers to frequently asked questions",
      links: [
        { text: "View FAQ", href: "/faq" },
        { text: "Platform fees", href: "/faq#fees" },
        { text: "Wallet management", href: "/faq#wallet" },
      ],
    },
    {
      icon: FileText,
      title: "Legal & Policies",
      description: "Read our terms and privacy policy",
      links: [
        { text: "Terms & Conditions", href: "/terms" },
        { text: "Privacy Policy", href: "/privacy" },
      ],
    },
    {
      icon: MessageCircle,
      title: "Contact Support",
      description: "Get help from our support team",
      links: [
        { text: "Contact Us", href: "/contact" },
        { text: "About wagr", href: "/about" },
      ],
    },
  ];

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Help Center</h1>
        <p className="text-muted-foreground mb-8">
          Find the help you need to get the most out of wagr.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {helpSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div key={index} className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                    <p className="text-sm text-muted-foreground">{section.description}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {section.links.map((link, linkIndex) => (
                    <li key={linkIndex}>
                      <Link
                        href={link.href}
                        className="text-sm text-primary hover:underline flex items-center gap-2"
                      >
                        {link.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-3">Still need help?</h2>
          <p className="text-muted-foreground mb-4">
            If you can't find what you're looking for, don't hesitate to reach out to our support team.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  );
}

