// lib/utils/academicYear.ts
export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, June is 5
  
  // Academic year starts in June
  if (month >= 5) { // June to December
    return `${year}-${year + 1}`;
  } else { // January to May
    return `${year - 1}-${year}`;
  }
}

export function parseAcademicYear(academicYear: string): { startYear: number; endYear: number } {
  const [start, end] = academicYear.split("-").map(Number);
  return { startYear: start, endYear: end };
}

export function formatDateForStorage(date: Date): string {
  return date.toISOString();
}

export function formatDateForDisplay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Get the next academic year
 */
export function getNextAcademicYear(currentYear: string): string {
  const { startYear } = parseAcademicYear(currentYear);
  return `${startYear + 1}-${startYear + 2}`;
}

/**
 * Get previous academic year
 */
export function getPreviousAcademicYear(currentYear: string): string {
  const { startYear } = parseAcademicYear(currentYear);
  return `${startYear - 1}-${startYear}`;
}

/**
 * Check if a date is within an academic year
 */
export function isDateInAcademicYear(date: Date, academicYear: string): boolean {
  const { startYear, endYear } = parseAcademicYear(academicYear);
  const year = date.getFullYear();
  const month = date.getMonth();
  
  if (month >= 5) {
    return year === startYear;
  } else {
    return year === endYear;
  }
}