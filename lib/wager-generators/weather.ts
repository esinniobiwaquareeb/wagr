// Weather wager generator
// Generates wagers based on weather predictions

export interface WeatherWagerTemplate {
  title: string;
  description: string;
  side_a: string;
  side_b: string;
  amount: number;
  deadline: string;
  category: string;
  tags: string[];
}

export interface WeatherEvent {
  location: string;
  date: string;
  prediction: {
    type: 'rain' | 'temperature' | 'snow' | 'wind';
    threshold: number;
    unit: string;
  };
}

export function generateWeatherWagers(events: WeatherEvent[]): WeatherWagerTemplate[] {
  const wagers: WeatherWagerTemplate[] = [];
  
  events.forEach((event) => {
    const { type, threshold, unit } = event.prediction;
    
    switch (type) {
      case 'rain':
        wagers.push({
          title: `Will it rain in ${event.location} on ${new Date(event.date).toLocaleDateString()}?`,
          description: `Weather prediction for ${event.location}`,
          side_a: "Yes",
          side_b: "No",
          amount: 200,
          deadline: event.date,
          category: "weather",
          tags: ["weather", "rain", event.location.toLowerCase()],
        });
        break;
      
      case 'temperature':
        wagers.push({
          title: `Will temperature in ${event.location} exceed ${threshold}°${unit} on ${new Date(event.date).toLocaleDateString()}?`,
          description: `Temperature prediction for ${event.location}`,
          side_a: "Yes",
          side_b: "No",
          amount: 200,
          deadline: event.date,
          category: "weather",
          tags: ["weather", "temperature", event.location.toLowerCase()],
        });
        break;
      
      case 'snow':
        wagers.push({
          title: `Will it snow in ${event.location} on ${new Date(event.date).toLocaleDateString()}?`,
          description: `Snow prediction for ${event.location}`,
          side_a: "Yes",
          side_b: "No",
          amount: 200,
          deadline: event.date,
          category: "weather",
          tags: ["weather", "snow", event.location.toLowerCase()],
        });
        break;
    }
  });

  return wagers;
}

// Mock weather events generator
export function getMockWeatherEvents(): WeatherEvent[] {
  const now = new Date();
  const events: WeatherEvent[] = [];
  const locations = ['New York', 'London', 'Tokyo', 'Sydney', 'Los Angeles'];

  // Generate events for next 5 days
  for (let i = 1; i <= 5; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const location = locations[i % locations.length];

    events.push({
      location,
      date: date.toISOString(),
      prediction: {
        type: i % 2 === 0 ? 'rain' : 'temperature',
        threshold: i % 2 === 0 ? 0 : 25,
        unit: i % 2 === 0 ? 'mm' : 'C',
      },
    });
  }

  return events;
}

