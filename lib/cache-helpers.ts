import { unstable_cache } from 'next/cache';
import { getCurrentUser } from '@/server/users';
import { getOrganizations } from '@/server/organizations';

// Cache user data for 5 minutes
export const getCachedCurrentUser = unstable_cache(
  async () => getCurrentUser(),
  ['current-user'],
  {
    revalidate: 300, // 5 minutes
    tags: ['user']
  }
);

// Cache organizations for 10 minutes
export const getCachedOrganizations = unstable_cache(
  async () => getOrganizations(),
  ['organizations'],
  {
    revalidate: 600, // 10 minutes
    tags: ['organizations']
  }
);

// Cache individual organization for 10 minutes
export const getCachedOrganizationBySlug = unstable_cache(
  async (slug: string) => {
    const { getOrganizationBySlug } = await import('@/server/organizations');
    return getOrganizationBySlug(slug);
  },
  ['organization-by-slug'],
  {
    revalidate: 600, // 10 minutes
    tags: ['organizations']
  }
);
