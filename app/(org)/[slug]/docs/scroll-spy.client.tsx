'use client';

import { useEffect } from 'react';

export function ScrollSpy() {
  useEffect(() => {
    const links = [...document.querySelectorAll('#doc-toc a')] as HTMLAnchorElement[];
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Remove active state from all links
            links.forEach((link) => {
              link.dataset.active = 'false';
            });
            
            // Set active state for current section
            const id = entry.target.getAttribute('id');
            const activeLink = links.find(
              (link) => link.getAttribute('href') === `#${id}`
            );
            if (activeLink) {
              activeLink.dataset.active = 'true';
            }
          }
        });
      },
      {
        rootMargin: '0px 0px -70% 0px',
        threshold: [0, 1]
      }
    );

    // Observe all sections
    const sections = document.querySelectorAll('main section[id]');
    sections.forEach((section) => observer.observe(section));

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
}
