// Politics wager generator
// Generates wagers based on political events

export interface PoliticsWagerTemplate {
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  deadline: string;
  category: string;
  tags: string[];
}

export function generatePoliticsWagers(upcomingEvents: Array<{
  name: string;
  date: string;
  description?: string;
}>): PoliticsWagerTemplate[] {
  const wagers: PoliticsWagerTemplate[] = [];
  
  upcomingEvents.forEach((event) => {
    wagers.push({
      title: `Will ${event.name} happen as scheduled?`,
      description: event.description || `Political event scheduled for ${new Date(event.date).toLocaleDateString()}`,
      side_a: "Yes",
      side_b: "No",
      amount: 500,
      deadline: event.date,
      category: "politics",
      tags: ["politics", "elections", "government"],
    });
  });

  return wagers;
}

