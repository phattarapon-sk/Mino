import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { typhoon, ASR_MODEL } from '@/lib/typhoon';
import { toFile } from 'openai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { jobId, storagePath, partNumber } = await req.json();

    if (!jobId || !storagePath || partNumber === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: jobId, storagePath, partNumber' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Download audio chunk from Supabase Storage
    const { data: fileData, error: downloadError } = await admin.storage
      .from('temp-audio')
      .download(storagePath);

    if (downloadError || !fileData) {
      throw new Error(`Storage download failed: ${downloadError?.message}`);
    }

    const audioBuffer = await fileData.arrayBuffer();
    const fileName = storagePath.split('/').pop() || 'audio.wav';

    // 2. Send to Typhoon ASR
    const transcriptionResponse = await typhoon.audio.transcriptions.create({
      model: ASR_MODEL,
      file: await toFile(new Blob([audioBuffer], { type: 'audio/wav' }), fileName, {
        type: 'audio/wav',
      }),
    });

    const transcriptText = transcriptionResponse.text;

    // 3. Save to transcript_segments
    const { error: insertError } = await admin
      .from('transcript_segments')
      .insert({
        job_id: jobId,
        part_number: partNumber,
        text: transcriptText,
      });

    if (insertError) {
      throw new Error(`DB insert failed: ${insertError.message}`);
    }

    // 4. Delete chunk from storage (cleanup)
    await admin.storage.from('temp-audio').remove([storagePath]);

    // 5. Update job status
    await admin
      .from('jobs')
      .update({ status: 'transcribing' })
      .eq('id', jobId);

    return NextResponse.json({
      text: transcriptText,
      part_number: partNumber,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/transcribe]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
