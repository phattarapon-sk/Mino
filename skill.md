# 🧠 Mino — Agent Skill & Context Document

> **วัตถุประสงค์**: Document นี้เขียนสำหรับ AI agents ที่ต้องการเข้าใจระบบ Mino และสามารถทำงานต่อได้ทันที
> **กฎ**: เมื่อ agent ทำงานอะไรเสร็จ ให้ **อัปเดต section "📋 สถานะปัจจุบัน"** ด้วยว่าทำอะไรไปแล้ว และ section "⏳ งานที่ยังค้างอยู่" ให้ถูกต้องเสมอ

---

## 🗺️ ภาพรวมโปรเจกต์

**Mino** = Thai Audio Transcription & Meeting Summary App
- Tagline: "Meeting Notes · Thai-first"
- Stack: Next.js 14 App Router + TypeScript + Tailwind CSS + Supabase + Typhoon AI
- Deploy target: Vercel (free tier)

### สิ่งที่แอปทำ
1. ผู้ใช้อัปโหลดไฟล์เสียง หรือ อัดเสียงตรงจากเบราว์เซอร์
2. ffmpeg.wasm normalize เสียง + แบ่ง chunk ถ้า > 25MB
3. Upload chunk ไป Supabase Storage (`temp-audio` bucket)
4. เรียก `/api/transcribe` ทีละ chunk → Typhoon ASR → บันทึก DB → ลบ Storage
5. เรียก `/api/summarize` → Typhoon LLM → สรุป JSON → แสดงผล

---

## 📁 โครงสร้างไฟล์

```
C:\Users\IT-Phattarapon.sk\Desktop\Mino\
├── app/
│   ├── layout.tsx              ← Noto Sans Thai + <Toaster />
│   ├── page.tsx                ← Main UI (wires all components)
│   ├── globals.css             ← Tailwind directives + CSS vars
│   └── api/
│       ├── jobs/route.ts       ← POST: สร้าง job (ใช้ service role บยปาส RLS)
│       ├── transcribe/route.ts ← POST: download→ASR→DB→cleanup
│       └── summarize/route.ts  ← POST: fetch segments→LLM→summary
├── components/
│   ├── UploadZone.tsx          ← Drag-drop + "เริ่มถอดเสียง" button
│   ├── RecordButton.tsx        ← Mic UI + waveform animation
│   ├── ProgressSection.tsx     ← Progress bar + chunk pills
│   └── ResultCard.tsx          ← Summary/transcript tabs + actions
├── hooks/
│   ├── useAudioProcessor.ts    ← Core pipeline orchestration
│   └── useRecorder.ts          ← MediaRecorder wrapper
├── lib/
│   ├── supabase.ts             ← createClient (browser + admin)
│   └── typhoon.ts              ← OpenAI-compatible client
├── .env.local                  ← Credentials (NOT in git)
├── next.config.js              ← WASM + COOP/COEP headers
└── tailwind.config.js          ← Design tokens
```

---

## 🎨 Design System

| Token | Value | ใช้กับ |
|---|---|---|
| `primary` | `#185FA5` | ปุ่มหลัก, active tab, border |
| `primary-light` | `#E6F1FB` | Background hover, badge bg |
| `primary-mid` | `#378ADD` | Gradient, progress bar |
| `primary-dark` | `#0C447C` | Hover state ของปุ่ม |
| `surface` | `#F8FAFD` | Page background |
| `border` | `#D0DFF0` | Card borders |
| `text` | `#0C1A2E` | Body text |
| `muted` | `#5A7A99` | Placeholder, label text |

Font: **Noto Sans Thai** (Google Fonts, variable `--font-noto-sans-thai`)
Icons: **lucide-react** เท่านั้น
Toast: **sonner** — `import { toast } from 'sonner'`

---

## 🔌 API Routes

### `POST /api/jobs`
```json
// Request body
{ "fileName": "audio.m4a", "totalChunks": 1 }

// Response
{ "id": "uuid" }
```
- ใช้ **service role key** (server-side) — ไม่ต้องเปิด RLS policy ใน `jobs` table

### `POST /api/transcribe`
```json
// Request body
{ "jobId": "uuid", "storagePath": "uuid/part_000.wav", "partNumber": 0 }

// Response
{ "text": "...", "part_number": 0 }
```
- ดาวน์โหลดจาก Supabase Storage → POST ไป Typhoon ASR → บันทึก `transcript_segments` → ลบ Storage
- timeout: 60s (`export const maxDuration = 60`)

