// 'use server';

// import { prisma } from '@/lib/prisma';
// import { revalidatePath } from 'next/cache';
// import { deleteImageFile } from '@/utils/image-delete';

// export interface BlogPost {
//   id: number;
//   title: string;
//   slug: string;
//   excerpt: string;
//   content: string;
//   featuredImage: string | null;
//   metaTitle: string | null;
//   metaDescription: string | null;
//   keywords: string | null;
//   isPublished: boolean;
//   publishedAt: Date | null;
//   createdAt: Date;
//   updatedAt: Date;
// }

// export async function getAllBlogPosts(includeUnpublished = false) {
//   try {
//     const where = includeUnpublished ? {} : { isPublished: true };

//     const posts = await prisma.blogPost.findMany({
//       where,
//       orderBy: [{ createdAt: 'desc' }],
//     });

//     // Sort manually to handle null publishedAt values
//     return posts.sort((a: BlogPost, b: BlogPost) => {
//       if (a.publishedAt && b.publishedAt) {
//         return b.publishedAt.getTime() - a.publishedAt.getTime();
//       }
//       if (a.publishedAt && !b.publishedAt) return -1;
//       if (!a.publishedAt && b.publishedAt) return 1;
//       return b.createdAt.getTime() - a.createdAt.getTime();
//     });
//   } catch (error) {
//     console.error('Error fetching blog posts:', error);
//     return [];
//   }
// }

// export async function getBlogPostBySlug(slug: string) {
//   try {
//     // Next.js already decodes URL params, but handle both cases
//     const decodedSlug = decodeURIComponent(slug);
//     console.log('getBlogPostBySlug - original slug:', slug);
//     console.log('getBlogPostBySlug - decoded slug:', decodedSlug);

//     // Try with original slug first (Next.js should already decode it)
//     let post = await prisma.blogPost.findUnique({
//       where: { slug },
//     });

//     // If not found and slug was encoded, try with decoded version
//     if (!post && decodedSlug !== slug) {
//       console.log('getBlogPostBySlug - trying with decoded slug');
//       post = await prisma.blogPost.findUnique({
//         where: { slug: decodedSlug },
//       });
//     }

//     console.log(
//       'getBlogPostBySlug - found:',
//       post ? `YES (${post.title})` : 'NO'
//     );
//     return post;
//   } catch (error) {
//     console.error('Error fetching blog post:', error);
//     return null;
//   }
// }

// export async function getBlogPostById(id: number) {
//   try {
//     const post = await prisma.blogPost.findUnique({
//       where: { id },
//     });

//     return post;
//   } catch (error) {
//     console.error('Error fetching blog post:', error);
//     return null;
//   }
// }

// function generateSlug(title: string): string {
//   return title
//     .toLowerCase()
//     .trim()
//     .replace(/[^\u0561-\u0587\u0531-\u0556a-z0-9\s-]/g, '')
//     .replace(/\s+/g, '-')
//     .replace(/-+/g, '-')
//     .replace(/^-+|-+$/g, '');
// }

// export async function createBlogPost(data: {
//   title: string;
//   slug?: string;
//   excerpt: string;
//   content: string;
//   featuredImage?: string | null;
//   metaTitle?: string | null;
//   metaDescription?: string | null;
//   keywords?: string | null;
//   isPublished?: boolean;
//   publishedAt?: Date | null;
// }) {
//   try {
//     let slug = data.slug?.trim() || generateSlug(data.title);

//     // Ensure slug is unique
//     let counter = 1;
//     let uniqueSlug = slug;
//     while (await prisma.blogPost.findUnique({ where: { slug: uniqueSlug } })) {
//       uniqueSlug = `${slug}-${counter}`;
//       counter++;
//     }

//     const post = await prisma.blogPost.create({
//       data: {
//         title: data.title,
//         slug: uniqueSlug,
//         excerpt: data.excerpt,
//         content: data.content,
//         featuredImage: data.featuredImage || null,
//         metaTitle: data.metaTitle || null,
//         metaDescription: data.metaDescription || null,
//         keywords: data.keywords || null,
//         isPublished: data.isPublished || false,
//         publishedAt: data.isPublished ? data.publishedAt || new Date() : null,
//       },
//     });

