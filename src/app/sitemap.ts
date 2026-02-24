import { SITE_URL } from '@/utils/consts';
import { headers } from 'next/headers';
import { MetadataRoute } from 'next';
import { getAllBlogPosts } from '@/app/actions/admin-blogs';
import { getAllRulesSections } from '@/app/actions/admin-rules';
import { getAllTests } from '@/app/actions/tests';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = await headersList.get('host');
  const proto = (await headersList.get('x-forwarded-proto')) || 'https';
  const baseUrl = `${proto}://${host}`;

  // Get published blog posts
  const blogPosts = await getAllBlogPosts(false);

  // Get all rules sections
  const rulesSections = await getAllRulesSections();

  // Get all tests
  const tests = await getAllTests();

  // Blog post URLs
  const blogUrls: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Rules section URLs
  const rulesUrls: MetadataRoute.Sitemap = rulesSections.map((section) => ({
    url: `${baseUrl}/rules/${section.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  // Test URLs
  const testUrls: MetadataRoute.Sitemap = tests.map((test) => ({
    url: `${baseUrl}/tests/${test.id}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}${SITE_URL.HOME}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}${SITE_URL.ABOUT}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}${SITE_URL.CONTACT}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}${SITE_URL.FAQ}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${SITE_URL.BLOG}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}${SITE_URL.TESTS}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}${SITE_URL.TRAINING}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${SITE_URL.RULES}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}${SITE_URL.ROAD_SIGNS}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${SITE_URL.ROAD_MARKINGS}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${SITE_URL.VEHICLE_IDENTIFICATION_SIGNS}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${SITE_URL.VEHICLE_TECHNICAL_DEFECTS}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${SITE_URL.TRAFFIC_LAW}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}${SITE_URL.PRIVACY_POLICY}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  return [...staticPages, ...blogUrls, ...rulesUrls, ...testUrls];
}
