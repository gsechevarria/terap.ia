import { todayYMD, ymdInTZ, parseYMD } from "@/lib/tz";
export function assignmentIsDue(a: { active: boolean; starts_on: string; ends_on: string | null; assignment_type: string; recurrence_interval_days: number | null }, last: string | null, now = new Date()): boolean {
  const today = todayYMD(now);
  if (!a.active || a.starts_on > today || (a.ends_on != null && a.ends_on < today)) return false;
  if (!last) return true;
  if (a.assignment_type === "one_off" || !a.recurrence_interval_days || a.recurrence_interval_days < 1) return false;
  return (parseYMD(today).getTime() - parseYMD(ymdInTZ(new Date(last))).getTime()) / 86400000 >= a.recurrence_interval_days;
}
