/**
 * Geolocation utilities for detecting user's country
 * Uses multiple methods for reliable detection
 */

interface GeolocationData {
  country: string;
  countryCode: string;
  countryName: string;
  region?: string;
  city?: string;
  timezone?: string;
}

const GEOLOCATION_CACHE_KEY = 'wagr_geolocation_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get country from browser timezone (fallback method)
 */
function getCountryFromTimezone(): { countryCode: string; countryName: string } | null {
  if (typeof window === 'undefined' || typeof Intl === 'undefined') return null;

  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Map common timezones to countries (focus on African countries)
    const timezoneToCountry: Record<string, { code: string; name: string }> = {
      'Africa/Lagos': { code: 'NG', name: 'Nigeria' },
      'Africa/Cairo': { code: 'EG', name: 'Egypt' },
      'Africa/Johannesburg': { code: 'ZA', name: 'South Africa' },
      'Africa/Nairobi': { code: 'KE', name: 'Kenya' },
      'Africa/Accra': { code: 'GH', name: 'Ghana' },
      'Africa/Casablanca': { code: 'MA', name: 'Morocco' },
      'Africa/Tunis': { code: 'TN', name: 'Tunisia' },
      'Africa/Algiers': { code: 'DZ', name: 'Algeria' },
      'Africa/Addis_Ababa': { code: 'ET', name: 'Ethiopia' },
      'Africa/Dar_es_Salaam': { code: 'TZ', name: 'Tanzania' },
      'Africa/Kampala': { code: 'UG', name: 'Uganda' },
      'Africa/Dakar': { code: 'SN', name: 'Senegal' },
      'Africa/Abidjan': { code: 'CI', name: 'Ivory Coast' },
      'Africa/Douala': { code: 'CM', name: 'Cameroon' },
      'Africa/Kinshasa': { code: 'CD', name: 'DR Congo' },
      'Africa/Luanda': { code: 'AO', name: 'Angola' },
      'Africa/Maputo': { code: 'MZ', name: 'Mozambique' },
      'Africa/Harare': { code: 'ZW', name: 'Zimbabwe' },
      'Africa/Lusaka': { code: 'ZM', name: 'Zambia' },
    };

    if (timezoneToCountry[timezone]) {
      return timezoneToCountry[timezone];
    }

    // Try to extract from timezone string
    if (timezone.startsWith('Africa/')) {
      const city = timezone.replace('Africa/', '');
      // Return a generic African country code if we can't determine
      return { code: 'NG', name: 'Nigeria' }; // Default to Nigeria for African timezones
    }
  } catch (error) {
    console.error('Error getting country from timezone:', error);
  }

  return null;
}

/**
 * Get country from browser language (very fallback)
 */
function getCountryFromLanguage(): { countryCode: string; countryName: string } | null {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return null;

  try {
    const language = navigator.language || navigator.languages?.[0] || 'en';
    
    // Extract country code from locale (e.g., 'en-NG' -> 'NG')
    const parts = language.split('-');
    if (parts.length > 1) {
      const countryCode = parts[1].toUpperCase();
      // Map common country codes
      const countryNames: Record<string, string> = {
        'NG': 'Nigeria',
        'GH': 'Ghana',
        'KE': 'Kenya',
        'ZA': 'South Africa',
        'EG': 'Egypt',
        'MA': 'Morocco',
        'TN': 'Tunisia',
        'DZ': 'Algeria',
        'ET': 'Ethiopia',
        'TZ': 'Tanzania',
        'UG': 'Uganda',
        'SN': 'Senegal',
        'CI': 'Ivory Coast',
        'CM': 'Cameroon',
        'CD': 'DR Congo',
        'AO': 'Angola',
        'MZ': 'Mozambique',
        'ZW': 'Zimbabwe',
        'ZM': 'Zambia',
      };

      if (countryNames[countryCode]) {
        return { code: countryCode, name: countryNames[countryCode] };
      }
    }
  } catch (error) {
    console.error('Error getting country from language:', error);
  }

  return null;
}

/**
 * Detect country using IP geolocation API (primary method)
 */
async function detectCountryFromIP(): Promise<GeolocationData | null> {
  try {
    // Try ipapi.co first (free, no API key needed for basic usage)
    const response = await fetch('https://ipapi.co/json/', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.country_code && data.country_name) {
        return {
          country: data.country_code,
          countryCode: data.country_code,
          countryName: data.country_name,
          region: data.region,
          city: data.city,
          timezone: data.timezone,
        };
      }
    }
  } catch (error) {
    console.warn('ipapi.co failed, trying fallback:', error);
  }

  try {
    // Fallback to ip-api.com (free, no API key needed)
    const response = await fetch('http://ip-api.com/json/?fields=status,country,countryCode,region,city,timezone', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && data.countryCode && data.country) {
        return {
          country: data.countryCode,
          countryCode: data.countryCode,
          countryName: data.country,
          region: data.region,
          city: data.city,
          timezone: data.timezone,
        };
      }
    }
  } catch (error) {
    console.warn('ip-api.com failed:', error);
  }

  return null;
}

/**
 * Cache geolocation data
 */
function cacheGeolocationData(data: GeolocationData): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheData = {
      ...data,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(GEOLOCATION_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Failed to cache geolocation data:', error);
  }
}

/**
 * Get cached geolocation data
 */
function getCachedGeolocationData(): GeolocationData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cached = localStorage.getItem(GEOLOCATION_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);
    const cachedAt = new Date(data.cachedAt);
    const now = new Date();

    // Check if cache is still valid (24 hours)
    if (now.getTime() - cachedAt.getTime() > CACHE_DURATION) {
      localStorage.removeItem(GEOLOCATION_CACHE_KEY);
      return null;
    }

    // Remove cachedAt from returned data
    const { cachedAt: _, ...geolocationData } = data;
    return geolocationData as GeolocationData;
  } catch (error) {
    console.error('Failed to get cached geolocation data:', error);
    return null;
  }
}

/**
 * Detect user's country using multiple methods
 * Priority: IP Geolocation > Timezone > Language > Default (NG)
 */
export async function detectUserCountry(): Promise<GeolocationData> {
  // Check cache first
  const cached = getCachedGeolocationData();
  if (cached) {
    return cached;
  }

  // Try IP geolocation (most accurate)
  const ipData = await detectCountryFromIP();
  if (ipData) {
    cacheGeolocationData(ipData);
    return ipData;
  }

  // Fallback to timezone
  const timezoneData = getCountryFromTimezone();
  if (timezoneData) {
    const data: GeolocationData = {
      country: timezoneData.countryCode,
      countryCode: timezoneData.countryCode,
      countryName: timezoneData.countryName,
    };
    cacheGeolocationData(data);
    return data;
  }

  // Fallback to language
  const languageData = getCountryFromLanguage();
  if (languageData) {
    const data: GeolocationData = {
      country: languageData.countryCode,
      countryCode: languageData.countryCode,
      countryName: languageData.countryName,
    };
    cacheGeolocationData(data);
    return data;
  }

  // Default fallback (Nigeria - most likely for this platform)
  const defaultData: GeolocationData = {
    country: 'NG',
    countryCode: 'NG',
    countryName: 'Nigeria',
  };
  cacheGeolocationData(defaultData);
  return defaultData;
}

/**
 * Get country code only (simplified)
 */
export async function detectUserCountryCode(): Promise<string> {
  const data = await detectUserCountry();
  return data.countryCode;
}

