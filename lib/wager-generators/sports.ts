// Sports wager generator
// Generates wagers based on upcoming sports events

export interface SportsWagerTemplate {
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  deadline: string;
  category: string;
  tags: string[];
}

export interface SportsEvent {
  sport: string;
  league: string;
  teamA: string;
  teamB: string;
  date: string;
  description?: string;
}

export function generateSportsWagers(events: SportsEvent[]): SportsWagerTemplate[] {
  const wagers: SportsWagerTemplate[] = [];
  
  events.forEach((event) => {
    wagers.push({
      title: `Will ${event.teamA} win against ${event.teamB}?`,
      description: `${event.league} match: ${event.teamA} vs ${event.teamB}`,
      side_a: event.teamA,
      side_b: event.teamB,
      amount: 500,
      deadline: event.date,
      category: "sports",
      tags: ["sports", event.sport.toLowerCase(), event.league.toLowerCase()],
    });

    // Add over/under wager if it's a scoring sport
    if (['football', 'basketball', 'soccer'].includes(event.sport.toLowerCase())) {
      wagers.push({
        title: `Will the total score be over 2.5 goals?`,
        description: `${event.teamA} vs ${event.teamB} - Total goals prediction`,
        side_a: "Over 2.5",
        side_b: "Under 2.5",
        amount: 300,
        deadline: event.date,
        category: "sports",
        tags: ["sports", event.sport.toLowerCase(), "over-under"],
      });
    }
  });

  return wagers;
}

// Note: Sports events should be fetched from a real API (e.g., TheSportsDB, SportRadar, etc.)
// This function is kept for type reference but should not be used in production
// Implement real API integration in the cron job route

