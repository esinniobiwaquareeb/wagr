export default function FAQPage() {
  const faqs = [
    {
      question: "How do I create a wager?",
      answer: "Click the '+' button in the navigation (or 'Create' on desktop) to create a new wager. Fill in the title, sides, entry amount, and optional deadline, then submit.",
    },
    {
      question: "How are winnings calculated?",
      answer: "Winnings are distributed proportionally among winners based on their stake. The platform fee is deducted from the total pool before distribution.",
    },
    {
      question: "What is the platform fee?",
      answer: "The platform fee is 5% of the total wager pool. This fee is automatically deducted before winnings are distributed to winners.",
    },
    {
      question: "Can I cancel a wager I've joined?",
      answer: "No, once you've placed a wager, it cannot be cancelled. All wagers are final.",
    },
    {
      question: "How do I add funds to my wallet?",
      answer: "Go to the Wallet page and use the 'Add Funds' section. Enter the amount you want to deposit and click 'Deposit'.",
    },
    {
      question: "What are system-generated wagers?",
      answer: "System-generated wagers are automatically created by wagr based on real-world events like sports, finance, politics, weather, and entertainment. They're marked with an 'Auto' badge.",
    },
    {
      question: "How are wagers settled?",
      answer: "Wagers are automatically settled when the deadline passes and a winning side is determined. Winnings are then distributed to participants who chose the winning side.",
    },
    {
      question: "Can I create custom categories?",
      answer: "Yes! Go to Preferences and scroll to 'Custom Categories' to create your own categories for organizing wagers.",
    },
    {
      question: "How do I filter wagers?",
      answer: "Set your preferred categories and tags in the Preferences page. The home page will then show wagers matching your preferences.",
    },
    {
      question: "Is wagr legal in my country?",
      answer: "You are responsible for ensuring that wagering activities are legal in your jurisdiction. Please check your local laws before participating.",
    },
  ];

  return (
    <main className="flex-1 pb-24 md:pb-0">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mb-8">
          Find answers to common questions about wagr.
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
  );
}

