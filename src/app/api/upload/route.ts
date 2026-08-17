import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Ֆայլը չի ներբեռնվել' },
        { status: 400 }
      );
    }

    const kind = String(formData.get('kind') || 'image');
    const imageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
    ];
    const documentTypes = [
      ...imageTypes,
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const allowedExts =
      kind === 'document'
        ? ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'doc', 'docx']
        : ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const fileExtension = (file.name.split('.').pop() || '').toLowerCase();
    if (!allowedExts.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Ֆայլի տեսակը թույլատրված չէ' },
        { status: 400 }
      );
    }

    const allowedTypes = kind === 'document' ? documentTypes : imageTypes;
    const typeOk =
      allowedTypes.includes(file.type) ||
      (kind === 'document' && !file.type);
    if (!typeOk) {
      return NextResponse.json(
        {
          error:
            kind === 'document'
              ? 'Թույլատրվում են PDF, Word և նկար ֆայլեր'
              : 'Միայն նկարների ֆայլեր են թույլատրված (JPEG, PNG, WebP, GIF)',
        },
        { status: 400 }
      );
    }

    const maxSize = (kind === 'document' ? 15 : 5) * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          error:
            kind === 'document'
              ? 'Ֆայլի չափը չպետք է գերազանցի 15MB'
              : 'Ֆայլի չափը չպետք է գերազանցի 5MB',
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to /uploads at the project root (outside public/)
    const uploadDir = join(process.cwd(), 'uploads');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filename = `${timestamp}-${randomString}.${fileExtension}`;
    const filepath = join(uploadDir, filename);

    await writeFile(filepath, buffer);

    // Served via /api/files/[filename]
    const fileUrl = `/api/files/${filename}`;

    return NextResponse.json({
      success: true,
      url: fileUrl,
      filename: filename,
      originalName: file.name,
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json(
      { error: 'Ֆայլի ներբեռնումը ձախողվեց' },
      { status: 500 }
    );
  }
}
