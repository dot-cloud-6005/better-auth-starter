"use client";

import { useEffect } from 'react';
import { performNavigationSync } from '@/lib/navigation-sync';

/**
 * Navigation Auth Sync Component
 * 
 * This component should be placed in the layout to automatically sync 
 * navigation data when the user first loads the app after authentication.
 * It runs once per session to ensure offline navigation data is up to date.
 */
export function NavigationAuthSync() {
  useEffect(() => {
    let cancelled = false;
    
    // Check if this is a new session or if sync is needed
    const lastAuthSync = localStorage.getItem('navigation_auth_sync');
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Only sync if it's been more than an hour since last auth sync
    // This prevents excessive syncing on every page load
    if (!lastAuthSync || (now - parseInt(lastAuthSync)) > oneHour) {
      console.log('NavigationAuthSync: Triggering initial navigation sync...');
      
      performNavigationSync()
        .then(result => {
          if (!cancelled) {
            if (result.error) {
              console.warn('NavigationAuthSync: Sync failed:', result.error);
            } else {
              console.log(`NavigationAuthSync: Sync complete - ${result.assetsUpdated} assets, ${result.inspectionsUpdated} inspections updated`);
              // Mark sync as completed
              localStorage.setItem('navigation_auth_sync', now.toString());
            }
          }
        })
        .catch(error => {
          if (!cancelled) {
            console.error('NavigationAuthSync: Sync error:', error);
          }
        });
    } else {
      console.log('NavigationAuthSync: Recent sync found, skipping');
    }
    
    return () => {
      cancelled = true;
    };
  }, []); // Run once on mount

  // This component renders nothing
  return null;
}

/**
 * Clear the auth sync timestamp to force a sync on next app load
 * Call this when user logs out or when you want to ensure fresh data
 */
export function clearNavigationAuthSync() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('navigation_auth_sync');
  }
}
