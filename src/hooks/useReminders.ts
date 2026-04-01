import { useState, useEffect } from "react";

export type Reminder = {
  id: string;
  text: string;
  triggerAt: number;
};

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>(() => {
    try {
      const stored = localStorage.getItem("notepade-reminders");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  
  const [activeReminders, setActiveReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    localStorage.setItem("notepade-reminders", JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const toTrigger: Reminder[] = [];
      const toKeep: Reminder[] = [];
      
      reminders.forEach(r => {
        if (r.triggerAt <= now) {
          toTrigger.push(r);
        } else {
          toKeep.push(r);
        }
      });
      
      if (toTrigger.length > 0) {
        setReminders(toKeep);
        setActiveReminders(prev => {
          const newActive = [...prev];
          toTrigger.forEach(t => {
            if (!newActive.find(a => a.id === t.id)) {
              newActive.push(t);
            }
          });
          return newActive;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [reminders]);

  const addReminder = (text: string, date: Date, id?: string) => {
    const newId = id || crypto.randomUUID();
    setReminders(prev => [...prev.filter(r => r.id !== newId), { id: newId, text, triggerAt: date.getTime() }]);
    return newId;
  };
  
  const removeReminder = (id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };
  
  const dismissReminder = (id: string) => {
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };

  return { addReminder, removeReminder, activeReminders, dismissReminder };
}
