'use client';

import { SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { openChatWidget } from './chat-widget';

/** Кнопка, открывающая плавающий AI-ассистент. */
export function OpenChatButton({ children }: { children: React.ReactNode }) {
  return (
    <Button type="button" size="lg" variant="outline" onClick={openChatWidget}>
      <SparklesIcon />
      {children}
    </Button>
  );
}
