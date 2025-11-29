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

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6">
          <section>
            <p className="text-muted-foreground mb-4 text-base">
              wagered.app is a modern wagering platform that allows users to create and participate in wagers on various topics, from sports and entertainment to finance and politics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Our Mission</h2>
            <p className="text-muted-foreground mb-4">
              We aim to provide a fun, engaging, and transparent platform for users to wager on outcomes they care about. Whether you're passionate about sports, interested in financial markets, or curious about political events, wagered.app offers a space to put your predictions to the test.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">How It Works</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Create or join wagers on topics that interest you</li>
              <li>Place your wager by choosing a side</li>
              <li>Wait for the outcome to be determined</li>
              <li>Win and collect your share of the pool (minus platform fees)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Features</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Real-time updates on wager status and participation</li>
              <li>Automated wager generation based on real-world events</li>
              <li>User preferences and filtering options</li>
              <li>Leaderboard to track top performers</li>
              <li>Secure wallet and transaction management</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Responsible Wagering</h2>
            <p className="text-muted-foreground mb-4">
              We encourage responsible wagering practices. Please only wager amounts you can afford to lose, and ensure you comply with all local laws and regulations regarding wagering activities in your jurisdiction.
            </p>
          </section>
        </div>
      </div>
    </main>
    </>
  );
}

