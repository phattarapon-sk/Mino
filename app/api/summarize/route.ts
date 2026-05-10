import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { typhoon, LLM_MODEL, getSummaryPrompt, SummaryMode } from '@/lib/typhoon';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { jobId, mode } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const admin = createAdminClient();

    // 1. Fetch all transcript segments ordered by part_number
    const { data: segments, error: fetchError } = await admin
      .from('transcript_segments')
      .select('text, part_number')
      .eq('job_id', jobId)
      .order('part_number', { ascending: true });

    if (fetchError) {
      throw new Error(`Fetch segments failed: ${fetchError.message}`);
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'No transcript segments found for this job' },
        { status: 404 }
      );
    }

    // 2. Concatenate all segments into full transcript
    const fullTranscript = segments.map((s) => s.text).join('\n\n');

    // 3. Call Typhoon LLM for summary
    const completion = await typhoon.chat.completions.create({
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: getSummaryPrompt(mode as SummaryMode) },
        { role: 'user', content: fullTranscript },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const rawContent = completion.choices[0]?.message?.content ?? '{}';

    let parsed: { summary: any; key_points: string[] };
    let cleanContent = rawContent.trim();
    if (cleanContent.startsWith('```json')) {
      cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    try {
      parsed = JSON.parse(cleanContent);
    } catch {
      // If parsing fails (e.g. truncated), try to forcefully extract the array if we can
      let extractedSummary = [];
      try {
        const matches = cleanContent.match(/\{[^{}]*"speaker"[^{}]*\}/g);
        if (matches) {
          extractedSummary = matches.map(m => JSON.parse(m));
        }
      } catch (e) {}

      parsed = { 
        summary: extractedSummary.length > 0 ? extractedSummary : rawContent, 
        key_points: [] 
      };
    }

    const summaryText = typeof parsed.summary === 'string' 
      ? parsed.summary 
      : JSON.stringify(parsed.summary || []);

    // 4. Save to summaries table
    const { data: summaryData, error: summaryError } = await admin
      .from('summaries')
      .insert({
        job_id: jobId,
        summary_text: summaryText,
        key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      })
      .select()
      .single();

    if (summaryError) {
      throw new Error(`Summary insert failed: ${summaryError.message}`);
    }

    // 5. Update job status to done
    await admin.from('jobs').update({ status: 'done' }).eq('id', jobId);

    return NextResponse.json({
      summary: summaryText,
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      full_transcript: fullTranscript,
      summary_id: summaryData?.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/summarize]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
