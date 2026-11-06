import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { availableSlots } from './schedule';
type Option = { value: string; label: string };
function Wheel({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const keys = options.map(o => o.value).join('|');
  useLayoutEffect(() => { if (ref.current) ref.current.scrollTop = index * 40; }, [index, keys]);
  useEffect(() => () => clearTimeout(timer.current), []);
  function select(i: number) { const item = options[Math.max(0, Math.min(options.length - 1, i))]; if (item) onChange(item.value); }
  return <div className="time-column"><span className="wheel-label">{label}</span><div className="wheel-shell"><div className="wheel-highlight"/><div ref={ref} className="time-wheel" role="listbox" aria-label={label} tabIndex={0} aria-activedescendant={`wheel-${label}-${value}`} onKeyDown={e => {
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); select(e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : index + (e.key === 'ArrowDown' ? 1 : -1)); }
  }} onScroll={() => { clearTimeout(timer.current); timer.current = setTimeout(() => { const i = Math.round((ref.current?.scrollTop || 0) / 40); if (i !== index) select(i); }, 120); }}>
    {options.map((o, i) => <button type="button" role="option" id={`wheel-${label}-${o.value}`} aria-selected={o.value === value} tabIndex={-1} key={o.value} className={o.value === value ? 'chosen' : ''} onClick={() => select(i)}>{o.label}</button>)}
  </div></div></div>;
}
export default function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const slots = availableSlots(now);
  const current = slots.find(s => s.iso === value) || slots[0];
  useEffect(() => { if (current.iso !== value) onChange(current.iso); }, [current.iso, value, onChange]);
  const dates = [...new Set(slots.map(s => s.date))];
  const hours = [...new Set(slots.filter(s => s.date === current.date).map(s => s.hour))];
  const minutes = slots.filter(s => s.date === current.date && s.hour === current.hour).map(s => s.minute);
  function change(part: 'date' | 'hour' | 'minute', v: string) {
    const candidates = slots.filter(s => part === 'date' ? s.date === v : part === 'hour' ? s.date === current.date && s.hour === v : s.date === current.date && s.hour === current.hour && s.minute === v);
    const wanted = part === 'date' ? `${v}T${current.hour}:${current.minute}` : part === 'hour' ? `${current.date}T${v}:${current.minute}` : `${current.date}T${current.hour}:${v}`;
    const target = Date.parse(wanted + ':00+05:00');
    const nearest = candidates.reduce((a, b) => Math.abs(Date.parse(a.iso) - target) <= Math.abs(Date.parse(b.iso) - target) ? a : b);
    onChange(nearest.iso);
  }
  const dayLabel = (date: string) => new Date(date + 'T12:00:00+05:00').toLocaleDateString('ru-KZ', { timeZone: 'Asia/Almaty', day: 'numeric', month: 'short', weekday: 'short' });
  return <div className="booking-time"><div className="field-label">Когда начнём?<small>Время Казахстана · UTC+5 · максимум 7 дней вперёд</small></div><div className="time-wheels">
    <Wheel label="Дата" options={dates.map(d => ({ value: d, label: dayLabel(d) }))} value={current.date} onChange={v => change('date', v)}/>
    <Wheel label="Часы" options={hours.map(h => ({ value: h, label: h }))} value={current.hour} onChange={v => change('hour', v)}/>
    <Wheel label="Минуты" options={minutes.map(m => ({ value: m, label: m }))} value={current.minute} onChange={v => change('minute', v)}/>
  </div><p className="time-summary" aria-live="polite">{dayLabel(current.date)} · <strong>{current.hour}:{current.minute}</strong></p><small className="muted">Прокрути колёсики или выбери значение. Минуты: 00 и 30.</small></div>;
}
