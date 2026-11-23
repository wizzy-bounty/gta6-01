// missions.js — Marisol Bay's story: eight jobs for Vera Solano's crew,
// each a chain of stages with an objective, a next step and a voice line.
// The screenshot scenes borrow these same cards, mid-job.

export const JOBS = [
  {
    id: 'sand-runner', title: 'SAND RUNNER', giver: 'Vera Solano', n: 5, total: 8,
    objective: 'Lose the MBPD before the tide turns',
    next: 'Break line of sight on the Strand',
    stages: 4, stage: 3, wanted: 4, cash: 18450, respect: 6, rank: 'FIXER',
    line: { who: 'vera', text: 'Dax, they are on your tailgate. Shake them before the Strand cameras wake up.' },
  },
  {
    id: 'casino-row', title: 'CASINO ROW', giver: 'Tía Rosa', n: 2, total: 8,
    objective: 'The valet called it in. Lose the police',
    next: 'Deliver the car to the Palma Real garage',
    stages: 4, stage: 3, wanted: 4, cash: 6420, respect: 2, rank: 'DOCK HAND',
    line: { who: 'vera', text: 'Rosa says the valet sang. Dump the heat, then bring her Regent home clean.' },
  },
  {
    id: 'pearl-meet', title: 'THE PEARL MEET', giver: 'Vera Solano', n: 3, total: 8,
    objective: 'Meet Vera at Azure Pearl plaza',
    next: 'Hear the Pier 9 plan, keep the crew close',
    stages: 3, stage: 1, wanted: 0, cash: 22100, respect: 6, rank: 'FIXER',
    line: { who: 'vera', text: 'No sirens, no hurry. Walk with me, Dax — Pier 9 sails at midnight and we sail with it.' },
  },
  {
    id: 'pier-nine', title: 'PIER NINE', giver: 'Marco the Wheelman', n: 8, total: 8,
    objective: 'Reach the yacht before HERON-1 pins you',
    next: 'Board the Marisol Star at the pier head',
    stages: 5, stage: 4, wanted: 5, cash: 86250, respect: 6, rank: 'SHOT CALLER',
    line: { who: 'pip', text: 'The Star is lit and waiting, Dax. One cruiser on the pier — smile and floor it.' },
  },
];

export class MissionRunner {
  constructor(jobs = JOBS) {
    this.jobs = jobs;
    this.index = 0;
    this.stage = 0;
    this.done = [];
  }

  current() { return this.jobs[this.index] || null; }

  advance() {
    const job = this.current();
    if (!job) return null;
    this.stage++;
    if (this.stage >= job.stages) {
      this.done.push(job.id);
      this.index++;
      this.stage = 0;
      return this.current();
    }
    return job;
  }

  progressText() {
    const job = this.current();
    if (!job) return 'All jobs done — Marisol Bay is yours.';
    return `JOB ${job.n} OF ${job.total} · ${job.title}`;
  }
}

// Waypoints the live game walks the player through, in world coordinates.
export const WAYPOINTS = [
  { x: 150, z: 60, label: 'Strand Boulevard' },
  { x: 46, z: 46, label: 'Casino Row' },
  { x: 69, z: 69, label: 'Azure Pearl plaza' },
  { x: 30, z: -232, label: 'Pier 9 yacht' },
];
