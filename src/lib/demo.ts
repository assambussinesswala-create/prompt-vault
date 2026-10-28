import type { Prompt } from './types'

/** Sample prompts for demonstration only. They are flagged isDemo and can be removed in one click. */
export function makeDemoPrompts(now = new Date()): Prompt[] {
  const day = 86_400_000
  const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * day).toISOString()
  const base = { description: '', notes: '', version: '1', lastUsedAt: null, favorite: false, isDemo: true as const }
  return [
    {
      ...base,
      id: 'demo-1',
      title: 'Cinematic street chai stall (8-second clip)',
      description: 'Establishing shot for a short comedy video.',
      category: 'AI Video Generation',
      tags: ['video', 'cinematic', 'street'],
      platform: 'Google Flow',
      createdAt: at(6),
      updatedAt: at(6),
      favorite: true,
      content:
        'Create an 8-second cinematic shot of a busy roadside chai stall at golden hour.\n\nCamera: slow dolly-in, shallow depth of field.\nSubject: a chai maker pouring tea from a height, steam rising.\nBackground: rickshaws, warm string lights, soft dust in the air.\nAudio: ambient street noise, kettle clatter, distant music.\n\nStyle: warm, handheld documentary feel. No text on screen.',
    },
    {
      ...base,
      id: 'demo-2',
      title: 'YouTube thumbnail: shocked reaction',
      description: 'High-contrast thumbnail with a large face and three words of text.',
      category: 'YouTube Thumbnail Prompts',
      tags: ['thumbnail', 'youtube', 'reaction'],
      platform: 'ChatGPT',
      createdAt: at(4),
      updatedAt: at(3),
      content:
        'Design a 16:9 YouTube thumbnail.\n\n- Close-up of a person with an exaggerated shocked expression, left third of the frame\n- Bold yellow text on the right: "NOBODY EXPECTED THIS" (max 3 lines)\n- Dark blurred background with a subtle red glow\n- Strong rim light, high contrast, sharp eyes\n\nKeep the text readable at phone-screen size.',
    },
    {
      ...base,
      id: 'demo-3',
      title: 'Interview question generator',
      description: 'Creates thoughtful questions for a founder interview.',
      category: 'Success Blueprint Interviews',
      tags: ['interview', 'questions', 'founders'],
      platform: 'Claude',
      createdAt: at(3),
      updatedAt: at(3),
      content:
        'You are an experienced podcast interviewer.\n\nI will give you a guest name and a short bio. Write 12 interview questions in this order:\n1. Early life and first business attempt\n2. A failure and what it taught them\n3. Decisions that changed everything\n4. Advice for students starting with no money\n\nAvoid yes/no questions. Keep each question under 25 words.',
    },
    {
      ...base,
      id: 'demo-4',
      title: 'Daily Turkish phrases lesson',
      description: 'Five practical phrases with pronunciation and a mini-dialogue.',
      category: 'Turkish Learning',
      tags: ['turkish', 'beginner', 'phrases'],
      platform: 'Gemini',
      createdAt: at(2),
      updatedAt: at(1),
      content:
        'Teach me 5 useful Turkish phrases for travelers.\n\nFor each phrase give:\n- Turkish text\n- Simple pronunciation guide\n- English meaning\n- One example sentence\n\nEnd with a 4-line dialogue using all five phrases.',
    },
    {
      ...base,
      id: 'demo-5',
      title: 'YouTube description with timestamps',
      description: 'Turns a video outline into a description with chapters.',
      category: 'YouTube Descriptions',
      tags: ['youtube', 'seo', 'description'],
      platform: 'ChatGPT',
      createdAt: at(1),
      updatedAt: at(1),
      content:
        'Write a YouTube description for the video outline below.\n\nStructure:\n1. A 2-sentence hook with the main keyword\n2. Chapter timestamps (0:00 format)\n3. Three relevant hashtags\n4. A short call to action to subscribe\n\nOutline:\n[PASTE OUTLINE HERE]',
    },
  ]
}
