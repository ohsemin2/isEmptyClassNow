import XLSX from 'xlsx';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function parseClassroom(rawStr) {
  const str = rawStr.trim();
  if (!str || str === '/') return null;

  const cleaned = str.replace(/^[*#]/, '').trim();
  if (!cleaned) return null;

  const suffixMatch = cleaned.match(/(\(무선랜제공\))$/);
  const suffix = suffixMatch ? suffixMatch[1] : '';
  const base = suffix ? cleaned.slice(0, -suffix.length) : cleaned;

  const parts = base.split('-').filter(p => p.length > 0);
  if (parts.length < 2) return null;

  let building;
  let roomParts;

  if (parts.length >= 3) {
    const second = parts[1];
    if (/^[1-9]$/.test(second) || /^[A-Za-z]$/.test(second)) {
      building = `${parts[0]}-${second}`;
      roomParts = parts.slice(2);
    } else {
      building = parts[0];
      roomParts = parts.slice(1);
    }
  } else {
    building = parts[0];
    roomParts = parts.slice(1);
  }

  const room = roomParts.join('-') + suffix;
  return { building, room };
}

function parseTimeStr(timeStr) {
  return timeStr
    .split('/')
    .map(part => {
      const m = part.match(/([월화수목금토일])\((\d{2}:\d{2})~(\d{2}:\d{2})\)/);
      return m ? { day: m[1], start: m[2], end: m[3] } : null;
    })
    .filter(x => x !== null);
}

const filePath = join(root, 'data', '강좌검색.xls');
const wb = XLSX.readFile(filePath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const scheduleMap = new Map();
const infoMap = new Map();

for (let i = 3; i < rows.length; i++) {
  const row = rows[i];
  const timeStr = String(row[12] ?? '').trim();
  const classroomStr = String(row[14] ?? '').trim();

  if (!timeStr || !classroomStr) continue;

  const times = parseTimeStr(timeStr);
  if (times.length === 0) continue;

  const rawRoomParts = classroomStr.split('/').map(s => s.trim());
  const countMatch = rawRoomParts.length === times.length;

  for (let ci = 0; ci < rawRoomParts.length; ci++) {
    const rawRoom = rawRoomParts[ci];
    if (!rawRoom) continue;

    const parsed = parseClassroom(rawRoom);
    if (!parsed) continue;

    const key = `${parsed.building}\0${parsed.room}`;

    if (!scheduleMap.has(key)) {
      scheduleMap.set(key, {});
      infoMap.set(key, parsed);
    }

    const schedule = scheduleMap.get(key);

    if (countMatch) {
      const t = times[ci];
      if (!schedule[t.day]) schedule[t.day] = [];
      schedule[t.day].push({ start: t.start, end: t.end });
    } else {
      for (const t of times) {
        if (!schedule[t.day]) schedule[t.day] = [];
        schedule[t.day].push({ start: t.start, end: t.end });
      }
    }
  }
}

const buildingSet = new Set();
const classrooms = [];

for (const [key, schedule] of scheduleMap) {
  const info = infoMap.get(key);
  buildingSet.add(info.building);
  classrooms.push({ building: info.building, room: info.room, schedule });
}

const buildings = [...buildingSet].sort((a, b) => {
  const na = parseInt(a), nb = parseInt(b);
  if (!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b);
});

const output = { buildings, classrooms };

mkdirSync(join(root, 'generated'), { recursive: true });
writeFileSync(
  join(root, 'generated', 'classrooms.json'),
  JSON.stringify(output),
);

console.log(`Generated ${classrooms.length} classrooms across ${buildings.length} buildings.`);
