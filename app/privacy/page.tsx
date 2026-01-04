import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Read the Privacy Policy for wagered.app. Learn how we collect, use, and protect your personal information.',
  openGraph: {
    title: 'Privacy Policy | wagered.app',
    description: 'Read the Privacy Policy for wagered.app',
    url: `${siteUrl}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Breadcrumbs items={[{ name: "Privacy Policy", url: "/privacy" }]} className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Your Privacy Matters</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2">
            We are committed to protecting your privacy and personal information. This policy explains how we collect, use, and safeguard your data on our prediction market and trading platform.
          </AlertDescription>
        </Alert>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p className="text-muted-foreground mb-4">
              wagered.app ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <p className="text-muted-foreground mb-4">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Account information (email address, username, password - encrypted)</li>
              <li>Profile information (avatar, bio, preferences, KYC verification data)</li>
              <li>Prediction market participation data (positions taken, outcomes)</li>
              <li>Transaction history (deposits, withdrawals, market transactions)</li>
              <li>Communication data when you contact us</li>
              <li>Device and browser information for security purposes</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              We also automatically collect certain information when you use our service:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Device information and identifiers</li>
              <li>Log data (IP address, browser type, access times)</li>
              <li>Usage data (pages visited, features used)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p className="text-muted-foreground mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Process transactions and manage your account</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Monitor and analyze trends and usage</li>
              <li>Detect, prevent, and address technical issues</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Information Sharing and Disclosure</h2>
            <p className="text-muted-foreground mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>With your consent</li>
              <li>To comply with legal obligations</li>
              <li>To protect our rights and safety</li>
              <li>With service providers who assist us in operating our platform</li>
              <li>In connection with a business transfer or merger</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
            <p className="text-muted-foreground mb-4">
              We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p className="text-muted-foreground mb-4">
              Depending on your location, you may have certain rights regarding your personal information, including:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>The right to access your personal information</li>
              <li>The right to correct inaccurate information</li>
              <li>The right to delete your information</li>
              <li>The right to restrict processing</li>
              <li>The right to data portability</li>
              <li>The right to object to processing</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground mb-4">
              We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
            <p className="text-muted-foreground mb-4">
              Our service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Changes to This Privacy Policy</h2>
            <p className="text-muted-foreground mb-4">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Data Retention</h2>
            <p className="text-muted-foreground mb-4">
              We retain your personal information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or regulatory purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. International Data Transfers</h2>
            <p className="text-muted-foreground mb-4">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. We take appropriate safeguards to ensure your personal information receives an adequate level of protection.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Third-Party Services</h2>
            <p className="text-muted-foreground mb-4">
              Our platform may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to read the privacy policies of any third-party services you access.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us through our <a href="/contact" className="text-primary hover:underline">contact page</a> or visit our <a href="/help" className="text-primary hover:underline">Help Center</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

