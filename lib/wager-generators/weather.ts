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

// Note: Weather events should be fetched from a real API (e.g., OpenWeatherMap, WeatherAPI, etc.)
// This function is kept for type reference but should not be used in production
// Implement real API integration in the cron job route

