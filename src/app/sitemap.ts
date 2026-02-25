import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getMovies } from '@/app/actions/movies';
import { getScreenings } from '@/app/actions/screenings';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = headersList.get('host');
  const proto = headersList.get('x-forwarded-proto') || 'https';
  const baseUrl = `${proto}://${host}`;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/movies`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/schedule`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tickets`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contacts`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.4,
    },
  ];

  // Dynamic movie pages
  let movieUrls: MetadataRoute.Sitemap = [];
  try {
    const moviesResult = await getMovies();
    if (moviesResult.success && moviesResult.movies) {
      movieUrls = moviesResult.movies.map((movie) => ({
        url: `${baseUrl}/movies/${movie.slug || movie.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }));
    }
  } catch {
    // ignore – sitemap still works without movie URLs
  }

  // Dynamic screening pages
  let screeningUrls: MetadataRoute.Sitemap = [];
  try {
    const screeningsResult = await getScreenings();
    if (screeningsResult.success && screeningsResult.screenings) {
      screeningUrls = screeningsResult.screenings.map((screening) => ({
        url: `${baseUrl}/screening/${screening.id}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      }));
    }
  } catch {
    // ignore
  }

  return [...staticPages, ...movieUrls, ...screeningUrls];
}
