import test from 'node:test';
import assert from 'node:assert/strict';
import {availableSlots,bookingTimeError,BOOKING_WINDOW,HALF_HOUR} from '../src/schedule.ts';
test('Rolling seven days, half-hour precision, year rollover and Kazakhstan time',()=>{
 const now=Date.parse('2026-12-31T18:47:20Z');const slots=availableSlots(now);
 assert.equal(slots.length,336);assert.equal(slots[0].iso,'2026-12-31T19:00:00.000Z');assert.equal(slots[0].date,'2027-01-01');assert.equal(slots[0].hour,'00');assert.equal(slots[0].minute,'00');
 for(const s of slots){assert.equal(bookingTimeError(s.iso,now),null);assert.ok(Date.parse(s.iso)<=now+BOOKING_WINDOW);assert.ok(['00','30'].includes(s.minute));}
 assert.ok(bookingTimeError(new Date(now+BOOKING_WINDOW+HALF_HOUR).toISOString(),now));
 assert.ok(bookingTimeError(new Date(now).toISOString(),now));
 assert.ok(bookingTimeError('invalid',now));
 for(const delta of [60000,1000,1])assert.ok(bookingTimeError(new Date(Date.parse(slots[0].iso)+delta).toISOString(),now));
 const edge=Date.parse('2026-11-06T10:00:00Z');assert.equal(bookingTimeError(new Date(edge+BOOKING_WINDOW).toISOString(),edge),null);
 assert.equal(availableSlots(edge)[0].iso,new Date(edge+HALF_HOUR).toISOString());
});
