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
    // Create more relevant wager titles based on news content
    const eventDate = new Date(event.date);
    const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    // Generate different wager types based on the news
    let title = event.name;
    let sideA = "Yes";
    let sideB = "No";
    
    // If the title is too long, create a shorter version
    if (title.length > 100) {
      title = title.substring(0, 97) + "...";
    }
    
    // Create wager based on the event
    wagers.push({
      title: title.length > 60 ? `Will this happen within ${daysUntil} days?` : title,
      description: event.description || `Recent political news: ${event.name}`,
      side_a: sideA,
      side_b: sideB,
      amount: 500,
      deadline: event.date,
      category: "politics",
      tags: ["politics", "news", "current-events"],
    });
  });

  return wagers;
}

