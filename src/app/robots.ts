import { headers } from "next/headers";

export default async function robots() {
  const headersList = await headers();
  const host = await headersList.get("host");
  const proto = await headersList.get("x-forwarded-proto");
  return {
    rules: {
      userAgent: "*",
    },
    sitemap: `${proto}://${host}/sitemap.xml`,
  };
}
