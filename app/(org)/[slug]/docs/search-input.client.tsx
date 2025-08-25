'use client';
import { ChangeEvent } from 'react';

export function DocsSearch() {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const q = e.target.value.toLowerCase();
    const sections = document.querySelectorAll('main section[id]');
    sections.forEach(sec => {
      const text = sec.textContent?.toLowerCase() || '';
      (sec as HTMLElement).style.display = q && !text.includes(q) ? 'none' : '';
    });
  }
  return (
    <div className="relative max-w-lg">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="search"
        placeholder="Search documentation topics..."
        className="w-full pl-12 pr-4 py-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 placeholder:text-muted-foreground/60"
        aria-label="Search docs"
        onChange={handleChange}
      />
    </div>
  );
}
