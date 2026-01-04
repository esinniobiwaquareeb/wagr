import Link from "next/link";
import { HelpCircle, Book, MessageCircle, FileText, Scale, Shield, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";

export default function HelpPage() {
  const helpSections = [
    {
      icon: Book,
      title: "Getting Started",
      description: "Learn the basics of using our prediction market platform",
      links: [
        { text: "How to create a prediction market", href: "/faq" },
        { text: "How to join a market", href: "/faq" },
        { text: "Understanding distributions", href: "/faq" },
        { text: "Wallet and transactions", href: "/faq" },
      ],
    },
    {
      icon: HelpCircle,
      title: "Common Questions",
      description: "Find answers to frequently asked questions",
      links: [
        { text: "View FAQ", href: "/faq" },
        { text: "Platform fees", href: "/faq" },
        { text: "Market resolution", href: "/faq" },
        { text: "Account management", href: "/faq" },
      ],
    },
    {
      icon: FileText,
      title: "Legal & Policies",
      description: "Read our terms, policies, and legal information",
      links: [
        { text: "Terms & Conditions", href: "/terms" },
        { text: "Privacy Policy", href: "/privacy" },
        { text: "Legal Information", href: "/legal" },
        { text: "Prohibition Policies", href: "/legal/prohibition" },
        { text: "Dispute Resolution", href: "/legal/dispute-resolution" },
      ],
    },
    {
      icon: Scale,
      title: "Platform Information",
      description: "Learn about our platform and services",
      links: [
        { text: "About Us", href: "/about" },
        { text: "Platform Nature", href: "/about" },
        { text: "How It Works", href: "/about" },
        { text: "Features", href: "/about" },
      ],
    },
    {
      icon: Shield,
      title: "Safety & Security",
      description: "Information about platform security and safety",
      links: [
        { text: "Account Security", href: "/faq" },
        { text: "KYC Verification", href: "/faq" },
        { text: "Prohibited Activities", href: "/legal/prohibition" },
        { text: "Reporting Issues", href: "/contact" },
      ],
    },
    {
      icon: MessageCircle,
      title: "Contact Support",
      description: "Get help from our support team",
      links: [
        { text: "Contact Us", href: "/contact" },
        { text: "File a Dispute", href: "/legal/dispute-resolution" },
        { text: "Report Violation", href: "/contact" },
      ],
    },
  ];

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Breadcrumbs items={[{ name: "Help Center", url: "/help" }]} className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Help Center</h1>
        <p className="text-muted-foreground mb-8">
          Find the help you need to get the most out of our prediction market and trading platform.
        </p>

        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Platform Information</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2">
            This is a prediction market and trading platform, NOT a betting or gambling platform. Users participate in prediction markets where they can trade positions on predicted outcomes of events.
          </AlertDescription>
        </Alert>

        <div className="grid md:grid-cols-2 gap-6">
          {helpSections.map((section, index) => {
            const Icon = section.icon;
            return (
              <div key={index} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition">
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
                        className="text-sm text-primary hover:underline flex items-center gap-2 hover:text-primary/80 transition"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                        {link.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Still need help?
            </h2>
            <p className="text-muted-foreground mb-4">
              If you can't find what you're looking for, don't hesitate to reach out to our support team. We're here to help!
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation"
              >
                Contact Support
              </Link>
              <Link
                href="/faq"
                className="inline-block bg-secondary text-secondary-foreground px-6 py-2 rounded-lg font-medium hover:opacity-90 transition active:scale-[0.98] touch-manipulation"
              >
                View FAQ
              </Link>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              Important Resources
            </h2>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <h3 className="font-medium mb-2">Legal & Compliance</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><Link href="/legal" className="text-primary hover:underline">Legal Information</Link></li>
                  <li><Link href="/legal/prohibition" className="text-primary hover:underline">Prohibition Policies</Link></li>
                  <li><Link href="/legal/dispute-resolution" className="text-primary hover:underline">Dispute Resolution</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-2">Platform Information</h3>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li><Link href="/about" className="text-primary hover:underline">About Us</Link></li>
                  <li><Link href="/terms" className="text-primary hover:underline">Terms & Conditions</Link></li>
                  <li><Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

