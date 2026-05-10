import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { fileName, totalChunks } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: 'Missing fileName' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from('jobs')
      .insert({
        file_name: fileName,
        status: 'pending',
        total_chunks: totalChunks ?? 1,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'ไม่ได้รับ id จาก database');
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/jobs]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
