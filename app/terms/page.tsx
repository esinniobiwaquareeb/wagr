export default function TermsPage() {
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Terms & Conditions</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground mb-4">
              By accessing and using iwagr, you accept and agree to be bound by the terms and provision of this agreement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Use License</h2>
            <p className="text-muted-foreground mb-4">
              Permission is granted to temporarily use iwagr for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to reverse engineer any software contained on iwagr</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Wager Participation</h2>
            <p className="text-muted-foreground mb-4">
              By participating in wagers on iwagr, you acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>You are of legal age to participate in wagering activities in your jurisdiction</li>
              <li>You understand that wagering involves risk of loss</li>
              <li>You are responsible for ensuring compliance with local laws and regulations</li>
              <li>All wagers are final once placed and cannot be cancelled</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Platform Fees</h2>
            <p className="text-muted-foreground mb-4">
              iwagr charges a platform fee on all wagers. The fee percentage is determined by the platform and will be clearly displayed before you place a wager. Fees are deducted from the total pool before winnings are distributed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Account Responsibility</h2>
            <p className="text-muted-foreground mb-4">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify iwagr immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Prohibited Activities</h2>
            <p className="text-muted-foreground mb-4">
              You agree not to:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Use iwagr for any illegal purpose</li>
              <li>Attempt to manipulate or interfere with wager outcomes</li>
              <li>Create multiple accounts to circumvent platform rules</li>
              <li>Engage in any fraudulent activity</li>
              <li>Harass, abuse, or harm other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
            <p className="text-muted-foreground mb-4">
              iwagr shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Changes to Terms</h2>
            <p className="text-muted-foreground mb-4">
              iwagr reserves the right to modify these terms at any time. We will notify users of any material changes. Your continued use of the service after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact Information</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about these Terms & Conditions, please contact us through our contact page.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