//     revalidatePath('/blog');
//     revalidatePath(`/blog/${post.slug}`);
//     return { success: true, post };
//   } catch (error: any) {
//     console.error('Error creating blog post:', error);
//     return { success: false, error: error.message || 'Սխալ է տեղի ունեցել' };
//   }
// }

// export async function updateBlogPost(
//   id: number,
//   data: {
//     title?: string;
//     slug?: string;
//     excerpt?: string;
//     content?: string;
//     featuredImage?: string | null;
//     metaTitle?: string | null;
//     metaDescription?: string | null;
//     keywords?: string | null;
//     isPublished?: boolean;
//     publishedAt?: Date | null;
//   }
// ) {
//   try {
//     const existingPost = await prisma.blogPost.findUnique({
//       where: { id },
//     });

//     if (!existingPost) {
//       return { success: false, error: 'Հոդվածը չի գտնվել' };
//     }

//     let slug = data.slug?.trim();
//     if (data.title && !slug) {
//       slug = generateSlug(data.title);
//     } else if (!slug) {
//       slug = existingPost.slug;
//     }

//     // Check slug uniqueness if it's being changed
//     if (slug !== existingPost.slug) {
//       let counter = 1;
//       let uniqueSlug = slug;
//       while (
//         await prisma.blogPost.findFirst({
//           where: { slug: uniqueSlug, id: { not: id } },
//         })
//       ) {
//         uniqueSlug = `${slug}-${counter}`;
//         counter++;
//       }
//       slug = uniqueSlug;
//     }

//     const updateData: any = {};
//     if (data.title !== undefined) updateData.title = data.title;
//     if (slug !== undefined) updateData.slug = slug;
//     if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
//     if (data.content !== undefined) updateData.content = data.content;
//     if (data.featuredImage !== undefined)
//       updateData.featuredImage = data.featuredImage;
//     if (data.metaTitle !== undefined) updateData.metaTitle = data.metaTitle;
//     if (data.metaDescription !== undefined)
//       updateData.metaDescription = data.metaDescription;
//     if (data.keywords !== undefined) updateData.keywords = data.keywords;
//     if (data.isPublished !== undefined) {
//       updateData.isPublished = data.isPublished;
//       if (data.isPublished && !existingPost.publishedAt) {
//         updateData.publishedAt = data.publishedAt || new Date();
//       } else if (!data.isPublished) {
//         updateData.publishedAt = null;
//       } else if (data.publishedAt !== undefined) {
//         updateData.publishedAt = data.publishedAt;
//       }
//     } else if (data.publishedAt !== undefined) {
//       updateData.publishedAt = data.publishedAt;
//     }

//     const updatedPost = await prisma.blogPost.update({
//       where: { id },
//       data: updateData,
//     });

//     revalidatePath('/blog');
//     revalidatePath(`/blog/${existingPost.slug}`);
//     if (updatedPost.slug !== existingPost.slug) {
//       revalidatePath(`/blog/${updatedPost.slug}`);
//     }

//     return { success: true, post: updatedPost };
//   } catch (error: any) {
//     console.error('Error updating blog post:', error);
//     return { success: false, error: error.message || 'Սխալ է տեղի ունեցել' };
//   }
// }

// export async function deleteBlogPost(id: number) {
//   try {
//     const postToDelete = await prisma.blogPost.findUnique({
//       where: { id },
//       select: { slug: true, featuredImage: true },
//     });

//     if (!postToDelete) {
//       return { success: false, error: 'Հոդվածը չի գտնվել' };
//     }

//     // Delete the featured image file if it exists (supports both old and new paths)
//     if (postToDelete.featuredImage) {
//       await deleteImageFile(postToDelete.featuredImage);
//     }

//     await prisma.blogPost.delete({
//       where: { id },
//     });

//     revalidatePath('/blog');
//     revalidatePath(`/blog/${postToDelete.slug}`);

//     return { success: true };
//   } catch (error: any) {
//     console.error('Error deleting blog post:', error);
//     return { success: false, error: error.message || 'Սխալ է տեղի ունեցել' };
//   }
// }
