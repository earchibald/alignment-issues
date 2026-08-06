import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecClock, mmss, pickMime } from '../game/js/ui/recorder.js';

test('mmss formats minutes and seconds', () => {
  assert.equal(mmss(0), '00:00');
  assert.equal(mmss(999), '00:00');
  assert.equal(mmss(65000), '01:05');
  assert.equal(mmss(125400), '02:05');
});

test('pickMime returns null when MediaRecorder is absent (node)', () => {
  assert.equal(pickMime(), null);
});

test('recClock: audio time advances only while recording', () => {
  let pm = 100;
  const clock = createRecClock(() => pm);
  const rc = clock;
  rc.start();
  pm = 1600;
  assert.equal(rc.audioMs(), 1500);
  rc.pause();
  pm = 5000; // paused gap must not count
  assert.equal(rc.audioMs(), 1500);
  rc.start(); // resume
  pm = 5500;
  assert.equal(rc.audioMs(), 2000);
  assert.equal(rc.stop(), 2000);
  assert.equal(rc.audioMs(), 0); // reset for the next recording
});

test('recClock: stop while paused returns accumulated time', () => {
  let pm = 0;
  const rc = createRecClock(() => pm);
  rc.start();
  pm = 3000;
  rc.pause();
  pm = 9000;
  assert.equal(rc.stop(), 3000);
});
