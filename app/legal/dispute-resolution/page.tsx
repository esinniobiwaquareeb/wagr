import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Scale, MessageSquare, Clock, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://wagered.app';

export const metadata: Metadata = {
  title: 'Dispute Resolution Policy',
  description: 'How disputes are resolved on our prediction market and trading platform.',
  openGraph: {
    title: 'Dispute Resolution Policy | wagered.app',
    description: 'How disputes are resolved',
    url: `${siteUrl}/legal/dispute-resolution`,
  },
};

export default function DisputeResolutionPage() {
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Breadcrumbs items={[
          { name: "Legal", url: "/legal" },
          { name: "Dispute Resolution", url: "/legal/dispute-resolution" }
        ]} className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Dispute Resolution Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Scale className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Fair Resolution Process</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2">
            We are committed to resolving disputes fairly, promptly, and transparently. This policy outlines the process for resolving disputes between users and the platform.
          </AlertDescription>
        </Alert>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Overview
            </h2>
            <p className="text-muted-foreground mb-4">
              This Dispute Resolution Policy governs how disputes are handled between users and the platform. We aim to resolve all disputes fairly, efficiently, and in accordance with applicable laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Types of Disputes</h2>
            <p className="text-muted-foreground mb-4">
              This policy covers the following types of disputes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Market Resolution Disputes:</strong> Disagreements about how a prediction market was resolved</li>
              <li><strong>Transaction Disputes:</strong> Issues with deposits, withdrawals, or market transactions</li>
              <li><strong>Account Disputes:</strong> Problems with account access, suspension, or termination</li>
              <li><strong>Distribution Disputes:</strong> Issues with how funds were distributed after market resolution</li>
              <li><strong>Technical Disputes:</strong> Problems caused by platform errors or technical issues</li>
              <li><strong>Policy Disputes:</strong> Disagreements about platform policies or enforcement</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              2. Dispute Resolution Process
            </h2>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Initial Contact
                </h3>
                <p className="text-muted-foreground text-sm">
                  Contact our support team through the <Link href="/contact" className="text-primary hover:underline">contact page</Link> or support email. Provide detailed information about the dispute, including relevant transaction IDs, market IDs, screenshots, and any supporting documentation.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Initial Review
                </h3>
                <p className="text-muted-foreground text-sm">
                  Our support team will review your dispute within 2-3 business days. We may request additional information or clarification during this time. You will receive an acknowledgment email confirming receipt of your dispute.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  Investigation
                </h3>
                <p className="text-muted-foreground text-sm">
                  Our compliance team will investigate the dispute, reviewing all relevant records, transactions, and communications. This process typically takes 5-10 business days, depending on the complexity of the dispute.
                </p>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
                  Resolution
                </h3>
                <p className="text-muted-foreground text-sm">
                  Once the investigation is complete, we will provide a written decision explaining the resolution. If the dispute is resolved in your favor, we will take appropriate corrective action, which may include refunds, account adjustments, or other remedies.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Market Resolution Disputes</h2>
            <p className="text-muted-foreground mb-4">
              For disputes about how a prediction market was resolved:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Markets are resolved based on verifiable, objective sources (official results, news reports, public records)</li>
              <li>If you believe a market was resolved incorrectly, provide evidence from a reliable, verifiable source</li>
              <li>We will review the resolution against the original market terms and verifiable sources</li>
              <li>If an error is found, we will correct the resolution and redistribute funds accordingly</li>
              <li>Disputes must be filed within 7 days of market resolution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Transaction Disputes</h2>
            <p className="text-muted-foreground mb-4">
              For disputes related to transactions:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Provide transaction IDs, timestamps, and relevant account information</li>
              <li>For deposit disputes, include payment confirmation and bank statements if applicable</li>
              <li>For withdrawal disputes, provide bank account details and confirmation of non-receipt</li>
              <li>We will investigate transaction records and payment processor records</li>
              <li>Resolution may include refunds, corrections, or explanations of the transaction</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Account Disputes</h2>
            <p className="text-muted-foreground mb-4">
              For disputes about account actions (suspension, termination, restrictions):
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Explain why you believe the action was incorrect or unfair</li>
              <li>Provide any relevant evidence or context</li>
              <li>We will review account activity, policy violations, and enforcement actions</li>
              <li>If an error is found, we will restore account access and take corrective action</li>
              <li>If the action was correct, we will explain the reason and applicable policies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Time Limits</h2>
            <p className="text-muted-foreground mb-4">
              Disputes must be filed within the following time limits:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Market Resolution Disputes:</strong> Within 7 days of market resolution</li>
              <li><strong>Transaction Disputes:</strong> Within 30 days of the transaction date</li>
              <li><strong>Account Disputes:</strong> Within 14 days of the account action</li>
              <li><strong>Distribution Disputes:</strong> Within 7 days of distribution</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              Disputes filed after these time limits may not be considered unless exceptional circumstances apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              7. Resolution Outcomes
            </h2>
            <p className="text-muted-foreground mb-4">
              Possible outcomes of dispute resolution include:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Full Resolution:</strong> Complete correction of the issue, including refunds or adjustments</li>
              <li><strong>Partial Resolution:</strong> Partial correction when full resolution is not appropriate</li>
              <li><strong>Explanation:</strong> Detailed explanation when no error is found but clarification is needed</li>
              <li><strong>Policy Clarification:</strong> Explanation of applicable policies and why the action was taken</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Appeals Process</h2>
            <p className="text-muted-foreground mb-4">
              If you are not satisfied with the initial resolution:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>You may request an appeal within 7 days of receiving the resolution</li>
              <li>Provide additional evidence or information not previously considered</li>
              <li>Appeals are reviewed by senior compliance staff or management</li>
              <li>Appeal decisions are typically final, except in cases involving legal requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              9. External Dispute Resolution
            </h2>
            <p className="text-muted-foreground mb-4">
              If internal dispute resolution does not resolve your issue, you may:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Contact relevant regulatory authorities in your jurisdiction</li>
              <li>Seek legal advice and pursue legal remedies if applicable</li>
              <li>File a complaint with consumer protection agencies</li>
              <li>Engage in mediation or arbitration if mutually agreed upon</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              We are committed to cooperating with legitimate regulatory and legal processes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Good Faith Participation</h2>
            <p className="text-muted-foreground mb-4">
              All parties involved in dispute resolution are expected to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Participate in good faith and provide accurate information</li>
              <li>Respond promptly to requests for additional information</li>
              <li>Respect the dispute resolution process and timelines</li>
              <li>Not abuse the dispute resolution system with frivolous claims</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. Confidentiality</h2>
            <p className="text-muted-foreground mb-4">
              Dispute resolution proceedings are confidential. We will not disclose details of disputes to third parties except:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>As required by law or legal process</li>
              <li>To regulatory authorities when necessary</li>
              <li>With your explicit consent</li>
              <li>To prevent fraud or illegal activity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">12. Contact for Disputes</h2>
            <p className="text-muted-foreground mb-4">
              To file a dispute or for questions about the dispute resolution process:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Use our <Link href="/contact" className="text-primary hover:underline">contact page</Link> and select "Dispute" as the subject</li>
              <li>Email our support team with "DISPUTE" in the subject line</li>
              <li>Include all relevant information, transaction IDs, and supporting documentation</li>
              <li>Be specific about the resolution you are seeking</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Updates to This Policy</h2>
            <p className="text-muted-foreground mb-4">
              We reserve the right to update this Dispute Resolution Policy at any time. Material changes will be communicated to users. The version in effect at the time a dispute is filed will apply to that dispute.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

