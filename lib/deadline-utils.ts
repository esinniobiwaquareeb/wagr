/**
 * Deadline Utility Functions
 * 
 * Handles all deadline conversions and validations consistently
 * Ensures UTC storage and proper local timezone display
 */

/**
 * Convert local datetime string (from datetime-local input) to UTC ISO string
 * @param localDateTime - String from datetime-local input (e.g., "2025-11-18T10:00")
 * @returns UTC ISO string (e.g., "2025-11-18T10:00:00.000Z") or null if invalid
 */
export function localToUTC(localDateTime: string | null | undefined): string | null {
  if (!localDateTime || localDateTime.trim() === '') {
    return null;
  }

  try {
    // Parse the local datetime string
    // datetime-local gives us a string without timezone info, which JavaScript interprets as local time
    const localDate = new Date(localDateTime);
    
    // Validate the date
    if (isNaN(localDate.getTime())) {
      return null;
    }
    
    // Convert to UTC ISO string
    return localDate.toISOString();
  } catch (error) {
    console.error('Error converting local to UTC:', error);
    return null;
  }
}

/**
 * Convert UTC ISO string (from database) to local datetime string for datetime-local input
 * @param utcDateTime - UTC ISO string from database (e.g., "2025-11-18T10:00:00.000Z")
 * @returns Local datetime string for datetime-local input (e.g., "2025-11-18T10:00") or empty string
 */
export function utcToLocal(utcDateTime: string | null | undefined): string {
  if (!utcDateTime || utcDateTime.trim() === '') {
    return '';
  }

  try {
    // Parse UTC datetime string
    const utcDate = new Date(utcDateTime);
    
    // Validate the date
    if (isNaN(utcDate.getTime())) {
      return '';
    }
    
    // Get local date components for datetime-local input
    // datetime-local expects YYYY-MM-DDTHH:mm format in local timezone
    const year = utcDate.getFullYear();
    const month = String(utcDate.getMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getDate()).padStart(2, '0');
    const hours = String(utcDate.getHours()).padStart(2, '0');
    const minutes = String(utcDate.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (error) {
    console.error('Error converting UTC to local:', error);
    return '';
  }
}

/**
 * Parse deadline from database (handles various formats)
 * Always returns a valid Date object in UTC or null
 * @param deadline - Deadline string from database (could be ISO string, timestamp, etc.)
 * @returns Date object in UTC or null if invalid
 */
export function parseDeadline(deadline: string | null | undefined): Date | null {
  if (!deadline || deadline.trim() === '') {
    return null;
  }

  try {
    const date = new Date(deadline);
    
    // Validate the date
    if (isNaN(date.getTime())) {
      return null;
    }
    
    return date;
  } catch (error) {
    console.error('Error parsing deadline:', error);
    return null;
  }
}

/**
 * Check if deadline has elapsed
 * @param deadline - Deadline string from database or Date object
 * @returns true if deadline has passed, false otherwise
 */
export function isDeadlineElapsed(deadline: string | Date | null | undefined): boolean {
  if (!deadline) {
    return false; // No deadline means it never elapses
  }

  const deadlineDate = deadline instanceof Date ? deadline : parseDeadline(deadline);
  
  if (!deadlineDate) {
    return false;
  }

  const now = new Date();
  return deadlineDate.getTime() <= now.getTime();
}

/**
 * Get time remaining until deadline in milliseconds
 * @param deadline - Deadline string from database or Date object
 * @returns Time difference in milliseconds (positive if future, negative if past, 0 if no deadline)
 */
export function getTimeRemaining(deadline: string | Date | null | undefined): number {
  if (!deadline) {
    return 0;
  }

  const deadlineDate = deadline instanceof Date ? deadline : parseDeadline(deadline);
  
  if (!deadlineDate) {
    return 0;
  }

  const now = new Date();
  return deadlineDate.getTime() - now.getTime();
}

/**
 * Validate deadline is in the future
 * @param deadline - Local datetime string or Date object
 * @returns true if deadline is in the future, false otherwise
 */
export function isDeadlineValid(deadline: string | Date | null | undefined): boolean {
  if (!deadline) {
    return true; // No deadline is valid (optional field)
  }

  let deadlineDate: Date;
  
  if (deadline instanceof Date) {
    deadlineDate = deadline;
  } else {
    // Assume it's a local datetime string
    deadlineDate = new Date(deadline);
  }
  
  if (isNaN(deadlineDate.getTime())) {
    return false;
  }

  const now = new Date();
  return deadlineDate.getTime() > now.getTime();
}

