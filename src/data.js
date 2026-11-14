/**
 * Static game content. Everything the player can buy lives here; logic in
 * game.js reads it generically, so new rows need no code changes.
 */

/** Crew produce credits per second. Cost grows by `scaling` per hire. */
export const CREW = [
  { id: 'rookie',    name: 'Rookie',          cost: 15,          rate: 0.2,     scaling: 1.15, blurb: 'Fresh off the shuttle. Chases petty skips for pocket money.' },
  { id: 'tracker',   name: 'Skip Tracer',     cost: 120,         rate: 1.4,     scaling: 1.15, blurb: 'Reads transit manifests the way other people read novels.' },
  { id: 'gunhand',   name: 'Gunhand',         cost: 1_300,       rate: 8,       scaling: 1.15, blurb: 'Brings them back. Usually breathing.' },
  { id: 'informant', name: 'Informant Ring',  cost: 14_000,      rate: 47,      scaling: 1.15, blurb: 'Bartenders, dock clerks and a very nervous customs officer.' },
  { id: 'cutter',    name: 'Cutter Crew',     cost: 150_000,     rate: 260,     scaling: 1.15, blurb: 'A fast ship and four people who never ask where it’s going.' },
  { id: 'syndicate', name: 'Syndicate Desk',  cost: 1_600_000,   rate: 1_400,   scaling: 1.15, blurb: 'An office that bills other offices.' },
  { id: 'warrant',   name: 'Warrant Bureau',  cost: 20_000_000,  rate: 7_800,   scaling: 1.15, blurb: 'You don’t take bounties anymore. You write them.' },
  { id: 'fleet',     name: 'Pursuit Fleet',   cost: 330_000_000, rate: 44_000,  scaling: 1.15, blurb: 'There is nowhere left in the sector to run.' },
];

/** Hire count milestones that double a crew type's output. */
export const CREW_TIERS = [
  { at: 10,  costMult: 10,     label: 'Drilled' },
  { at: 25,  costMult: 60,     label: 'Seasoned' },
  { at: 50,  costMult: 600,    label: 'Veteran' },
  { at: 100, costMult: 12_000, label: 'Legendary' },
];

/**
 * Office upgrades.
 *  kind: 'repeat' (has max) | 'once'
 *  effect: interpreted in game.js#recompute
 *  req: optional unlock requirement
 */
export const UPGRADES = [
  {
    id: 'reflexes', kind: 'repeat', max: 15, cost: 25, scaling: 1.75,
    name: 'Quick Draw', group: 'Hunt',
    desc: 'Hunt cooldown −5% per level.',
    effect: { cooldownStep: 0.05 },
  },
  {
    id: 'iron', kind: 'repeat', max: 14, cost: 60, scaling: 7,
    name: 'Heavier Iron', group: 'Hunt',
    desc: 'Each level doubles what a hunt pays.',
    effect: { huntMult: 2 },
  },
  {
    id: 'snitch', kind: 'repeat', max: 5, cost: 400, scaling: 6,
    name: 'Snitch on Retainer', group: 'Automation',
    desc: 'Hunts automatically. Each level halves the interval.',
    effect: { autoHunt: true },
    req: { lifetime: 200 },
  },
  {
    id: 'radio', kind: 'once', cost: 2_500,
    name: 'Dispatch Radio', group: 'Office',
    desc: 'All income +15%.',
    effect: { incomeMult: 1.15 },
    req: { crewTotal: 15 },
  },
  {
    id: 'coordination', kind: 'once', cost: 9_000,
    name: 'Field Coordination', group: 'Hunt',
    desc: 'Hunts also pay 5% of your income per second.',
    effect: { huntFromIncome: 0.05 },
    req: { crewTotal: 25 },
  },
  {
    id: 'ledger', kind: 'once', cost: 60_000,
    name: 'Proper Bookkeeping', group: 'Office',
    desc: 'All income +25%.',
    effect: { incomeMult: 1.25 },
    req: { lifetime: 40_000 },
  },
  {
    id: 'broker', kind: 'once', cost: 250_000,
    name: 'Contract Broker', group: 'Contracts',
    desc: 'Contract rewards +50%.',
    effect: { contractMult: 1.5 },
    req: { contracts: 3 },
  },
  {
    id: 'coordination2', kind: 'once', cost: 900_000,
    name: 'Command Net', group: 'Hunt',
    desc: 'Hunts pay a further 10% of income per second.',
    effect: { huntFromIncome: 0.10 },
    req: { crewTotal: 120 },
  },
  {
    id: 'license', kind: 'once', cost: 4_000_000,
    name: 'Sector License', group: 'Office',
    desc: 'All income +50%.',
    effect: { incomeMult: 1.5 },
    req: { contracts: 8 },
  },
  {
    id: 'reputation', kind: 'once', cost: 25_000_000,
    name: 'Name on the Door', group: 'Contracts',
    desc: 'Reputation is twice as effective.',
    effect: { repMult: 2 },
    req: { rep: 25 },
  },
];

/** Contract risk tiers. Duration is "seconds of your current output". */
export const CONTRACT_TIERS = [
  { id: 'low',  label: 'Low risk',  seconds: 45,  payout: 1.8, rep: 1 },
  { id: 'mid',  label: 'Wanted',    seconds: 150, payout: 2.4, rep: 3 },
  { id: 'high', label: 'Most wanted', seconds: 480, payout: 3.2, rep: 8 },
];

export const CONTRACT_NAMES = {
  first: ['Vel', 'Oru', 'Desh', 'Mara', 'Kesse', 'Tobin', 'Ilya', 'Renn', 'Saffi', 'Corvo', 'Juno', 'Haskel', 'Nim', 'Pell', 'Ondra', 'Brack', 'Wynne', 'Teodor', 'Lark', 'Ysolde'],
  last: ['Okonkwo', 'Halvard', 'Strand', 'Vey', 'Moreau', 'Kastellan', 'Ferro', 'Quill', 'Abernathy', 'Solis', 'Drask', 'Imre', 'Rook', 'Varga', 'Lindqvist', 'Achebe', 'Toller', 'Ash'],
  alias: ['the Accountant', 'Two Coats', 'Lucky', 'the Ghost of Pier 9', 'Bishop', 'Slowhand', 'the Dentist', 'Halfmoon', 'Nobody', 'the Cartographer', 'Sixpence', 'Glass'],
  crime: [
    'Skipped bail on a cargo fraud charge',
    'Ran unlicensed fuel through the Hollow',
    'Forged a dozen transit visas',
    'Walked out on a corporate debt',
    'Stole a mining tug, then another',
    'Wanted for questioning. Repeatedly.',
    'Embezzled from a dockworkers’ union',
    'Sold the same moon twice',
    'Jumped a quarantine cordon',
    'Ran a rigged card game on the ring',
    'Impersonated a customs inspector',
    'Broke a witness out of holding',
  ],
};

/** Crew training upgrades, generated from CREW × CREW_TIERS. */
export const TRAINING = CREW.flatMap((c) =>
  CREW_TIERS.map((t, i) => ({
    id: `${c.id}_t${i + 1}`,
    kind: 'once',
    cost: c.cost * t.costMult,
    name: `${t.label} ${c.name}s`,
    group: 'Training',
    desc: `${c.name} output ×2.`,
    effect: { crewMult: { id: c.id, x: 2 } },
    req: { crew: { id: c.id, n: t.at } },
  })),
);

export const ALL_UPGRADES = [...UPGRADES, ...TRAINING];
