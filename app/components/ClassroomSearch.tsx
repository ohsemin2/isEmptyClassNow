'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { getFreeSlots, type AllData, type TimeSlot } from '@/lib/parseSchedule';

const DAY_KR = ['일', '월', '화', '수', '목', '금', '토'] as const;

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!value) return suggestions.slice(0, 50);
    const lower = value.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(lower)).slice(0, 50);
  }, [value, suggestions]);

  useEffect(() => { setHighlighted(0); }, [filtered]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full px-4 py-3 rounded-[3px] border text-base text-gray-900 outline-none transition-all
          ${disabled
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-white border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
          }`}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => {
          onChange('');
          setOpen(true);
        }}
        onKeyDown={e => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && filtered[highlighted]) { onChange(filtered[highlighted]); setOpen(false); }
          if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && filtered.length > 0 && !disabled && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-[3px] shadow-lg max-h-60 overflow-y-auto">
          {filtered.map((s, i) => (
            <li
              key={s}
              className={`px-4 py-2 cursor-pointer text-sm text-gray-900
                ${i === highlighted ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              onMouseEnter={() => setHighlighted(i)}
              onMouseDown={() => { onChange(s); setOpen(false); }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TimelineBar({ occupied, free, now }: { occupied: TimeSlot[]; free: TimeSlot[]; now: string }) {
  const start = 8 * 60;
  const end = 22 * 60;
  const total = end - start;

  const toPercent = (t: string) => Math.max(0, Math.min(100, ((toMinutes(t) - start) / total) * 100));
  const nowMin = toMinutes(now);
  const nowPct = toPercent(now);
  const isInRange = nowMin >= start && nowMin <= end;

  return (
    <div className="mt-4">
      <div className="relative h-8 rounded-[3px] bg-gray-100 overflow-hidden">
        {occupied.map((s, i) => (
          <div
            key={i}
            className="absolute h-full bg-red-400"
            style={{ left: `${toPercent(s.start)}%`, width: `${toPercent(s.end) - toPercent(s.start)}%` }}
          />
        ))}
        {free.map((s, i) => (
          <div
            key={i}
            className="absolute h-full bg-green-400 opacity-80"
            style={{ left: `${toPercent(s.start)}%`, width: `${toPercent(s.end) - toPercent(s.start)}%` }}
          />
        ))}
        {isInRange && (
          <div
            className="absolute h-full w-0.5 bg-gray-800 z-10"
            style={{ left: `${nowPct}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>08:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>22:00</span>
      </div>
    </div>
  );
}

export default function ClassroomSearch({ data }: { data: AllData }) {
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [now, setNow] = useState(nowHHMM);

  useEffect(() => {
    const timer = setInterval(() => setNow(nowHHMM()), 30000);
    return () => clearInterval(timer);
  }, []);

  const today = DAY_KR[new Date().getDay()];
  const [selectedDay, setSelectedDay] = useState(today);

  const roomSuggestions = useMemo(() => {
    if (!building) return [];
    return data.classrooms
      .filter(c => c.building === building)
      .map(c => c.room.replace('(무선랜제공)', ''))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [building, data]);

  const selectedClassroom = useMemo(() => {
    if (!building || !room) return null;
    return data.classrooms.find(c =>
      c.building === building &&
      (c.room === room || c.room === room + '(무선랜제공)')
    ) ?? null;
  }, [building, room, data]);

  const todaySlots: TimeSlot[] = useMemo(() => {
    if (!selectedClassroom) return [];
    return selectedClassroom.schedule[selectedDay] ?? [];
  }, [selectedClassroom, selectedDay]);

  const freeSlots = useMemo(() => getFreeSlots(todaySlots), [todaySlots]);

  const isToday = selectedDay === today;

  const currentlyFree = useMemo(() => {
    if (!isToday) return null; // null = 오늘이 아님
    return !todaySlots.some(s => now >= s.start && now < s.end);
  }, [todaySlots, now, isToday]);

  const nextFree = useMemo(() => {
    if (!isToday) return null;
    if (currentlyFree) return freeSlots.find(s => now >= s.start && now < s.end) ?? null;
    return freeSlots.find(s => s.start > now) ?? null;
  }, [currentlyFree, freeSlots, now, isToday]);

  const DAY_LABELS: Record<string, string> = {
    '월': '월요일', '화': '화요일', '수': '수요일',
    '목': '목요일', '금': '금요일', '토': '토요일', '일': '일요일',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">빈 강의실 확인</h1>
          <p className="mt-2 text-gray-500 text-sm">
            {DAY_LABELS[today]} · 현재 {now}
          </p>
        </div>

        {/* Day selector */}
        <div className="flex gap-1 mb-4">
          {(['월','화','수','목','금','토','일'] as const).map(day => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`flex-1 py-2 text-sm font-medium rounded-[3px] transition-colors
                ${selectedDay === day
                  ? 'bg-blue-500 text-white'
                  : day === today
                    ? 'bg-blue-50 text-blue-500 border border-blue-200'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-[3px] shadow-sm border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">동</label>
            <AutocompleteInput
              value={building}
              onChange={v => { setBuilding(v); setRoom(''); }}
              suggestions={data.buildings}
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">호수</label>
            <AutocompleteInput
              value={room}
              onChange={setRoom}
              suggestions={roomSuggestions}
              placeholder={building ? '' : '동을 먼저 선택하세요'}
              disabled={!building}
            />
          </div>
        </div>

        {/* Results */}
        {selectedClassroom && (
          <div className="mt-6 space-y-4">
            {/* Status card */}
            <div className={`rounded-[3px] p-6 shadow-sm border ${
              currentlyFree === null
                ? 'bg-gray-50 border-gray-100'
                : currentlyFree
                  ? 'bg-green-50 border-green-100'
                  : 'bg-red-50 border-red-100'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-[3px] ${
                  currentlyFree === null ? 'bg-gray-400' : currentlyFree ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-lg font-semibold ${
                  currentlyFree === null ? 'text-gray-700' : currentlyFree ? 'text-green-800' : 'text-red-800'
                }`}>
                  {building}-{room}
                  {currentlyFree === null
                    ? ` ${DAY_LABELS[selectedDay]}`
                    : ` 현재 ${currentlyFree ? '비어있음' : '수업 중'}`}
                </span>
              </div>
              {currentlyFree === false && nextFree && (
                <p className="mt-2 text-sm text-red-600 ml-6">
                  {nextFree.start}부터 비어있습니다
                </p>
              )}
              {currentlyFree === true && (() => {
                const slot = freeSlots.find(s => now >= s.start && now < s.end);
                return slot ? (
                  <p className="mt-2 text-sm text-green-600 ml-6">
                    {slot.end}까지 비어있습니다
                  </p>
                ) : null;
              })()}
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-[3px] shadow-sm border border-gray-100 p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {DAY_LABELS[selectedDay]} 시간표
              </h2>
              {todaySlots.length === 0 ? (
                <p className="text-gray-500 text-sm">수업 없음 — 하루 종일 비어있습니다</p>
              ) : (
                <TimelineBar occupied={todaySlots} free={freeSlots} now={now} />
              )}
            </div>

            {/* Free slots list */}
            {freeSlots.length > 0 && (
              <div className="bg-white rounded-[3px] shadow-sm border border-gray-100 p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  빈 시간대
                </h2>
                <ul className="space-y-2">
                  {freeSlots.map((s, i) => {
                    const isCurrent = isToday && now >= s.start && now < s.end;
                    return (
                      <li key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-[3px] text-sm
                        ${isCurrent ? 'bg-green-50 text-green-800 font-medium' : 'text-gray-900'}`}>
                        <span className={`w-2 h-2 rounded-[3px] flex-shrink-0 ${isCurrent ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {s.start} ~ {s.end}
                        {isCurrent && <span className="ml-auto text-xs font-semibold text-green-600 bg-green-100 px-2 py-0.5 rounded-[3px]">지금</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Occupied slots list */}
            {todaySlots.length > 0 && (
              <div className="bg-white rounded-[3px] shadow-sm border border-gray-100 p-6">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  수업 시간
                </h2>
                <ul className="space-y-2">
                  {[...todaySlots]
                    .sort((a, b) => a.start.localeCompare(b.start))
                    .map((s, i) => {
                      const isCurrent = isToday && now >= s.start && now < s.end;
                      return (
                        <li key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-[3px] text-sm
                          ${isCurrent ? 'bg-red-50 text-red-800 font-medium' : 'text-gray-900'}`}>
                          <span className={`w-2 h-2 rounded-[3px] flex-shrink-0 ${isCurrent ? 'bg-red-500' : 'bg-gray-300'}`} />
                          {s.start} ~ {s.end}
                          {isCurrent && <span className="ml-auto text-xs font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-[3px]">수업 중</span>}
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
