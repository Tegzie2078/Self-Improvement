// Training plan 25 Nov – 31 Dec 2026, starting loads and benchmark tests.
// Edit here to change the plan; logs live in the database.

const PLAN = [
  ['2026-11-25', 0, 'bike', 'Bike baseline', '5 min very easy, 20 min steady at RPE 4 (full sentences), 5 min cool-down. Log avg watts + HR in Progress.', '90–120 W, 80–90 rpm'],
  ['2026-11-26', 0, 'strengthA', 'Strength A (intro)', '2 × 10 of each Strength A lift. Find weights that feel RPE 6 (4 reps left).', 'See Strength'],
  ['2026-11-27', 0, 'rest', 'Rest', 'Optional 15–20 min easy walk.', '—'],
  ['2026-11-28', 0, 'erg', 'Erg baseline', '5 min easy, then 15 min steady at rate 20, RPE 4. Log metres + avg HR in Progress.', '~2:25–2:35/500m'],
  ['2026-11-29', 0, 'rest', 'Rest', 'Rest or easy walk.', '—'],
  ['2026-11-30', 1, 'strengthA', 'Strength A', '3 × 10 (2 sets if Thursday wiped you out). Rest 90 s seated between sets.', 'RPE 6–7'],
  ['2026-12-01', 1, 'bike', 'Bike Zone 2', '5 min warm-up, 25 min steady, 5 min cool-down.', '90–110 W, 80–90 rpm'],
  ['2026-12-02', 1, 'rest', 'Rest', 'Walk or stretch.', '—'],
  ['2026-12-03', 1, 'strengthB', 'Strength B', '3 × 10 of each Strength B lift.', 'RPE 6–7'],
  ['2026-12-04', 1, 'erg', 'Erg steady', '5 min warm-up, 20 min continuous at rate 18–20, 5 min cool-down.', '2:25–2:35/500m'],
  ['2026-12-05', 1, 'treadmill', 'Treadmill walk', '25 min brisk walk. Swap for the bike if you feel light-headed.', '5.5–6 km/h, 2–4% incline'],
  ['2026-12-06', 1, 'rest', 'Rest', '—', '—'],
  ['2026-12-07', 2, 'strengthA', 'Strength A', '3 × 10. Add weight wherever last session hit all reps at RPE 7 or less.', 'RPE 7'],
  ['2026-12-08', 2, 'bike', 'Bike Zone 2', '5 min warm-up, 30 min steady, 5 min cool-down.', '100–120 W, RPE 4'],
  ['2026-12-09', 2, 'rest', 'Rest', '—', '—'],
  ['2026-12-10', 2, 'strengthB', 'Strength B', '3 × 10, progress as above.', 'RPE 7'],
  ['2026-12-11', 2, 'erg', 'Erg pieces', '5 min warm-up, 3 × 7 min steady at rate 20 with 2 min easy paddling between, cool-down.', '2:22–2:30/500m'],
  ['2026-12-12', 2, 'treadmill', 'Treadmill walk–jog', '5 min walk, then 6 × (1 min jog / 2 min walk), 5 min walk.', 'Jog 8 km/h, walk 6 km/h, 1% incline'],
  ['2026-12-13', 2, 'rest', 'Rest', '—', '—'],
  ['2026-12-14', 3, 'strengthA', 'Strength A', '3 × 8 at a slightly heavier weight.', 'RPE 7–8'],
  ['2026-12-15', 3, 'bike', 'Bike intervals', '10 min easy, 6 × (1 min hard / 2 min easy), 10 min easy.', 'Hard 140–170 W (RPE 7), easy 90–100 W'],
  ['2026-12-16', 3, 'rest', 'Rest', '—', '—'],
  ['2026-12-17', 3, 'strengthB', 'Strength B', '3 × 8 at a slightly heavier weight.', 'RPE 7–8'],
  ['2026-12-18', 3, 'erg', 'Erg steady', '5 min warm-up, 25 min continuous at rate 20, cool-down.', '2:20–2:28/500m'],
  ['2026-12-19', 3, 'treadmill', 'Treadmill walk–jog', '5 min walk, then 6 × (2 min jog / 2 min walk), 5 min walk.', 'Jog 8–8.5 km/h'],
  ['2026-12-20', 3, 'rest', 'Rest', '—', '—'],
  ['2026-12-21', 4, 'strengthA', 'Strength A (lighter week)', '2 × 10 at Week 3 weights.', 'RPE 6'],
  ['2026-12-22', 4, 'bike', 'Bike Zone 2', '25 min easy.', '100–110 W'],
  ['2026-12-23', 4, 'rest', 'Rest', '—', '—'],
  ['2026-12-24', 4, 'erg', 'Erg easy', '20 min easy at rate 18.', '2:28–2:35/500m'],
  ['2026-12-25', 4, 'rest', 'Christmas Day', 'Walk after lunch (good for cravings too).', '—'],
  ['2026-12-26', 4, 'strengthB', 'Strength B (optional)', '2 × 10 at Week 3 weights.', 'RPE 6'],
  ['2026-12-27', 4, 'rest', 'Rest', '—', '—'],
  ['2026-12-28', 5, 'strengthTest', 'Strength retest', 'Warm up, then 1 × 8 at RPE 8 on Smith squat, Smith bench, lat pulldown and Smith RDL. Log in Progress.', 'Beat Week 1 weights'],
  ['2026-12-29', 5, 'bike', 'Bike retest', 'Repeat the 25 Nov test exactly: 20 min at RPE 4.', 'More watts at the same RPE / HR'],
  ['2026-12-30', 5, 'erg', 'Erg retest', 'Repeat the 28 Nov test exactly: 15 min at rate 20, RPE 4.', 'More metres'],
  ['2026-12-31', 5, 'rest', 'Rest + review', 'Review your progress and set January targets for the Olympic triathlon build.', '—'],
].map(([date, wk, type, session, prescription, target]) => ({ date, wk, type, session, prescription, target }));

