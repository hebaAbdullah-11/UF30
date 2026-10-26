import { useEffect, useState } from 'react';

export function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateString() {
  return toLocalDateString(new Date());
}

export function addDaysLocal(day: string, amount: number) {
  const [y, m, d] = day.split('-').map(Number);
  return toLocalDateString(new Date(y, m - 1, d + amount));
}

export function useLocalDate() {
  const [localDate, setLocalDate] = useState(getLocalDateString);

  useEffect(() => {
    const refreshDate = () => setLocalDate(getLocalDateString());
    let midnight: number | undefined;
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2);
      midnight = window.setTimeout(() => { refreshDate(); scheduleMidnight(); }, next.getTime() - now.getTime());
    };
    scheduleMidnight();
    const interval = window.setInterval(refreshDate, 60_000);
    document.addEventListener('visibilitychange', refreshDate);
    window.addEventListener('focus', refreshDate);
    return () => {
      window.clearInterval(interval);
      if (midnight) window.clearTimeout(midnight);
      document.removeEventListener('visibilitychange', refreshDate);
      window.removeEventListener('focus', refreshDate);
    };
  }, []);

  return localDate;
}
