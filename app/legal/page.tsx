import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, FileText, Scale, Shield } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'Legal Information',
  description: 'Legal information, policies, and compliance details for our prediction market and trading platform.',
  openGraph: {
    title: 'Legal Information | wagered.app',
    description: 'Legal information and policies',
    url: `${siteUrl}/legal`,
  },
};

export default function LegalPage() {
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Breadcrumbs items={[{ name: "Legal", url: "/legal" }]} className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Legal Information</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Legal Notice</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2">
            This platform operates as a prediction market and trading platform. It is NOT a betting or gambling platform. Users are responsible for ensuring their participation complies with all applicable laws in their jurisdiction.
          </AlertDescription>
        </Alert>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Legal Documents
            </h2>
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <Link href="/terms" className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition">
                <h3 className="font-semibold mb-2">Terms & Conditions</h3>
                <p className="text-sm text-muted-foreground">Read our terms of service and user agreement</p>
              </Link>
              <Link href="/privacy" className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition">
                <h3 className="font-semibold mb-2">Privacy Policy</h3>
                <p className="text-sm text-muted-foreground">Learn how we collect, use, and protect your data</p>
              </Link>
              <Link href="/legal/prohibition" className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition">
                <h3 className="font-semibold mb-2">Prohibition Policies</h3>
                <p className="text-sm text-muted-foreground">Prohibited activities and behaviors</p>
              </Link>
              <Link href="/legal/dispute-resolution" className="bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition">
                <h3 className="font-semibold mb-2">Dispute Resolution</h3>
                <p className="text-sm text-muted-foreground">How we handle disputes and conflicts</p>
              </Link>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Platform Classification
            </h2>
            <p className="text-muted-foreground mb-4">
              This platform is classified as a <strong>prediction market and trading platform</strong>. It is designed to facilitate:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Prediction markets where users can trade on predicted outcomes</li>
              <li>Educational activities related to forecasting and market analysis</li>
              <li>Trading activities based on predicted outcomes of events</li>
              <li>Entertainment through engaging with prediction markets</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              This platform is <strong>NOT</strong> classified as:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>A betting or gambling platform</li>
              <li>A sportsbook or bookmaker</li>
              <li>A casino or gaming platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              User Responsibilities
            </h2>
            <p className="text-muted-foreground mb-4">
              As a user of this platform, you are responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Ensuring your participation complies with all applicable local, state, and federal laws</li>
              <li>Verifying that prediction markets and trading activities are legal in your jurisdiction</li>
              <li>Providing accurate and truthful information during registration and verification</li>
              <li>Maintaining the security of your account credentials</li>
              <li>Reporting any suspicious or fraudulent activity</li>
              <li>Complying with all platform rules and policies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Jurisdictional Compliance</h2>
            <p className="text-muted-foreground mb-4">
              We operate in compliance with applicable regulations. However, laws regarding prediction markets and trading platforms vary by jurisdiction. Users are solely responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Understanding and complying with laws in their jurisdiction</li>
              <li>Seeking legal advice if uncertain about the legality of participation</li>
              <li>Not using the platform if participation is prohibited in their jurisdiction</li>
              <li>Reporting any legal concerns to our support team</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Age Restrictions</h2>
            <p className="text-muted-foreground mb-4">
              You must be at least 18 years old to use this platform. We verify user age during registration and may request additional age verification. Accounts belonging to individuals under 18 will be immediately suspended and funds will be refunded.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              All content, features, and functionality of this platform are protected by copyright, trademark, and other intellectual property laws. Users may not copy, modify, distribute, or create derivative works without explicit written permission.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              To the fullest extent permitted by law, the platform and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the platform. This includes but is not limited to losses resulting from market participation, technical issues, or unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These legal terms and any disputes arising from the use of this platform shall be governed by and construed in accordance with the laws of the jurisdiction in which the platform operates, without regard to conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Updates to Legal Information</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to update our legal documents and policies at any time. Material changes will be communicated to users via email or platform notifications. Continued use of the platform after changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact for Legal Inquiries</h2>
            <p className="text-muted-foreground mb-4">
              For legal inquiries, questions about compliance, or to report legal concerns, please contact us through our <a href="/contact" className="text-primary hover:underline">contact page</a>. We take legal compliance seriously and will respond to all legitimate legal inquiries promptly.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

