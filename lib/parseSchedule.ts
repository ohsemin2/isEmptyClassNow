import classroomsData from '@/generated/classrooms.json';

export interface TimeSlot {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface ClassroomInfo {
  building: string;
  room: string;
  schedule: Record<string, TimeSlot[]>; // day (월화수목금토일) -> slots
}

export interface AllData {
  buildings: string[];
  classrooms: ClassroomInfo[];
}

export function getClassroomData(): AllData {
  return classroomsData as AllData;
}

// Calculate free time windows given occupied slots and day bounds
export function getFreeSlots(
  occupied: TimeSlot[],
  dayStart = '08:00',
  dayEnd = '22:00'
): TimeSlot[] {
  if (occupied.length === 0) return [{ start: dayStart, end: dayEnd }];

  const sorted = [...occupied].sort((a, b) => a.start.localeCompare(b.start));

  // Merge overlapping
  const merged: TimeSlot[] = [];
  for (const slot of sorted) {
    if (merged.length === 0 || slot.start > merged[merged.length - 1].end) {
      merged.push({ ...slot });
    } else if (slot.end > merged[merged.length - 1].end) {
      merged[merged.length - 1].end = slot.end;
    }
  }

  const free: TimeSlot[] = [];
  let cur = dayStart;

  for (const slot of merged) {
    if (cur < slot.start) free.push({ start: cur, end: slot.start });
    if (slot.end > cur) cur = slot.end;
  }
  if (cur < dayEnd) free.push({ start: cur, end: dayEnd });

  return free;
}