### `POST /api/summarize`
```json
// Request body
{ "jobId": "uuid", "mode": "general" | "speaker" | "timeline" }

// Response
{ "summary": "...", "key_points": ["..."], "full_transcript": "...", "summary_id": "uuid" }
```
- รับ `mode` เพื่อปรับ System Prompt ให้ตรงกับรูปแบบที่เลือก (สรุปทั่วไป, แยกผู้พูด, ไทม์ไลน์)
- ดึง segments ทั้งหมด ORDER BY part_number → Typhoon LLM JSON mode → บันทึก `summaries`

---

## 🗄️ Database Schema

```sql
-- Table 1: jobs
id uuid PK, status text, file_name text, total_chunks int, created_at timestamptz

-- Table 2: transcript_segments
id uuid PK, job_id uuid FK→jobs, part_number int, text text, created_at timestamptz

-- Table 3: summaries
id uuid PK, job_id uuid FK→jobs, summary_text text, key_points jsonb, created_at timestamptz
```

**Storage**: bucket `temp-audio` (private)
- anon: INSERT only
- service_role: SELECT + DELETE

---

## 🔑 Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
TYPHOON_API_KEY=sk-...
```

ไฟล์: `C:\Users\IT-Phattarapon.sk\Desktop\Mino\.env.local`

---

## ⚙️ Key Decisions & Gotchas

| เรื่อง | ข้อตัดสินใจ | เหตุผล |
|---|---|---|
| ffmpeg.wasm | Optional — ถ้าโหลดไม่ได้ fallback เป็น direct upload | SharedArrayBuffer ต้องการ COOP/COEP headers ซึ่งอาจไม่พร้อมเสมอ |
| Chunk upload | `supabase.storage.upload()` จาก browser (anon key) | ไม่ส่งไฟล์ใน request body (limit 4.5MB) |
| **Job creation** | `POST /api/jobs` (service role) แทนเรียก Supabase โดยตรง | บยปาส RLS — ไม่ต้องสร้าง policy |
| Transcribe call | 1 API call ต่อ 1 chunk | Vercel serverless 60s limit |
| RecordButton | `stop()` returns `Promise<Blob>` | MediaRecorder.onstop เป็น async |
| Auto-stop ref | ใช้ `stopRef.current` ใน timer | ป้องกัน stale closure ใน `setInterval` |
| Error handling | ทุก error toast แล้ว rethrow | ให้ UI แสดง error และ reset state |

---

## 🧩 Component Interface

### `UploadZone`
```ts
props: { onFile: (file: File) => void; disabled?: boolean }
```
- เลือกไฟล์ → stage → กดปุ่ม "เริ่มถอดเสียง" → `onFile(file)` ถูกเรียก

### `RecordButton`
```ts
props: { onRecordingComplete: (blob: Blob) => void; disabled?: boolean }
```
- กด record → start() → แสดง waveform+timer → กดหยุด → stop() → `onRecordingComplete(blob)` ถูกเรียก

### `ProgressSection`
```ts
props: { state: ProcessingState }
// ProcessingState: { isProcessing, currentStep, currentChunk, totalChunks, progress }
```
- Redesign ใหม่: เปลี่ยนจากแสดง badge เป็นข้อๆ เป็น "กล่องสถานะ" แบบ animated spinner และมี Shimmer animation บน progress bar

### `ResultCard`
```ts
props: { result: JobResult; onReSummarize: (mode?: SummaryMode) => void; isSummarizing?: boolean; currentMode?: SummaryMode }
// JobResult: { jobId, summary, keyPoints[], fullTranscript }
```
- มี dropdown ให้เปลี่ยน `SummaryMode` ก่อนกด "สรุปใหม่" ได้จากใน card เลย

---

## 📋 สถานะปัจจุบัน

### ✅ เสร็จแล้ว
- [x] Scaffold Next.js 14 + TypeScript + Tailwind
- [x] ติดตั้ง dependencies: openai, @supabase/supabase-js, @ffmpeg/ffmpeg, sonner, lucide-react
- [x] `lib/supabase.ts` — browser + admin client
- [x] `lib/typhoon.ts` — OpenAI-compatible client
- [x] `app/api/transcribe/route.ts` — ASR pipeline
- [x] `app/api/summarize/route.ts` — LLM summary
- [x] `hooks/useAudioProcessor.ts` — full pipeline + ffmpeg fallback
- [x] `hooks/useRecorder.ts` — MediaRecorder + Promise fix
- [x] `components/UploadZone.tsx` — staging + "เริ่มถอดเสียง" button
- [x] `components/RecordButton.tsx` — waveform + error handling
- [x] `components/ProgressSection.tsx` — progress bar + chunk pills
- [x] `components/ResultCard.tsx` — summary/transcript + copy/download
- [x] `app/layout.tsx` — Noto Sans Thai + Toaster
- [x] `app/page.tsx` — main page wired
- [x] **Bug fixes (2026-05-10)**:
  - UploadZone: แยก staging กับ processing — เพิ่มปุ่ม "เริ่มถอดเสียง"
  - useRecorder.stop(): fix Promise ที่ไม่ resolve เมื่อ recorder เป็น null
  - useAudioProcessor: ffmpeg graceful fallback + createJob toast error
  - RecordButton.handleStop: try/catch + toast error
  - **Supabase URL**: `.env.local` มี `/rest/v1/` ต่อท้าย → ลบออก + เพิ่ม `cleanSupabaseUrl()` ใน `lib/supabase.ts`
  - **RLS jobs table**: ย้าย createJob ไปเรียกผ่าน `POST /api/jobs` (service role) — ไม่ต้องสร้าง RLS policy ให้ anon
  - **Summary Mode Selector**: เพิ่มตัวเลือกรูปแบบการสรุป (สรุปทั่วไป, แยกผู้พูด, ไทม์ไลน์) ในหน้าหลักและใน ResultCard (ใช้ `getSummaryPrompt` เปลี่ยน system prompt ให้ LLM)
  - **Progress UI Overhaul**: เปลี่ยน Progress bar ให้แสดงข้อความแบบ animated ทีละขั้นตอนแทนการแสดงครบทุกขั้นตอน และปิด Toast แจ้งเตือนยิบย่อยเหลือแค่ตอนเสร็จสิ้นและเกิด error ตามที่ผู้ใช้ต้องการ

### ⚠️ สิ่งที่ผู้ใช้ต้องทำก่อนใช้งานได้จริง
- [ ] ใส่ credentials ใน `.env.local` — **URL ต้องเป็น base URL เท่านั้น** เช่น `https://xxxx.supabase.co` ❌ ห้ามมี `/rest/v1/`
- [ ] Run SQL schema ใน Supabase SQL Editor (รวมถึง RLS policies ด้านล่าง)
- [ ] สร้าง Storage bucket `temp-audio` + policies
- [ ] กรอก Typhoon API key

