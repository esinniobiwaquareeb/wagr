// A/B Testing Infrastructure
// Simple client-side A/B testing utility

export type Variant = 'A' | 'B';

interface ABTestConfig {
  testName: string;
  variants: Variant[];
  defaultVariant: Variant;
}

// Store test assignments in localStorage
const STORAGE_KEY_PREFIX = 'wagr_ab_test_';

export function getVariant(testName: string, variants: Variant[] = ['A', 'B'], defaultVariant: Variant = 'A'): Variant {
  if (typeof window === 'undefined') return defaultVariant;

  const storageKey = `${STORAGE_KEY_PREFIX}${testName}`;
  const stored = localStorage.getItem(storageKey) as Variant | null;

  if (stored && variants.includes(stored)) {
    return stored;
  }

  // Assign variant based on consistent hash of user ID or random
  const variant = assignVariant(testName, variants);
  localStorage.setItem(storageKey, variant);
  
  // Track assignment
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'ab_test_assignment', {
      test_name: testName,
      variant: variant,
    });
  }

  return variant;
}

function assignVariant(testName: string, variants: Variant[]): Variant {
  // Use consistent hash based on test name and user session
  // This ensures same user gets same variant
  const sessionId = getSessionId();
  const hash = simpleHash(`${testName}_${sessionId}`);
  return variants[hash % variants.length];
}

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  let sessionId = sessionStorage.getItem('wagr_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('wagr_session_id', sessionId);
  }
  return sessionId;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function trackABTestEvent(testName: string, variant: Variant, eventName: string, eventData?: Record<string, any>) {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', eventName, {
      test_name: testName,
      variant: variant,
      ...eventData,
    });
  }
}

// Predefined A/B tests
export const AB_TESTS = {
  HOME_LAYOUT: 'home_layout',
  WAGER_CARD_DESIGN: 'wager_card_design',
  NAVIGATION_STYLE: 'navigation_style',
  CREATE_FORM_LAYOUT: 'create_form_layout',
  BUTTON_STYLE: 'button_style',
  WAGERS_PAGE_LAYOUT: 'wagers_page_layout', // A: Tabs with horizontal scroll, B: Vertical grid with filters
} as const;

