"use client";

import { StructuredData } from "@/components/seo/structured-data";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { useSettings } from "@/hooks/use-settings";

export default function FAQPage() {
  const { getSetting, loading } = useSettings();
  
  // Get dynamic fee from settings (default 5%)
  const wagerFeePercentage = getSetting('fees.wager_platform_fee_percentage', 0.05);
  const quizFeePercentage = getSetting('fees.quiz_platform_fee_percentage', 0.1);
  const wagerFeeDisplay = `${Math.round(wagerFeePercentage * 100)}%`;
  const quizFeeDisplay = `${Math.round(quizFeePercentage * 100)}%`;
  
  // Get wager limits
  const minWagerAmount = getSetting('wagers.min_amount', 100);
  const maxWagerAmount = getSetting('wagers.max_amount', 1000000);
  
  const faqs = [
    {
      question: "What is this platform?",
      answer: "This is a prediction market and trading platform, NOT a betting or gambling platform. Users participate in prediction markets where they can trade positions on predicted outcomes of events. It's designed for educational and entertainment purposes related to forecasting and prediction markets.",
    },
    {
      question: "How do I create a prediction market?",
      answer: "Click the '+' button in the navigation (or 'Create' on desktop) to create a new prediction market. Fill in the title, sides (outcomes), entry amount, and optional deadline, then submit. Your market will be available for others to join.",
    },
    {
      question: "How do I join a prediction market?",
      answer: "Browse available markets on the home page or search for specific topics. Click on a market to view details, then select the outcome you predict will occur and confirm your participation. Your allocated funds will be deducted from your wallet.",
    },
    {
      question: "How are distributions calculated?",
      answer: "Distributions are calculated proportionally among participants who correctly predicted the outcome, based on their stake in the market. The platform fee is deducted from the total pool before distributions are made. For example, if you allocated 20% of the winning side's total, you'll receive 20% of the distribution pool.",
    },
    {
      question: "What is the platform fee?",
      answer: `The platform fee is ${wagerFeeDisplay} of the total market pool. This fee is clearly displayed before you commit to any transaction and is automatically deducted from the total pool before distributions are made to participants. This fee helps maintain and improve the platform infrastructure.`,
    },
    {
      question: "Can I cancel or withdraw from a market I've joined?",
      answer: "No, once you've committed funds to a prediction market, your participation cannot be cancelled or withdrawn. All positions are final once confirmed. This ensures market integrity and fairness for all participants.",
    },
    {
      question: "How do I add funds to my wallet?",
      answer: "Go to the Wallet page and use the 'Add Funds' or 'Deposit' section. Enter the amount you want to deposit, select your preferred payment method (Paystack or Stripe), and follow the payment instructions. Funds are typically available immediately after successful payment.",
    },
    {
      question: "How do I withdraw funds?",
      answer: "Go to the Wallet page and use the 'Withdraw' section. Enter the amount you wish to withdraw and provide your bank account details. Withdrawals are processed securely and typically take 1-3 business days to complete, subject to verification.",
    },
    {
      question: "What are system-generated markets?",
      answer: "System-generated markets are automatically created by our platform based on real-world events like sports, finance, politics, weather, and entertainment. They're marked with a special badge and help ensure there are always interesting markets available for participation.",
    },
    {
      question: "How are markets resolved?",
      answer: "Markets are resolved when the event concludes and the actual outcome is determined. Market creators or administrators verify the outcome based on verifiable sources, and distributions are automatically made to participants who correctly predicted the outcome.",
    },
    {
      question: "What happens if a market doesn't have a clear winner?",
      answer: "If a market outcome cannot be clearly determined, the market may be refunded, meaning all participants receive their original allocation back. This ensures fairness when outcomes are ambiguous or cannot be verified.",
    },
    {
      question: "Can I create custom categories?",
      answer: "Yes! Go to Preferences and scroll to 'Custom Categories' to create your own categories for organizing markets. This helps you find and organize markets that interest you most.",
    },
    {
      question: "How do I filter markets?",
      answer: "Set your preferred categories and tags in the Preferences page. The home page will then show markets matching your preferences. You can also use the search function to find specific markets.",
    },
    {
      question: "Is this platform legal in my country?",
      answer: "This is a prediction market and trading platform, not a betting or gambling platform. However, you are responsible for ensuring that participation in prediction markets is legal in your jurisdiction. Please check your local laws and regulations before participating. We operate in compliance with applicable regulations.",
    },
    {
      question: "What is KYC verification?",
      answer: "KYC (Know Your Customer) verification helps us ensure platform security and compliance. You may be required to verify your identity by providing government-issued ID, proof of address, and other documentation. Higher verification levels may be required for larger transactions or withdrawals.",
    },
    {
      question: "How do I report a problem or dispute?",
      answer: "If you encounter any issues or have a dispute, please contact us through our contact page or visit our Dispute Resolution Policy page for detailed information on how disputes are handled. We're committed to resolving issues fairly and promptly.",
    },
    {
      question: "What security measures protect my account?",
      answer: "We use industry-standard security measures including encryption, secure authentication, two-factor authentication (2FA), and regular security audits. Your funds and personal information are protected with the highest security standards.",
    },
    {
      question: "Can I use this platform if I'm under 18?",
      answer: "No. You must be at least 18 years old to use this platform. We verify user age during registration and may request additional verification. Accounts found to belong to minors will be immediately suspended.",
    },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <>
      <StructuredData data={faqSchema} />
      <main className="flex-1 pb-24 md:pb-0">
        <div className="max-w-4xl mx-auto p-4 md:p-6">
          <Breadcrumbs items={[{ name: "FAQ", url: "/faq" }]} className="mb-6" />
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-muted-foreground mb-8">
            Find answers to common questions about our prediction market and trading platform.
          </p>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-card border border-border rounded-lg p-5 md:p-6">
                <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
                <p className="text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}

