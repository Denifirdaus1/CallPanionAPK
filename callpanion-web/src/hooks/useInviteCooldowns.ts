import { useState, useEffect } from 'react';

export function useInviteCooldowns() {
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("inviteCooldowns");
      if (raw) setCooldowns(JSON.parse(raw));
    } catch {}
  }, []);

  const setCd = (email: string, untilMs: number) => {
    const next = { ...cooldowns, [email]: untilMs };
    setCooldowns(next);
    try { 
      localStorage.setItem("inviteCooldowns", JSON.stringify(next)); 
    } catch {}
  };

  const remaining = (email: string) => {
    const now = Date.now();
    const until = cooldowns[email] || 0;
    return Math.max(0, until - now);
  };

  return { cooldowns, setCd, remaining };
}