import { Link } from 'wouter';
import { CalendarCheck } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { dailyCopy } from '@/lib/daily-copy';

export function DailyLink() {
  const { lang } = useI18n();
  return (
    <Link
      href="/daily"
      className="fixed bottom-24 end-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-lg transition hover:shadow-xl"
      data-testid="link-chat-daily"
    >
      <CalendarCheck className="h-4 w-4" />
      {dailyCopy[lang].open}
    </Link>
  );
}
