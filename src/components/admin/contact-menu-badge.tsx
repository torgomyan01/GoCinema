'use client';

import { useCallback, useEffect, useState } from 'react';
import { getNewContactsCount } from '@/app/actions/contacts';

const POLL_INTERVAL = 20000;
export const CONTACT_PENDING_CHANGED = 'gocinema-contact-pending-changed';

export function notifyContactPendingChanged() {
  window.dispatchEvent(new CustomEvent(CONTACT_PENDING_CHANGED));
}

export default function ContactMenuBadge() {
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    const result = await getNewContactsCount();
    if (result.success) {
      setCount(result.count);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_INTERVAL);
    const onChange = () => void load();
    window.addEventListener(CONTACT_PENDING_CHANGED, onChange);
    window.addEventListener('focus', onChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener(CONTACT_PENDING_CHANGED, onChange);
      window.removeEventListener('focus', onChange);
    };
  }, [load]);

  if (count <= 0) return null;

  return (
    <span className="ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}
