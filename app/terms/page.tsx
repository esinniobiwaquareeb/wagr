"use client";

import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { useSettings } from "@/hooks/use-settings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export default function TermsPage() {
  const { getSetting } = useSettings();
  
  // Get dynamic fee from settings
  const wagerFeePercentage = getSetting('fees.wager_platform_fee_percentage', 0.05);
  const wagerFeeDisplay = `${Math.round(wagerFeePercentage * 100)}%`;
  
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Breadcrumbs items={[{ name: "Terms & Conditions", url: "/terms" }]} className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Important Notice</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2">
            This platform is a prediction and trading platform, not a betting or gambling platform. Users participate in prediction markets where they can trade on outcomes of events. This service is designed for entertainment and educational purposes related to prediction markets and trading.
          </AlertDescription>
        </Alert>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing and using this platform, you accept and agree to be bound by the terms and provisions of this agreement. If you do not agree to these terms, you must not use this service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Platform Nature and Purpose</h2>
            <p className="text-muted-foreground mb-4">
              This platform is a prediction market and trading platform. It is NOT a betting or gambling platform. Users participate in prediction markets where they can:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Create and participate in prediction markets on various topics</li>
              <li>Trade positions on predicted outcomes of events</li>
              <li>Engage in educational and entertainment activities related to forecasting</li>
              <li>Test their predictive abilities in a controlled environment</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              This service is designed for users who wish to engage in prediction markets and trading activities, not traditional betting or gambling.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Eligibility and Age Requirements</h2>
            <p className="text-muted-foreground mb-4">
              To use this platform, you must:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Be at least 18 years of age</li>
              <li>Have the legal capacity to enter into binding agreements in your jurisdiction</li>
              <li>Comply with all applicable local, state, and federal laws</li>
              <li>Not be prohibited from using prediction market or trading platforms by any applicable law</li>
              <li>Provide accurate and truthful information during registration</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Participation in Prediction Markets</h2>
            <p className="text-muted-foreground mb-4">
              By participating in prediction markets on this platform, you acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>You understand this is a prediction market platform, not a betting or gambling service</li>
              <li>Participation involves financial risk and you may lose the funds you allocate</li>
              <li>You are solely responsible for ensuring your participation complies with all applicable laws in your jurisdiction</li>
              <li>All positions taken in prediction markets are final once confirmed and cannot be cancelled</li>
              <li>You will not use this platform for any illegal purpose or in violation of any applicable laws</li>
              <li>You understand that outcomes are determined based on real-world events and cannot be manipulated</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Platform Fees</h2>
            <p className="text-muted-foreground mb-4">
              The platform charges a service fee of {wagerFeeDisplay} on all prediction market transactions. This fee:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Is clearly displayed before you commit to any transaction</li>
              <li>Is deducted from the total pool before distributions are made</li>
              <li>Helps maintain and improve the platform infrastructure and services</li>
              <li>Is non-refundable once a transaction is completed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Account Responsibility</h2>
            <p className="text-muted-foreground mb-4">
              You are solely responsible for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Maintaining the confidentiality and security of your account credentials</li>
              <li>All activities that occur under your account, whether authorized by you or not</li>
              <li>Immediately notifying us of any unauthorized access or use of your account</li>
              <li>Ensuring that all information provided to us is accurate and current</li>
              <li>Keeping your contact information up to date</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Prohibited Activities</h2>
            <p className="text-muted-foreground mb-4">
              You agree NOT to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Use this platform for any illegal purpose or in violation of any applicable laws</li>
              <li>Attempt to manipulate, interfere with, or influence the outcome of any prediction market</li>
              <li>Create multiple accounts to circumvent platform rules, limits, or restrictions</li>
              <li>Engage in any fraudulent, deceptive, or dishonest activity</li>
              <li>Harass, abuse, threaten, or harm other users or platform staff</li>
              <li>Use automated systems, bots, or scripts to interact with the platform without authorization</li>
              <li>Reverse engineer, decompile, or attempt to extract the source code of the platform</li>
              <li>Interfere with or disrupt the platform's servers, networks, or security measures</li>
              <li>Use the platform to launder money or engage in any financial crimes</li>
              <li>Share your account credentials with any third party</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
            <p className="text-muted-foreground mb-4">
              All content, features, and functionality of this platform, including but not limited to text, graphics, logos, icons, images, software, and the compilation thereof, are the exclusive property of the platform and its licensors and are protected by copyright, trademark, and other intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              To the fullest extent permitted by applicable law, the platform, its affiliates, and their respective officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, use, goodwill, or other intangible losses, resulting from:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Your use or inability to use the platform</li>
              <li>Any unauthorized access to or use of our servers and/or any personal information stored therein</li>
              <li>Any interruption or cessation of transmission to or from the platform</li>
              <li>Any bugs, viruses, trojan horses, or the like that may be transmitted through the platform</li>
              <li>Any errors or omissions in any content or for any loss or damage incurred as a result of the use of any content</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Indemnification</h2>
            <p className="text-muted-foreground mb-4">
              You agree to defend, indemnify, and hold harmless the platform and its affiliates from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys' fees, arising out of or in any way connected with your use of the platform, your violation of these Terms, or your violation of any rights of another party.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Dispute Resolution</h2>
            <p className="text-muted-foreground mb-4">
              Any disputes arising out of or relating to these Terms or the platform shall be resolved in accordance with our Dispute Resolution Policy. Please refer to our Dispute Resolution Policy page for detailed information on how disputes are handled.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Termination</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to terminate or suspend your account and access to the platform immediately, without prior notice or liability, for any reason, including but not limited to a breach of these Terms. Upon termination, your right to use the platform will immediately cease.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Changes to Terms</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. Your continued use of the platform after any such changes constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">14. Governing Law</h2>
            <p className="text-muted-foreground mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the platform operates, without regard to its conflict of law provisions. Any legal action or proceeding arising under these Terms will be brought exclusively in the courts of that jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">15. Severability</h2>
            <p className="text-muted-foreground mb-4">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect and enforceable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">16. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about these Terms & Conditions, please contact us through our <a href="/contact" className="text-primary hover:underline">contact page</a> or refer to our <a href="/help" className="text-primary hover:underline">Help Center</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

