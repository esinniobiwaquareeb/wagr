import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Ban, Shield, Users } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'Prohibition Policies',
  description: 'Prohibited activities and behaviors on our prediction market and trading platform.',
  openGraph: {
    title: 'Prohibition Policies | wagered.app',
    description: 'Prohibited activities and behaviors',
    url: `${siteUrl}/legal/prohibition`,
  },
};

export default function ProhibitionPoliciesPage() {
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Breadcrumbs items={[
          { name: "Legal", url: "/legal" },
          { name: "Prohibition Policies", url: "/legal/prohibition" }
        ]} className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Prohibition Policies</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <Alert className="mb-8 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertTitle className="text-red-900 dark:text-red-100">Zero Tolerance Policy</AlertTitle>
          <AlertDescription className="text-red-800 dark:text-red-200 mt-2">
            Violations of these prohibition policies may result in immediate account suspension, termination, and potential legal action. We maintain a zero-tolerance policy for prohibited activities.
          </AlertDescription>
        </Alert>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Prohibited Activities
            </h2>
            <p className="text-muted-foreground mb-4">
              The following activities are strictly prohibited on this platform. Engaging in any of these activities will result in immediate account suspension or termination:
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Illegal Activities</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Using the platform for any illegal purpose or in violation of any applicable laws</li>
              <li>Money laundering or engaging in financial crimes</li>
              <li>Tax evasion or fraud</li>
              <li>Violating any local, state, federal, or international laws</li>
              <li>Participating in markets related to illegal activities or outcomes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Market Manipulation</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Attempting to manipulate, influence, or interfere with market outcomes</li>
              <li>Coordinating with other users to artificially influence market prices or outcomes</li>
              <li>Creating fake events or markets with the intent to defraud</li>
              <li>Providing false information about events or outcomes</li>
              <li>Attempting to influence real-world events to affect market outcomes</li>
              <li>Using insider information to gain unfair advantages</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Account Fraud</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Creating multiple accounts to circumvent platform rules, limits, or restrictions</li>
              <li>Using false or misleading information during registration or verification</li>
              <li>Impersonating another person or entity</li>
              <li>Sharing account credentials with others</li>
              <li>Accessing or attempting to access another user's account</li>
              <li>Using accounts belonging to minors or individuals under 18</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Automated Systems and Bots</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Using automated systems, bots, scripts, or programs to interact with the platform without explicit authorization</li>
              <li>Scraping, crawling, or extracting data from the platform</li>
              <li>Attempting to reverse engineer or decompile platform software</li>
              <li>Using any tools or methods to gain unfair advantages over other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Harassment and Abuse</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Harassing, threatening, or abusing other users or platform staff</li>
              <li>Posting offensive, discriminatory, or hateful content</li>
              <li>Spamming or sending unsolicited messages</li>
              <li>Impersonating platform staff or administrators</li>
              <li>Engaging in any form of cyberbullying or online harassment</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Security Violations</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Attempting to breach platform security measures</li>
              <li>Interfering with or disrupting platform servers, networks, or infrastructure</li>
              <li>Introducing viruses, malware, or other harmful code</li>
              <li>Attempting to gain unauthorized access to platform systems or data</li>
              <li>Conducting denial-of-service attacks or similar disruptive activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Prohibited Market Topics</h2>
            <p className="text-muted-foreground mb-4">
              The following types of markets are prohibited:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Markets related to illegal activities or outcomes</li>
              <li>Markets that could cause harm to individuals or groups</li>
              <li>Markets involving minors or vulnerable individuals</li>
              <li>Markets that violate intellectual property rights</li>
              <li>Markets that are discriminatory, hateful, or offensive</li>
              <li>Markets that could be used for money laundering or other financial crimes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Enforcement and Consequences
            </h2>
            <p className="text-muted-foreground mb-4">
              Violations of these prohibition policies will result in:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Immediate Account Suspension:</strong> Your account may be immediately suspended pending investigation</li>
              <li><strong>Account Termination:</strong> Serious violations will result in permanent account termination</li>
              <li><strong>Fund Forfeiture:</strong> Funds associated with prohibited activities may be forfeited</li>
              <li><strong>Legal Action:</strong> We reserve the right to pursue legal action for serious violations</li>
              <li><strong>Reporting to Authorities:</strong> Illegal activities will be reported to appropriate law enforcement agencies</li>
              <li><strong>Permanent Ban:</strong> Users who violate these policies may be permanently banned from the platform</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Reporting Violations</h2>
            <p className="text-muted-foreground mb-4">
              If you witness or suspect a violation of these prohibition policies, please report it immediately:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Use the report function available on user profiles and market pages</li>
              <li>Contact us through our <Link href="/contact" className="text-primary hover:underline">contact page</Link></li>
              <li>Email our support team with detailed information about the violation</li>
              <li>Include screenshots or evidence when possible</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              All reports are taken seriously and investigated promptly. We maintain confidentiality for reporters when appropriate.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Appeal Process
            </h2>
            <p className="text-muted-foreground mb-4">
              If you believe your account was suspended or terminated in error, you may appeal the decision:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Contact our support team through the <Link href="/contact" className="text-primary hover:underline">contact page</Link></li>
              <li>Provide detailed information explaining why you believe the action was in error</li>
              <li>Include any relevant evidence or documentation</li>
              <li>Allow 5-10 business days for review</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              Appeals are reviewed by our compliance team. Decisions on appeals are final.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Updates to Prohibition Policies</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to update these prohibition policies at any time. Material changes will be communicated to users. Continued use of the platform after changes constitutes acceptance of the updated policies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Questions</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about these prohibition policies or are unsure whether an activity is permitted, please contact us through our <Link href="/contact" className="text-primary hover:underline">contact page</Link> or visit our <Link href="/help" className="text-primary hover:underline">Help Center</Link> before engaging in the activity.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

