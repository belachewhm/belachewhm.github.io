'use strict';

// Music engine: Web Audio synth voices, a lookahead scheduler and a minimal
// Standard MIDI File reader. Exposes a single global `Music`.
const Music = (() => {
    const LOOKAHEAD = 0.15;   // seconds of audio queued ahead of the clock
    const TICK_MS = 25;       // how often the scheduler wakes up
    const FULL_VOLUME = 0.62;  // master gain at volume 10
    const VOLUME_STEP_DB = 3;  // each volume step below 10 is 3 dB quieter
    const TARGET_RMS = 0.17;   // every track is normalised to this loudness
    const MEASURE_RATE = 8000, MEASURE_MAX_S = 60; // for tracks without a stored `rms`
    const MAX_RATE = 1.5;
    const BASE_URL = (window.TETRIS_BASE ?? '/tetris/') + 'music/';

    // --- Notes ---------------------------------------------------------------
    const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

    function midiOf(name) { // "C#5", "Bb3", "G2"
        const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
        if (!m) throw new Error('Bad note: ' + name);
        const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
        return NOTE_INDEX[m[1]] + accidental + (parseInt(m[3], 10) + 1) * 12;
    }

    const freqOf = midi => 440 * Math.pow(2, (midi - 69) / 12);

    function parseDur(s) {
        if (s.includes('/')) { const [a, b] = s.split('/'); return parseFloat(a) / parseFloat(b); }
        return parseFloat(s);
    }

    // Appends events for a space-separated sequence like "A4:1 R:.5 D3+A3:2"
    // (note:beats, R = rest, + = chord) and returns the beat it ends on.
    function seq(out, voice, str, start = 0, vel = 1, gate = 1) {
        let t = start;
        for (const tok of str.trim().split(/\s+/)) {
            const [notes, dur] = tok.split(':');
            const d = parseDur(dur);
            if (notes !== 'R') {
                for (const n of notes.split('+')) out.push({ b: t, d: d * gate, p: midiOf(n), v: vel, voice });
            }
            t += d;
        }
        return t;
    }

    function finish(track, events, length) {
        events.sort((a, b) => a.b - b.b);
        return Object.assign(track, { events, length });
    }

    // --- Tracks ----------------------------------------------------------------

    // Korobeiniki: traditional Russian folk song, public domain.
    function buildKorobeiniki() {
        const ev = [];
        const A = 'E5:1 B4:.5 C5:.5 D5:1 C5:.5 B4:.5 A4:1 A4:.5 C5:.5 E5:1 D5:.5 C5:.5 B4:1.5 C5:.5 D5:1 E5:1 C5:1 A4:1 A4:2';
        const B = 'D5:1.5 F5:.5 A5:1 G5:.5 F5:.5 E5:1.5 C5:.5 E5:1 D5:.5 C5:.5 B4:1.5 C5:.5 D5:1 E5:1 C5:1 A4:1 A4:2';
        let t = 0;
        for (const part of [A, A, B, B]) t = seq(ev, 'chip', part, t, 1, 0.9);
        // Octave-bouncing bass, one chord per 4-beat bar
        const roots = 'E A E A E A E A D C E A D C E A'.split(' ');
        seq(ev, 'bass', roots.map(r => `${r}2:.5 ${r}3:.5 `.repeat(4)).join(''), 0, 0.7, 0.85);
        return finish({ bpm: 160 }, ev, t);
    }

    // Mars, the Bringer of War (Holst, 1914, public domain). The 5/4 ostinato is
    // Holst's; the brass line is a simplified arrangement for this game.
    function buildMars() {
        const ev = [];
        const BAR = 5;
        const ostinato = n => `${n}:1/3 ${n}:1/3 ${n}:1/3 ${n}:1 ${n}:1 ${n}:1/2 ${n}:1/2 ${n}:1`;
        const roots = ['G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G', 'G',
                       'C', 'C', 'C', 'C', 'Db', 'Db', 'Db', 'Db', 'G', 'G', 'G', 'G'];
        roots.forEach((r, i) => {
            const n = `${r}2+${r}3`;
            seq(ev, 'colLegno', ostinato(n), i * BAR, i < 4 ? 0.7 : 0.9, 0.8);
            seq(ev, 'timpani', `${r}2:1 ${r}2:1 R:3`, i * BAR, i >= 20 ? 1 : 0.6);
        });
        // Bars 5–12: low brass theme creeping against the G pedal
        seq(ev, 'brass', 'G3:5 G3:2 Ab3:3 D4:5 Db4:5 C4:3 Db4:2 Eb4:5 D4:4 Db4:1 G3:5', 4 * BAR, 0.8, 0.95);
        // Bars 13–20: trumpet calls echoing the ostinato rhythm
        const call = (a, b, c, d) => `${a}:1/3 ${a}:1/3 ${a}:1/3 ${b}:2 ${c}:2 ${d}:5`;
        let t = 12 * BAR;
        t = seq(ev, 'brass', call('G4', 'G4', 'F4', 'Eb4'), t, 1, 0.9);
        t = seq(ev, 'brass', call('G4', 'Ab4', 'G4', 'D4'), t, 1, 0.9);
        t = seq(ev, 'brass', call('Ab4', 'Ab4', 'G4', 'F4'), t, 1, 0.9);
        seq(ev, 'brass', call('Ab4', 'Bb4', 'Ab4', 'Eb4'), t, 1, 0.9);
        // Bars 21–24: full brass chords, clashing G against Db
        seq(ev, 'brass', 'G3+D4+G4:5 Ab3+Db4+Ab4:5 G3+D4+G4:5 G3+D4+G4:4 R:1', 20 * BAR, 1, 0.95);
        return finish({ bpm: 168 }, ev, roots.length * BAR);
    }

    // The Long Winter: an original piece in an epic-fantasy style. 6/8; one beat = one eighth note.
    function buildLongWinter() {
        const ev = [];
        const BAR = 6;
        const CHORDS = {
            Dm: ['D2', 'A2', 'D3', 'F3'], Bb: ['Bb1', 'F2', 'Bb2', 'D3'], F: ['F2', 'C3', 'F3', 'A3'],
            C: ['C2', 'G2', 'C3', 'E3'], Gm: ['G1', 'D2', 'G2', 'Bb2'], A: ['A1', 'E2', 'A2', 'C#3'],
        };
        const intro = ['Dm', 'Bb', 'F', 'C'];
        const partA = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'A', 'Dm'];
        const partB = ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'];
        const form = [...intro, ...partA, ...partB, ...partA];

        form.forEach((name, i) => {
            const [r, f, o, th] = CHORDS[name];
            const t = i * BAR;
            seq(ev, 'cello', `${r}:1 ${f}:1 ${o}:1 ${th}:1 ${o}:1 ${f}:1`, t, i < 4 ? 0.7 : 0.85, 0.9);
            seq(ev, 'drone', `${o}:6`, t, 0.5);
            seq(ev, 'timpani', i % 2 ? `${r}:3 ${r}:3` : `${r}:6`, t, i % 2 ? 0.55 : 0.9);
        });

        const melodyA = 'A5:3 G5:1 F5:1 E5:1 F5:3 D5:3 C5:2 D5:1 F5:2 A5:1 G5:6 ' +
                        'A5:3 G5:1 F5:1 E5:1 D5:2 E5:1 F5:2 G5:1 E5:3 C#5:3 D5:6';
        const melodyB = 'F5:2 G5:1 A5:2 Bb5:1 C6:3 Bb5:1 A5:1 G5:1 A5:3 F5:3 D5:6 ' +
                        'F5:2 G5:1 A5:2 Bb5:1 C6:2 D6:1 E6:3 C#6:3 A5:3 A5:6';
        let t = intro.length * BAR;
        t = seq(ev, 'strings', melodyA, t, 0.8);
        seq(ev, 'horn', melodyB.replace(/(\d):/g, (m, o) => `${o - 1}:`), t, 0.7);
        t = seq(ev, 'strings', melodyB, t, 0.95);
        seq(ev, 'horn', melodyA.replace(/(\d):/g, (m, o) => `${o - 1}:`), t, 0.8);
        seq(ev, 'strings', melodyA, t, 1);
        return finish({ bpm: 230 }, ev, form.length * BAR);
    }

    // General MIDI program -> one of our synth voices
    function gmVoice(ch, program) {
        if (ch === 9) return 'drum';
        if (program < 8) return 'piano';
        if (program >= 32 && program < 40) return 'bass';
        if (program >= 56 && program < 64) return 'brass';
        if (program >= 64 && program < 80) return 'horn';
        return 'strings';
    }

    const TRACKS = [
        // rms: loudness of one pass, measured offline with measureGain() (re-measure after changing a track)
        { id: 'korobeiniki', name: 'Korobeiniki', build: buildKorobeiniki, rms: 0.485 },
        { id: 'mars', name: 'Mars, Bringer of War', build: buildMars, rms: 0.174 },
        { id: 'winter', name: 'The Long Winter', build: buildLongWinter, rms: 0.171 },
        // Grieg, Op. 46 No. 4, from the Mutopia Project (public domain)
        { id: 'mountain', name: 'Mountain King', midi: 'mountain-king.mid', voice: () => 'piano', rms: 0.113 },
        // Optional: shown only if tetris/music/got.mid exists
        { id: 'got', name: 'Game of Thrones', midi: 'got.mid', voice: gmVoice, optional: true },
    ];

    // --- MIDI reader -----------------------------------------------------------
    // Reads format 0/1 Standard MIDI Files: note on/off, program change, tempo.
    function parseMidi(buf, voiceFor) {
        const d = new DataView(buf);
        const tag = p => String.fromCharCode(d.getUint8(p), d.getUint8(p + 1), d.getUint8(p + 2), d.getUint8(p + 3));
        if (tag(0) !== 'MThd') throw new Error('Not a MIDI file');
        const ntracks = d.getUint16(10), division = d.getUint16(12);
        if (division & 0x8000) throw new Error('SMPTE timing not supported');

        const tempos = [];   // [tick, microseconds per quarter]
        const notes = [];    // { on, off, p, v, voice }
        let endTick = 0;
        let p = 8 + d.getUint32(4);

        for (let tr = 0; tr < ntracks && p < d.byteLength; tr++) {
            if (tag(p) !== 'MTrk') break;
            const end = p + 8 + d.getUint32(p + 4);
            p += 8;
            let tick = 0, status = 0;
            const open = new Map();
            const programs = new Array(16).fill(0);
            const vlq = () => { let v = 0, b; do { b = d.getUint8(p++); v = (v << 7) | (b & 0x7f); } while (b & 0x80); return v; };

            while (p < end) {
                tick += vlq();
                let b = d.getUint8(p);
                if (b === 0xff) {
                    const type = d.getUint8(p + 1); p += 2;
                    const len = vlq();
                    if (type === 0x51) tempos.push([tick, (d.getUint8(p) << 16) | (d.getUint8(p + 1) << 8) | d.getUint8(p + 2)]);
                    p += len;
                    continue;
                }
                if (b === 0xf0 || b === 0xf7) { p++; p += vlq(); continue; }
                if (b & 0x80) { status = b; p++; }
                const type = status & 0xf0, ch = status & 0x0f;
                const a1 = d.getUint8(p);
                const a2 = (type === 0xc0 || type === 0xd0) ? 0 : d.getUint8(p + 1);
                p += (type === 0xc0 || type === 0xd0) ? 1 : 2;

                const key = ch * 128 + a1;
                if (type === 0x90 && a2 > 0) {
                    if (!open.has(key)) open.set(key, []);
                    open.get(key).push({ on: tick, p: a1, v: a2 / 127, voice: voiceFor(ch, programs[ch]) });
                } else if (type === 0x80 || type === 0x90) {
                    const n = open.get(key)?.shift();
                    if (n) { n.off = tick; notes.push(n); }
                } else if (type === 0xc0) {
                    programs[ch] = a1;
                }
            }
            endTick = Math.max(endTick, tick);
            p = end;
        }

        // Convert ticks to beats at the opening tempo, honouring later tempo changes
        tempos.sort((a, b) => a[0] - b[0]);
        if (!tempos.length || tempos[0][0] > 0) tempos.unshift([0, 500000]);
        const firstUspq = tempos[0][1];
        const toBeats = tick => {
            let us = 0;
            for (let i = 0; i < tempos.length; i++) {
                const [t0, uspq] = tempos[i];
                if (t0 >= tick) break;
                const t1 = Math.min(tick, i + 1 < tempos.length ? tempos[i + 1][0] : Infinity);
                us += (t1 - t0) / division * uspq;
            }
            return us / firstUspq;
        };
        const events = notes.map(n => {
            const b = toBeats(n.on);
            return { b, d: Math.max(0.05, toBeats(n.off) - b), p: n.p, v: n.v, voice: n.voice };
        });
        return finish({ bpm: 60e6 / firstUspq }, events, Math.ceil(toBeats(endTick)));
    }

    // --- Synth voices ----------------------------------------------------------
    let ctx = null, master = null, noise = null, volume = 7;

    const volumeGain = () => volume ? FULL_VOLUME * Math.pow(10, -(10 - volume) * VOLUME_STEP_DB / 20) : 0;

    function makeNoise(ac) {
        const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }

    function initContext() {
        if (ctx) return;
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = ctx.createDynamicsCompressor();
        comp.connect(ctx.destination);
        master = ctx.createGain();
        master.gain.value = volumeGain();
        master.connect(comp);
        noise = makeNoise(ctx);
    }

    function osc(type, freq, t, end, dest, detune = 0) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        o.connect(dest);
        o.start(t);
        o.stop(end);
        return o;
    }

    // Gain node with attack / sustain / release; returns [node, stopTime]
    function envelope(t, dur, peak, attack, release, dest) {
        const g = ctx.createGain();
        const a = Math.min(attack, dur * 0.5);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.setValueAtTime(peak, t + Math.max(a, dur - release));
        g.gain.linearRampToValueAtTime(0, t + dur);
        g.connect(dest);
        return [g, t + dur + 0.02];
    }

    // Gain node with a fast attack and exponential decay; returns [node, stopTime]
    function decay(t, peak, length, dest) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + length);
        g.connect(dest);
        return [g, t + length + 0.02];
    }

    function lowpass(freq, dest, q = 0.7) {
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = freq;
        f.Q.value = q;
        f.connect(dest);
        return f;
    }

    function noiseBurst(t, length, peak, filterType, freq, dest) {
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        f.frequency.value = freq;
        const [g, end] = decay(t, peak, length, dest);
        src.connect(f); f.connect(g);
        src.start(t);
        src.stop(end);
    }

    function playNote(voice, t, dur, midi, vel, dest) {
        const f = freqOf(midi);
        switch (voice) {
            case 'chip': {
                const [g, end] = envelope(t, dur, 0.5 * vel, 0.01, 0.03, dest);
                osc('square', f, t, end, g);
                break;
            }
            case 'bass': {
                const [g, end] = envelope(t, dur, 0.9 * vel, 0.01, 0.03, dest);
                osc('triangle', f, t, end, g);
                break;
            }
            case 'piano': {
                const [g, end] = decay(t, 0.55 * vel, Math.min(dur + 0.35, 2.5), dest);
                const lp = lowpass(Math.min(5000, f * 6), g);
                osc('triangle', f, t, end, lp);
                const edge = ctx.createGain(); // a little sawtooth for hammer brightness
                edge.gain.value = 0.25;
                edge.connect(lp);
                osc('sawtooth', f, t, end, edge, 4);
                break;
            }
            case 'strings': {
                const [g, end] = envelope(t, dur, 0.16 * vel, 0.06, 0.15, dest);
                const lp = lowpass(1800, g);
                osc('sawtooth', f, t, end, lp, -7);
                osc('sawtooth', f, t, end, lp, 7);
                break;
            }
            case 'cello': {
                const [g, end] = envelope(t, dur, 0.32 * vel, 0.008, 0.06, dest);
                osc('sawtooth', f, t, end, lowpass(900, g, 1.5));
                break;
            }
            case 'colLegno': {
                const [g, end] = decay(t, 0.45 * vel, Math.min(dur, 0.16), dest);
                osc('sawtooth', f, t, end, lowpass(1400, g, 2));
                noiseBurst(t, 0.03, 0.15 * vel, 'bandpass', 2500, dest);
                break;
            }
            case 'brass':
            case 'horn': {
                const bright = voice === 'brass' ? 2600 : 1100;
                const [g, end] = envelope(t, dur, (voice === 'brass' ? 0.22 : 0.16) * vel, 0.05, 0.12, dest);
                const lp = lowpass(300, g, 1.2);
                lp.frequency.setValueAtTime(300, t);
                lp.frequency.linearRampToValueAtTime(300 + bright * vel, t + 0.08);
                lp.frequency.linearRampToValueAtTime(300 + bright * vel * 0.6, t + 0.3);
                osc('sawtooth', f, t, end, lp);
                osc('sawtooth', f, t, end, lp, 5);
                break;
            }
            case 'drone': {
                const [g, end] = envelope(t, dur, 0.22 * vel, 0.3, 0.4, dest);
                osc('triangle', f, t, end, g);
                osc('sine', f / 2, t, end, g);
                break;
            }
            case 'timpani': {
                const [g, end] = decay(t, 0.9 * vel, 0.9, dest);
                const o = osc('sine', f * 1.4, t, end, g);
                o.frequency.setValueAtTime(f * 1.4, t);
                o.frequency.exponentialRampToValueAtTime(f, t + 0.05);
                noiseBurst(t, 0.12, 0.25 * vel, 'lowpass', 500, dest);
                break;
            }
            case 'drum': { // General MIDI percussion: low notes boom, the rest hiss
                if (midi <= 41) playNote('timpani', t, dur, 38, vel, dest);
                else noiseBurst(t, midi >= 42 && midi <= 46 ? 0.05 : 0.15, 0.5 * vel, 'highpass', 3000, dest);
                break;
            }
        }
    }

    // --- Scheduler -------------------------------------------------------------
    const cache = new Map();
    let available = TRACKS.filter(t => !t.optional);
    let state = null;      // { track, anchorTime, anchorBeat, idx, schedBeat, out }
    let timer = null, rate = 1, token = 0;

    async function load(def) {
        if (cache.has(def.id)) return cache.get(def.id);
        let track;
        if (def.build) {
            track = def.build();
        } else {
            const res = await fetch(BASE_URL + def.midi);
            if (!res.ok) throw new Error('Could not load ' + def.midi);
            track = parseMidi(await res.arrayBuffer(), def.voice);
        }
        track.gain = def.rms ? TARGET_RMS / def.rms : await measureGain(track);
        cache.set(def.id, track);
        return track;
    }

    // Renders one pass of the track offline and returns the gain that brings it to
    // TARGET_RMS, so every song plays at the same loudness whatever its instruments.
    async function measureGain(track) {
        const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!Offline) return 1;
        const spb = 60 / track.bpm;
        const seconds = Math.min(track.length * spb, MEASURE_MAX_S);
        const off = new Offline(1, Math.ceil((seconds + 1) * MEASURE_RATE), MEASURE_RATE);
        // Ignore deep bass, which adds energy but little perceived loudness
        const hp = off.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 120;
        hp.connect(off.destination);
        // playNote builds its nodes on `ctx`, so point it at the offline context while scheduling
        const saved = [ctx, noise];
        ctx = off;
        noise = makeNoise(off);
        try {
            for (const e of track.events) {
                if (e.b * spb >= seconds) break;
                playNote(e.voice, e.b * spb, e.d * spb, e.p, e.v, hp);
            }
        } finally {
            [ctx, noise] = saved;
        }
        const data = (await off.startRendering()).getChannelData(0);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        return rms > 0 ? Math.min(5, Math.max(0.2, TARGET_RMS / rms)) : 1;
    }

    const secPerBeat = () => 60 / (state.track.bpm * rate);

    function tick() {
        const s = state;
        if (!s) return;
        const now = ctx.currentTime, horizon = now + LOOKAHEAD;
        const { events, length } = s.track;
        for (let loops = 0; loops < 4; loops++) {
            const spb = secPerBeat();
            const horizonBeat = s.anchorBeat + (horizon - s.anchorTime) / spb;
            const until = Math.min(horizonBeat, length);
            while (s.idx < events.length && events[s.idx].b < until) {
                const e = events[s.idx++];
                const t = s.anchorTime + (e.b - s.anchorBeat) * spb;
                if (t >= now - 0.01) playNote(e.voice, Math.max(t, now), e.d * spb, e.p, e.v, s.out);
            }
            s.schedBeat = until;
            if (horizonBeat < length) break;
            // Loop: the next pass starts exactly where this one ends
            s.anchorTime += (length - s.anchorBeat) * spb;
            s.anchorBeat = 0;
            s.idx = 0;
            s.schedBeat = 0;
        }
    }

    function stop() {
        token++;
        clearInterval(timer);
        timer = null;
        if (!state) return;
        const out = state.out;
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.02);
        setTimeout(() => out.disconnect(), 300);
        state = null;
    }

    async function play(id) {
        initContext();
        stop();
        const def = available.find(t => t.id === id);
        if (!def) return;
        const my = token;
        let track;
        try {
            track = await load(def);
        } catch (e) {
            console.warn('Music:', e.message);
            return;
        }
        if (my !== token) return; // another play/stop happened while loading
        const out = ctx.createGain();
        out.gain.value = track.gain;
        out.connect(master);
        state = { track, anchorTime: ctx.currentTime + 0.06, anchorBeat: 0, idx: 0, schedBeat: 0, out };
        tick();
        timer = setInterval(tick, TICK_MS);
    }

    // Tempo follows the game level; re-anchoring keeps already-queued notes in place
    function setLevel(level) {
        const r = Math.min(MAX_RATE, 1 + 0.03 * (level - 1));
        if (state) {
            const spb = secPerBeat();
            state.anchorTime += (state.schedBeat - state.anchorBeat) * spb;
            state.anchorBeat = state.schedBeat;
        }
        rate = r;
    }

    // Must be called from a user gesture so browsers allow audio
    function unlock() {
        initContext();
        if (ctx.state === 'suspended') ctx.resume();
    }

    // 0 (mute) to 10
    function setVolume(v) {
        volume = Math.max(0, Math.min(10, v));
        if (master) master.gain.setTargetAtTime(volumeGain(), ctx.currentTime, 0.03);
        return volume;
    }

    async function probeOptional() {
        const found = new Set();
        for (const def of TRACKS.filter(t => t.optional)) {
            try {
                const res = await fetch(BASE_URL + def.midi, { method: 'HEAD' });
                if (res.ok) found.add(def);
            } catch (e) { /* offline or file:// — leave it out */ }
        }
        available = TRACKS.filter(t => !t.optional || found.has(t));
        return available;
    }

    return {
        tracks: () => available.map(({ id, name }) => ({ id, name })),
        play,
        stop,
        unlock,
        setLevel,
        probeOptional,
        setVolume,
        getVolume: () => volume,
        pause: () => { if (ctx) ctx.suspend(); },
        resume: () => { if (ctx) ctx.resume(); },
    };
})();
