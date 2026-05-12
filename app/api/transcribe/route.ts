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
    const CHUNK_DURATION = 10 * 60; // 10 minutes offset per part

    // 2. Send to Typhoon ASR
    const transcriptionResponse = await typhoon.audio.transcriptions.create({
      model: ASR_MODEL,
      file: await toFile(new Blob([audioBuffer], { type: 'audio/wav' }), fileName, {
        type: 'audio/wav',
      }),
      response_format: 'verbose_json',
      language: 'th', // Force Thai for better accuracy
      temperature: 0, // Most accurate
      prompt: 'ประชุมธุรกิจ, ภาษาไทย, มีการพูดคุยเรื่องสรุปประเด็นสำคัญ, งาน QA, ทีมผลิต, การจัดการข้อมูล', // Help with context
    }) as any;

    // Log Usage if available
    if (transcriptionResponse.usage) {
      console.log(`[ASR Usage Part ${partNumber}]`, transcriptionResponse.usage);
    } else {
      console.log(`[ASR Part ${partNumber}] Transcription complete (Usage not reported by API)`);
    }

    // 3. Process segments with timestamp offset
    let transcriptText = '';
    const offset = partNumber * CHUNK_DURATION;

    if (transcriptionResponse.segments) {
      transcriptText = transcriptionResponse.segments
        .map((seg: any) => {
          const start = seg.start + offset;
          const h = Math.floor(start / 3600);
          const m = Math.floor((start % 3600) / 60);
          const s = Math.floor(start % 60);
          const timeStr = h > 0 
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
          return `[${timeStr}] ${seg.text}`;
        })
        .join('\n');
    } else {
      transcriptText = transcriptionResponse.text;
    }

    // 4. Save to transcript_segments
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

    // 5. Delete chunk from storage (cleanup)
    await admin.storage.from('temp-audio').remove([storagePath]);

    // 6. Update job status
    await admin
      .from('jobs')
      .update({ status: 'transcribing' })
      .eq('id', jobId);

    return NextResponse.json({
      text: transcriptText,
      part_number: partNumber,
      usage: transcriptionResponse.usage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/transcribe]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
