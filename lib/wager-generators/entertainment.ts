// Entertainment wager generator
// Generates wagers based on entertainment events (movies, TV shows, awards, etc.)

export interface EntertainmentWagerTemplate {
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  deadline: string;
  category: string;
  tags: string[];
}

export interface EntertainmentEvent {
  type: 'movie' | 'tv' | 'awards' | 'music' | 'gaming';
  name: string;
  date: string;
  description?: string;
  options?: string[];
}

export function generateEntertainmentWagers(events: EntertainmentEvent[]): EntertainmentWagerTemplate[] {
  const wagers: EntertainmentWagerTemplate[] = [];
  
  events.forEach((event) => {
    switch (event.type) {
      case 'movie':
        wagers.push({
          title: `Will "${event.name}" gross over $100M in its opening weekend?`,
          description: `Box office prediction for ${event.name}`,
          side_a: "Yes",
          side_b: "No",
          amount: 400,
          deadline: event.date,
          category: "entertainment",
          tags: ["entertainment", "movies", "box-office"],
        });
        break;
      
      case 'awards':
        if (event.options && event.options.length >= 2) {
          wagers.push({
            title: `Who will win ${event.name}?`,
            description: event.description || `Award prediction for ${event.name}`,
            side_a: event.options[0],
            side_b: event.options[1] || "Other",
            amount: 500,
            deadline: event.date,
            category: "entertainment",
            tags: ["entertainment", "awards", event.name.toLowerCase()],
          });
        }
        break;
      
      case 'tv':
        wagers.push({
          title: `Will "${event.name}" be renewed for another season?`,
          description: `TV show renewal prediction`,
          side_a: "Yes",
          side_b: "No",
          amount: 300,
          deadline: event.date,
          category: "entertainment",
          tags: ["entertainment", "tv", "renewal"],
        });
        break;
      
      case 'music':
        wagers.push({
          title: `Will "${event.name}" reach #1 on Billboard?`,
          description: `Music chart prediction`,
          side_a: "Yes",
          side_b: "No",
          amount: 350,
          deadline: event.date,
          category: "entertainment",
          tags: ["entertainment", "music", "charts"],
        });
        break;
      
      case 'gaming':
        wagers.push({
          title: `Will "${event.name}" sell over 1M copies in first week?`,
          description: `Video game sales prediction`,
          side_a: "Yes",
          side_b: "No",
          amount: 400,
          deadline: event.date,
          category: "entertainment",
          tags: ["entertainment", "gaming", "sales"],
        });
        break;
    }
  });

  return wagers;
}

// Mock entertainment events generator
export function getMockEntertainmentEvents(): EntertainmentEvent[] {
  const now = new Date();
  const events: EntertainmentEvent[] = [];

  // Add some upcoming events
  const movieDate = new Date(now);
  movieDate.setDate(movieDate.getDate() + 30);
  events.push({
    type: 'movie',
    name: 'Upcoming Blockbuster',
    date: movieDate.toISOString(),
    description: 'Highly anticipated movie release',
  });

  const awardsDate = new Date(now);
  awardsDate.setDate(awardsDate.getDate() + 60);
  events.push({
    type: 'awards',
    name: 'Best Picture',
    date: awardsDate.toISOString(),
    options: ['Movie A', 'Movie B', 'Movie C'],
  });

  return events;
}

