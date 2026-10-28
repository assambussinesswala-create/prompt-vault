import { Bot, Briefcase, Code2, FileText, Folder, Image as ImageIcon, Inbox, Languages, Laugh, MessagesSquare, Mic, Sparkles, Video, Workflow, Youtube, type LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  'AI Video Generation': Video,
  'Google Flow Prompts': Workflow,
  'Funny Pakistani Videos': Laugh,
  'YouTube Thumbnail Prompts': Youtube,
  'Image Generation': ImageIcon,
  'Success Blueprint Interviews': Mic,
  'Interview Questions': MessagesSquare,
  'YouTube Descriptions': FileText,
  'English Learning': Languages,
  'Arabic Learning': Languages,
  'Turkish Learning': Languages,
  'Chinese Learning': Languages,
  'AI Agents and Instructions': Bot,
  'Business and Entrepreneurship': Briefcase,
  'Website and Coding': Code2,
  'Personal Projects': Sparkles,
  Uncategorized: Inbox,
}

export function CategoryIcon({ name, className = 'h-4 w-4' }: { name: string; className?: string }) {
  const Icon = MAP[name] ?? Folder
  return <Icon className={className} aria-hidden />
}
