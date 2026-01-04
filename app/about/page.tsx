import { StructuredData } from "@/components/seo/structured-data";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { aboutPageSchema, metadata } from "./metadata";

export { metadata };

export default function AboutPage() {
  return (
    <>
      <StructuredData data={aboutPageSchema} />
      <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <Breadcrumbs items={[{ name: "About", url: "/about" }]} className="mb-6" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">About wagered.app</h1>

        <Alert className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">Platform Nature</AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200 mt-2">
            This is a prediction market and trading platform, NOT a betting or gambling platform. We provide a space for users to engage in prediction markets and trading activities on various topics.
          </AlertDescription>
        </Alert>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <p className="text-muted-foreground mb-4 text-base">
              Our platform is a modern prediction market and trading platform that enables users to create and participate in prediction markets on various topics, from sports and entertainment to finance and politics. We provide a transparent, secure, and engaging environment for users to test their predictive abilities and engage in trading activities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Our Mission</h2>
            <p className="text-muted-foreground mb-4">
              We aim to provide a transparent, engaging, and educational platform for prediction markets and trading. Whether you're passionate about sports analytics, interested in financial forecasting, or curious about political predictions, our platform offers a space to test your predictive abilities and engage in trading activities in a controlled, transparent environment.
            </p>
            <p className="text-muted-foreground mb-4">
              Our goal is to democratize access to prediction markets, making them accessible to everyone while maintaining the highest standards of transparency, security, and user experience.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">What We Are</h2>
            <p className="text-muted-foreground mb-4">
              This platform is a <strong>prediction market and trading platform</strong>. It is designed for:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Users who want to participate in prediction markets on various topics</li>
              <li>Traders who wish to engage in trading activities based on predicted outcomes</li>
              <li>Individuals interested in testing their forecasting and analytical abilities</li>
              <li>Educational purposes related to prediction markets and trading</li>
              <li>Entertainment through engaging with prediction markets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">What We Are NOT</h2>
            <p className="text-muted-foreground mb-4">
              This platform is <strong>NOT</strong>:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>A betting or gambling platform</li>
              <li>A sportsbook or bookmaker</li>
              <li>A casino or gaming platform</li>
              <li>An unregulated financial trading platform</li>
            </ul>
            <p className="text-muted-foreground mt-4 mb-4">
              We operate as a prediction market and trading platform, providing users with tools to engage in prediction markets and trading activities in a transparent and regulated manner.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How It Works</h2>
            <p className="text-muted-foreground mb-4">
              Our prediction market platform operates as follows:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Create or Join Markets:</strong> Users can create prediction markets on topics of interest or join existing markets</li>
              <li><strong>Take Positions:</strong> Users allocate funds to take positions on predicted outcomes</li>
              <li><strong>Market Resolution:</strong> When the event concludes, the market is resolved based on the actual outcome</li>
              <li><strong>Distribution:</strong> Participants who correctly predicted the outcome receive their proportional share of the pool (minus platform fees)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Key Features</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li><strong>Real-time Market Updates:</strong> Live updates on market status, participation, and odds</li>
              <li><strong>Automated Market Generation:</strong> System-generated prediction markets based on real-world events</li>
              <li><strong>Custom Categories:</strong> Organize markets by topics that interest you</li>
              <li><strong>Advanced Filtering:</strong> Find markets that match your preferences and interests</li>
              <li><strong>Leaderboard:</strong> Track top performers and market makers</li>
              <li><strong>Secure Wallet:</strong> Safe and transparent transaction management</li>
              <li><strong>Gamification:</strong> Earn rewards, achievements, and level up as you participate</li>
              <li><strong>Social Features:</strong> Follow other users, share markets, and build your network</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Transparency and Security</h2>
            <p className="text-muted-foreground mb-4">
              We are committed to maintaining the highest standards of transparency and security:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>All market outcomes are determined based on verifiable real-world events</li>
              <li>All transactions are recorded and visible in your transaction history</li>
              <li>Platform fees are clearly displayed before you commit to any transaction</li>
              <li>Your funds are securely stored and protected</li>
              <li>We use industry-standard security measures to protect your data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Responsible Participation</h2>
            <p className="text-muted-foreground mb-4">
              We encourage responsible participation in prediction markets:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Only allocate funds you can afford to lose</li>
              <li>Understand that participation involves financial risk</li>
              <li>Ensure your participation complies with all applicable laws in your jurisdiction</li>
              <li>Take breaks and don't let participation interfere with your daily life</li>
              <li>Seek help if you feel your participation is becoming problematic</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Legal Compliance</h2>
            <p className="text-muted-foreground mb-4">
              Users are responsible for ensuring their participation in prediction markets complies with all applicable local, state, and federal laws in their jurisdiction. We operate in compliance with applicable regulations and expect our users to do the same.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
            <p className="text-muted-foreground mb-4">
              If you have any questions about our platform, please visit our <a href="/contact" className="text-primary hover:underline">Contact</a> page or check out our <a href="/help" className="text-primary hover:underline">Help Center</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
    </>
  );
}

