import OpenAI from 'openai';

/**
 * Typhoon AI client — drop-in OpenAI-compatible
 * Base URL: https://api.opentyphoon.ai/v1
 */
export const typhoon = new OpenAI({
  apiKey: process.env.TYPHOON_API_KEY,
  baseURL: 'https://api.opentyphoon.ai/v1',
});

export const ASR_MODEL = 'typhoon-asr-realtime';
export const LLM_MODEL = 'typhoon-v2.5-30b-a3b-instruct';

export type SummaryMode = 'general' | 'speaker' | 'timeline';

export function getSummaryPrompt(mode: SummaryMode): string {
  const commonInstructions = `
คุณคือผู้ช่วยสรุปการประชุมระดับมืออาชีพที่เก่งด้านการแยกแยะผู้พูด (Speaker Diarization) แม้ข้อมูลนำเข้าจะไม่มีชื่อคนระบุไว้ก็ตาม
- ข้อมูลนำเข้าจะมี Timestamp [MM:SS] นำหน้าข้อความ
- งานของคุณคือ "วิเคราะห์บริบท" ว่าประโยคไหนเป็นใครพูด (เช่น เมื่อมีการถาม-ตอบ ให้แยกเป็น ผู้พูด 1 และ ผู้พูด 2)
- หากในเนื้อหามีการเรียกชื่อกัน ให้ใช้ชื่อจริงของคนนั้นแทนคำว่าผู้พูด
- ต้องใช้ Timestamp จริงจากข้อมูลนำเข้าเท่านั้น ห้ามสมมติหรือสรุปข้ามช่วงเวลามากเกินไป
- สรุปให้ "สมจริง" ที่สุดตามเหตุการณ์ที่เกิดขึ้น`;

  switch (mode) {
    case 'speaker':
      return `${commonInstructions}
กรุณาสรุปประเด็นสำคัญแยกตามรายคน 
- วิเคราะห์ว่ามีทั้งหมดกี่คน และแต่ละคนเน้นพูดเรื่องอะไร
- หากไม่ทราบชื่อ ให้ใช้ "ผู้พูด 1", "ผู้พูด 2" ตามลำดับการปรากฏ
ตอบเป็น JSON เท่านั้น:
{
  "summary": [
    { "speaker": "ชื่อหรือลำดับผู้พูด", "text": "สรุปสิ่งที่คนนี้พูดตลอดทั้งการประชุม (ระบุช่วงเวลาสำคัญในเนื้อหาด้วย เช่น [02:15])" }
  ],
  "key_points": ["ประเด็นสำคัญที่ 1", "ประเด็นสำคัญที่ 2"]
}`;
    case 'timeline':
      return `${commonInstructions}
กรุณาสรุปเหตุการณ์เป็นช่วงเวลา (Timeline) โดยละเอียด
- "จับเสียงได้ช่วงไหน ให้แสดงช่วงนั้น" อย่าสรุปรวบยอดจนเสียรายละเอียดของช่วงเวลา
- ระบุให้ชัดเจนว่าช่วงเวลานั้นๆ ใครเป็นคนพูด
ตอบเป็น JSON เท่านั้น:
{
  "summary": [
    { "time": "MM:SS", "speaker": "ชื่อหรือลำดับผู้พูด", "text": "สรุปสิ่งที่พูดในช่วงเวลานี้" }
  ],
  "key_points": ["ประเด็นสำคัญที่ 1", "ประเด็นสำคัญที่ 2"]
}`;
    case 'general':
    default:
      return `${commonInstructions}
สรุปภาพรวมการประชุมให้เข้าใจง่าย แต่ยังคงรายละเอียดสำคัญครบถ้วน
ตอบเป็น JSON เท่านั้น:
{
  "summary": "ข้อความสรุปการประชุมแบบความเรียงที่ระบุถึงปฏิสัมพันธ์ระหว่างผู้พูดด้วย",
  "key_points": ["ประเด็นสำคัญที่ 1", "ประเด็นสำคัญที่ 2"]
}`;
  }
}