const STRENGTH = {
  A: [
    { name: 'Smith machine squat', sets: '3 × 10', start: 30, cue: 'Bar on upper back, sit to just below parallel, breathe out on the way up.' },
    { name: 'Smith machine bench press', sets: '3 × 10', start: 25, cue: 'Lower to mid-chest under control. Get up from the bench slowly.' },
    { name: 'Seated cable row', sets: '3 × 10', start: 30, cue: 'Chest tall, squeeze shoulder blades together.' },
    { name: 'Smith hip thrust', sets: '3 × 10', start: 40, cue: 'Pad on the bar, upper back on a bench. Easy on blood pressure.' },
    { name: 'Cable face pull', sets: '2 × 12', start: 12.5, cue: 'Rope to forehead, elbows high.' },
    { name: 'Cable Pallof press', sets: '2 × 10 each side', start: 10, cue: 'Resist the twist, breathe out as you press.' },
  ],
  B: [
    { name: 'Smith Romanian deadlift', sets: '3 × 10', start: 30, cue: 'Soft knees, hips back until hamstrings stretch, flat back.' },
    { name: 'Cable lat pulldown', sets: '3 × 10', start: 35, cue: 'Pull to upper chest, no swinging.' },
    { name: 'Smith incline press', sets: '3 × 10', start: 20, cue: 'Bench at about 30°.' },
    { name: 'Single-arm cable row', sets: '2 × 12 each side', start: 15, cue: 'Pull elbow to hip.' },
    { name: 'Cable triceps pushdown', sets: '2 × 12', start: 15, cue: 'Elbows pinned to your sides.' },
    { name: 'Cable biceps curl', sets: '2 × 12', start: 12.5, cue: 'No swinging.' },
    { name: 'Cable woodchop', sets: '2 × 10 each side', start: 10, cue: 'Rotate from the hips, high to low.' },
  ],
};

const BENCHMARKS = [
  { key: 'bike_watts', label: 'Bike 20 min @ RPE 4: avg watts', unit: 'W', better: 'higher', baselineDate: '2026-11-25', retestDate: '2026-12-29', from: 'avg_watts' },
  { key: 'bike_hr', label: 'Bike 20 min @ RPE 4: avg HR', unit: 'bpm', better: 'lower', baselineDate: '2026-11-25', retestDate: '2026-12-29', from: 'avg_hr' },
  { key: 'erg_metres', label: 'Erg 15 min @ rate 20: metres', unit: 'm', better: 'higher', baselineDate: '2026-11-28', retestDate: '2026-12-30', from: 'distance_m' },
  { key: 'erg_hr', label: 'Erg 15 min @ rate 20: avg HR', unit: 'bpm', better: 'lower', baselineDate: '2026-11-28', retestDate: '2026-12-30', from: 'avg_hr' },
  { key: 'squat', label: 'Smith squat 1 × 8 @ RPE 8', unit: 'kg', better: 'higher', baselineDate: '2026-11-30', retestDate: '2026-12-28' },
  { key: 'bench', label: 'Smith bench 1 × 8 @ RPE 8', unit: 'kg', better: 'higher', baselineDate: '2026-11-30', retestDate: '2026-12-28' },
  { key: 'pulldown', label: 'Lat pulldown 1 × 8 @ RPE 8', unit: 'kg', better: 'higher', baselineDate: '2026-12-03', retestDate: '2026-12-28' },
  { key: 'rdl', label: 'Smith RDL 1 × 8 @ RPE 8', unit: 'kg', better: 'higher', baselineDate: '2026-12-03', retestDate: '2026-12-28' },
];


