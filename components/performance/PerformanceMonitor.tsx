// components/performance/PerformanceMonitor.tsx
"use client";

import { useEffect } from 'react';

export function PerformanceMonitor() {
  useEffect(() => {
    // ✅ Report Core Web Vitals
    if ('web-vitals' in window) {
      import('web-vitals').then(({ onLCP, onFID, onCLS }) => {
        onLCP(console.log);
        onFID(console.log);
        onCLS(console.log);
      });
    }
  }, []);

  return null;
}