---

## ⏳ งานที่ยังค้างอยู่ / งานที่แนะนำ

| งาน | Priority | หมายเหตุ |
|---|---|---|
| Integration test ทั้ง flow | HIGH | ยังไม่ได้ทดสอบกับ credentials จริง |
| Auth / session | MEDIUM | ตอนนี้ไม่มี auth — ทุกคนเห็น job ของกัน |
| Job history page | LOW | แสดงผลงานที่ผ่านมา |
| Streaming transcript | LOW | แสดง text ทีละประโยคขณะถอดเสียง |
| Mobile responsive polish | MEDIUM | ยังไม่ได้ test บน mobile |
| Error recovery | MEDIUM | ถ้า transcribe chunk ล้มเหลว ควร retry |
| ffmpeg WASM local bundle | LOW | ตอนนี้โหลดจาก unpkg CDN ซึ่งช้า |

---

## 🔄 คำสั่งที่ใช้บ่อย

```powershell
# Start dev server
cd C:\Users\IT-Phattarapon.sk\Desktop\Mino
npm run dev

# Build
npm run build

# Check logs (dev server running)
# ดูจาก terminal ที่รัน npm run dev อยู่
```

---

## 📝 หมายเหตุสำหรับ Agent ที่รับงานต่อ

1. **อ่าน section "📋 สถานะปัจจุบัน"** ก่อนเสมอ
2. **อัปเดต document นี้** ทุกครั้งหลังทำงานเสร็จ — เพิ่มใน ✅ และอัปเดต ⏳
3. ไฟล์สำคัญที่แก้บ่อย: `hooks/useAudioProcessor.ts`, `app/page.tsx`, `components/`
4. ถ้า test API route → ต้องมี `.env.local` ที่ถูกต้อง
5. Dev server port: **3001** (http://localhost:3001) — เปลี่ยนถ้า 3000 ว่าง
6. Tailwind classes ใช้ custom tokens: `bg-primary`, `text-muted`, `border-border` etc.
