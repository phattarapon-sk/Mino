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
  switch (mode) {
    case 'speaker':
      return `คุณคือผู้ช่วยสรุปการประชุม กรุณาสรุปประเด็นสำคัญของแต่ละคน แยกแยะข้อความตามผู้พูดให้ชัดเจน 
*คำเตือน: ห้ามถอดความแบบคำต่อคำเด็ดขาด ให้สรุปเฉพาะใจความหลักที่แต่ละคนพูด เพื่อไม่ให้ข้อความยาวเกินไป*
ตอบเป็น JSON เท่านั้น โดยมี format ตรงตามนี้เป๊ะๆ:
{
  "summary": [
    { "speaker": "ชื่อผู้พูด (เช่น ผู้พูด 1, สุชาติ)", "text": "ข้อความสรุปสิ่งที่พูด" }
  ],
  "key_points": ["ประเด็นสำคัญที่ 1", "ประเด็นสำคัญที่ 2"]
}`;
    case 'timeline':
      return `คุณคือผู้ช่วยสรุปการประชุม กรุณาสรุปเฉพาะช่วงเวลาสำคัญแบบเรียงลำดับเวลา (Timeline) เล่าเป็นฉากๆ ว่าช่วงต้น/กลาง/ท้าย ใครพูดอะไร 
*คำเตือน: ห้ามถอดความแบบคำต่อคำเด็ดขาด ให้สรุปเฉพาะเหตุการณ์หลักและใจความสำคัญ เพื่อไม่ให้ข้อความยาวเกินไป*
ตอบเป็น JSON เท่านั้น โดยมี format ตรงตามนี้เป๊ะๆ:
{
  "summary": [
    { "time": "00:00", "speaker": "ชื่อผู้พูด", "text": "ข้อความสรุปสิ่งที่พูดหรือเหตุการณ์" }
  ],
  "key_points": ["ประเด็นสำคัญที่ 1", "ประเด็นสำคัญที่ 2"]
}`;
    case 'general':
    default:
      return `คุณคือผู้ช่วยสรุปการประชุม สรุปใจความสำคัญทั้งหมดอย่างครบถ้วน 
ตอบเป็น JSON เท่านั้น โดยมี format ตรงตามนี้เป๊ะๆ:
{
  "summary": "ข้อความสรุปการประชุมแบบความเรียงยาวๆ",
  "key_points": ["ประเด็นสำคัญที่ 1", "ประเด็นสำคัญที่ 2"]
}`;
  }
}
