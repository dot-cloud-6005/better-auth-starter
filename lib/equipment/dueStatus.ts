export type DueState = 'compliant' | 'upcoming' | 'overdue';

export function getDueStatus(date?: Date | string) {
  const cls = {
    compliant: 'bg-green-50 text-green-700 border-green-200',
    upcoming: 'bg-amber-50 text-amber-700 border-amber-200',
    overdue: 'bg-red-50 text-red-700 border-red-200',
  } as const;

  if (!date) return { state: 'compliant' as DueState, className: cls.compliant, label: 'Compliant' };

  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return { state: 'compliant' as DueState, className: cls.compliant, label: 'Compliant' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(d);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { state: 'overdue' as DueState, className: cls.overdue, label: 'Overdue' };
  if (diffDays <= 30) return { state: 'upcoming' as DueState, className: cls.upcoming, label: 'Due soon' };
  return { state: 'compliant' as DueState, className: cls.compliant, label: 'Compliant' };
}