// Faster track: replaces the plan from FAST_FROM onwards when switched on in Train.
const FAST_FROM = '2026-12-07';
const FAST_PLAN = [
  ['2026-12-07', 2, 'strengthA', 'Strength A + easy spin', 'Main lifts 3 × 10, accessories 2 × 12. Add weight where last session felt RPE 7 or less. Then 10 min easy bike.', 'RPE 7 · ~60 min'],
  ['2026-12-08', 2, 'bike', 'Bike Zone 2', '5 min warm-up, 40 min steady, 5 min cool-down.', '100–120 W, 85–90 rpm'],
  ['2026-12-09', 2, 'erg', 'Erg Zone 2', '30 min continuous at rate 18–20.', '2:24–2:32/500m'],
  ['2026-12-10', 2, 'strengthB', 'Strength B + easy row', 'Main lifts 3 × 10, accessories 2 × 12. Then 10 min easy erg.', 'RPE 7 · ~60 min'],
  ['2026-12-11', 2, 'erg', 'Erg pieces', '10 min warm-up, 4 × 7 min at rate 20 with 2 min easy paddling between, cool-down.', '2:20–2:28/500m'],
  ['2026-12-12', 2, 'treadmill', 'Walk–jog + bike', '5 min walk, 6 × (2 min jog / 1 min walk), 5 min walk. Then 15 min easy bike.', 'Jog 8 km/h · bike 100 W'],
  ['2026-12-13', 2, 'rest', 'Rest', 'Full rest. ~4½ h this week.', '—'],
  ['2026-12-14', 3, 'strengthA', 'Strength A (4 sets)', 'Main lifts 4 × 8, last set RPE 8 (2 reps left). Accessories 3 × 12. Then 10 min easy bike.', '~70 min'],
  ['2026-12-15', 3, 'bike', 'Bike intervals', '10 min easy, 8 × (1 min hard / 2 min easy), 10 min easy.', 'Hard 150–180 W (RPE 7–8), easy 95–105 W'],
  ['2026-12-16', 3, 'erg', 'Erg Zone 2', '40 min continuous at rate 18–20.', '2:22–2:30/500m'],
  ['2026-12-17', 3, 'strengthB', 'Strength B (4 sets)', 'Main lifts 4 × 8, last set RPE 8. Accessories 3 × 12.', '~60 min'],
  ['2026-12-18', 3, 'erg', 'Erg pieces', '10 min warm-up, 3 × 10 min at rate 20 with 3 min easy between, cool-down.', '2:18–2:25/500m'],
  ['2026-12-19', 3, 'treadmill', 'Run–walk + bike', '5 min walk, 4 × (5 min jog / 1 min walk), 5 min walk. Then 25 min Zone 2 bike.', 'Jog 8–8.5 km/h · bike 100–120 W'],
  ['2026-12-20', 3, 'rest', 'Rest', 'Full rest. ~6 h this week.', '—'],
  ['2026-12-21', 4, 'strengthA', 'Strength A (lighter)', 'Main lifts 3 × 8 at Week 3 weights. Accessories 2 × 12.', 'RPE 6–7'],
  ['2026-12-22', 4, 'bike', 'Bike Zone 2', '40 min steady.', '100–120 W'],
  ['2026-12-23', 4, 'erg', 'Erg Zone 2', '30 min easy at rate 18–20.', '2:25–2:32/500m'],
  ['2026-12-24', 4, 'strengthB', 'Strength B (lighter)', 'Main lifts 3 × 8 at Week 3 weights. Accessories 2 × 12.', 'RPE 6–7'],
  ['2026-12-25', 4, 'rest', 'Christmas Day', '30–60 min walk.', '—'],
  ['2026-12-26', 4, 'bike', 'Boxing Day spin', '40 min Zone 2 on the bike (or erg).', 'Easy'],
  ['2026-12-27', 4, 'rest', 'Rest', 'Full rest before the tests. ~3½ h this week.', '—'],
].map(([date, wk, type, session, prescription, target]) => ({ date, wk, type, session, prescription, target }))
  .concat(PLAN.filter((p) => p.date >= '2026-12-28'));

// Starter daily tasks. active: false ones appear as suggestions you can switch on.
const DEFAULT_HABITS = [
  { id: 'make-bed', name: 'Make my bed', slot: 'morning', active: true },
  { id: 'vitamin-d', name: 'Take vitamin D', slot: 'morning', active: true },
  { id: 'creatine', name: 'Take creatine', slot: 'morning', active: true },
  { id: 'daylight', name: '10 min outside in daylight', slot: 'morning', active: true },
  { id: 'train', name: 'Training session, or 10 min mobility on rest days', slot: 'day', active: true },
  { id: 'read', name: 'Read 10 pages', slot: 'evening', active: true },
  { id: 'phone-out', name: 'Phone out of the bedroom', slot: 'evening', active: true },
  { id: 'cello', name: 'Cello practice, 20 min', slot: 'day', active: false },
  { id: 'admin', name: 'One job or gap-year admin task', slot: 'day', active: false },
  { id: 'message', name: 'Message a friend or family member', slot: 'day', active: false },
  { id: 'water', name: '2 L of water by 6pm', slot: 'day', active: false },
  { id: 'kit-out', name: 'Kit out for tomorrow', slot: 'evening', active: false },
  { id: 'journal', name: 'Write 3 lines about the day', slot: 'evening', active: false },
];

module.exports = { PLAN, FAST_PLAN, FAST_FROM, STRENGTH, BENCHMARKS, DEFAULT_HABITS };
