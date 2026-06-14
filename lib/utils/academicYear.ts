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