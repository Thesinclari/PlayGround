/* ═══════════════════════════════════════════════════════════
   The realm of Aethermoor — static world data
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const PROVINCES = {
    sanctum: {
      id: 'sanctum', name: 'Sanctum of Dawn', short: 'Sanctum',
      x: 138, y: 472, type: 'sun', terrain: 'sanctum', region: 'Dawnlands',
      income: 5, fort: 1.2, capital: 'player',
      flavor: 'The last altar of the old sun, still warm beneath the ash.',
    },
    silverwood: {
      id: 'silverwood', name: 'Silverwood', short: 'Silverwood',
      x: 238, y: 326, type: 'tree', terrain: 'forest', region: 'Dawnlands',
      income: 3, fort: 1.05,
      flavor: 'White-barked trees hold the prayers of those who fled the dark.',
    },
    emberfall: {
      id: 'emberfall', name: 'Emberfall', short: 'Emberfall',
      x: 226, y: 566, type: 'flame', terrain: 'cinder', region: 'Dawnlands',
      income: 2, fort: 1.05,
      flavor: 'A river of cinders runs uphill, defying the ruined world.',
    },
    lake: {
      id: 'lake', name: 'Lake Lumen', short: 'Lake Lumen',
      x: 364, y: 466, type: 'wave', terrain: 'water', region: 'Dawnlands',
      income: 3, fort: 1.0,
      flavor: 'Its waters still remember the reflection of a younger sun.',
    },
    highreach: {
      id: 'highreach', name: 'Highreach', short: 'Highreach',
      x: 396, y: 228, type: 'mountain', terrain: 'mountains', region: 'Dawnlands',
      income: 3, fort: 1.25,
      flavor: 'Wind-scoured peaks where the first oath was carved in stone.',
    },
    gate: {
      id: 'gate', name: 'Dawn Gate', short: 'Dawn Gate',
      x: 508, y: 354, type: 'gate', terrain: 'ruins', region: 'Dawnlands',
      income: 3, fort: 1.3,
      flavor: 'The old border of the light. Its hinges have not stopped weeping.',
    },
    thornvale: {
      id: 'thornvale', name: 'Thornvale', short: 'Thornvale',
      x: 542, y: 536, type: 'tree', terrain: 'thornwood', region: 'Verdant Reach',
      income: 2, fort: 1.05,
      flavor: 'Briars drink from a battlefield no one dares to plough.',
    },
    sunspire: {
      id: 'sunspire', name: 'Sunspire', short: 'Sunspire',
      x: 648, y: 222, type: 'tower', terrain: 'spires', region: 'Verdant Reach',
      income: 4, fort: 1.2,
      flavor: 'A needle of white stone that once caught the dawn before anyone else.',
    },
    ashen: {
      id: 'ashen', name: 'Ashen Fields', short: 'Ashen Fields',
      x: 700, y: 444, type: 'flame', terrain: 'ash', region: 'Ashen Waste',
      income: 3, fort: 1.0,
      flavor: 'Nothing grows here, but the Hollow King\'s banners do.',
    },
    frosthold: {
      id: 'frosthold', name: 'Frosthold', short: 'Frosthold',
      x: 830, y: 320, type: 'mountain', terrain: 'tundra', region: 'Frostspine',
      income: 3, fort: 1.25,
      flavor: 'A garrison of frozen dead who never received the order to stand down.',
    },
    shadow: {
      id: 'shadow', name: 'Shadow Citadel', short: 'Citadel',
      x: 884, y: 520, type: 'eye', terrain: 'blight', region: 'Ashen Waste',
      income: 6, fort: 1.55, capital: 'enemy',
      flavor: 'The seal beneath the world. Something inside it is smiling.',
    },
    harbor: {
      id: 'harbor', name: 'Dusk Harbor', short: 'Dusk Harbor',
      x: 888, y: 158, type: 'wave', terrain: 'coast', region: 'Frostspine',
      income: 3, fort: 1.05,
      flavor: 'Black ships arrive on a tide that never touches the shore.',
    },
    hollow: {
      id: 'hollow', name: 'Hollowmere', short: 'Hollowmere',
      x: 722, y: 612, type: 'moon', terrain: 'mire', region: 'Ashen Waste',
      income: 2, fort: 1.0,
      flavor: 'A drowned marsh where the moon is reflected even at noon.',
    },
    verdant: {
      id: 'verdant', name: 'Verdant Cross', short: 'Verdant Cross',
      x: 462, y: 600, type: 'tree', terrain: 'plains', region: 'Verdant Reach',
      income: 2, fort: 1.05,
      flavor: 'Four roads meet beneath a tree that refuses to die.',
    },
    greywind: {
      id: 'greywind', name: 'Greywind', short: 'Greywind',
      x: 574, y: 112, type: 'mountain', terrain: 'peaks', region: 'Frostspine',
      income: 2, fort: 1.15,
      flavor: 'The wind carries old names here. None of them are kind.',
    },
  };

  const EDGES = [
    ['sanctum', 'silverwood'], ['sanctum', 'emberfall'],
    ['silverwood', 'highreach'], ['silverwood', 'lake'],
    ['emberfall', 'lake'], ['emberfall', 'verdant'],
    ['lake', 'gate'], ['lake', 'thornvale'],
    ['highreach', 'gate'], ['highreach', 'greywind'],
    ['gate', 'thornvale'], ['gate', 'sunspire'],
    ['thornvale', 'verdant'], ['thornvale', 'ashen'],
    ['sunspire', 'greywind'], ['sunspire', 'ashen'], ['sunspire', 'harbor'],
    ['ashen', 'frosthold'], ['ashen', 'hollow'], ['ashen', 'shadow'],
    ['frosthold', 'harbor'], ['frosthold', 'shadow'],
    ['harbor', 'shadow'], ['hollow', 'shadow'],
  ];

  // auto-build neighbour lists (undirected)
  for (const p of Object.values(PROVINCES)) p.neighbors = [];
  for (const [a, b] of EDGES) {
    PROVINCES[a].neighbors.push(b);
    PROVINCES[b].neighbors.push(a);
  }

  const INITIAL = {
    owners: {
      sanctum: 'player', silverwood: 'player',
      ashen: 'enemy', frosthold: 'enemy', harbor: 'enemy', shadow: 'enemy',
      emberfall: 'neutral', lake: 'neutral', highreach: 'neutral', gate: 'neutral',
      thornvale: 'neutral', sunspire: 'neutral', hollow: 'neutral', verdant: 'neutral', greywind: 'neutral',
    },
    garrisons: {
      sanctum: 5, silverwood: 3,
      ashen: 5, frosthold: 4, harbor: 4, shadow: 9,
      emberfall: 3, lake: 3, highreach: 4, gate: 3, thornvale: 3,
      sunspire: 4, hollow: 2, verdant: 2, greywind: 2,
    },
  };

  const TERRAIN = {
    sanctum:   { name: 'Sacred Ground',  fill: '#2b2416', border: 'rgba(242,212,140,.55)', swatch: '#e8c77a' },
    plains:    { name: 'Golden Plains',  fill: '#242117', border: 'rgba(216,196,130,.36)', swatch: '#c9b57a' },
    forest:    { name: 'Silverwood',     fill: '#15261d', border: 'rgba(132,184,146,.4)',  swatch: '#7fb08d' },
    thornwood: { name: 'Thornwood',      fill: '#1c2117', border: 'rgba(160,168,110,.36)', swatch: '#9aa36a' },
    mountains: { name: 'Highlands',      fill: '#20222d', border: 'rgba(186,190,210,.38)', swatch: '#a9aec4' },
    peaks:     { name: 'Frost Peaks',    fill: '#1a2431', border: 'rgba(170,210,236,.42)', swatch: '#9ecbe6' },
    water:     { name: 'Inland Sea',     fill: '#0d2133', border: 'rgba(120,176,214,.44)', swatch: '#6aa8cf' },
    coast:     { name: 'Dusk Coast',     fill: '#122330', border: 'rgba(126,188,206,.4)',  swatch: '#7cbccc' },
    cinder:    { name: 'Cinder Fen',     fill: '#2b1d16', border: 'rgba(220,140,92,.4)',   swatch: '#cf8e5c' },
    ash:       { name: 'Ashen Waste',    fill: '#2a1b18', border: 'rgba(206,126,104,.42)', swatch: '#c07a68' },
    mire:      { name: 'Hollow Mire',    fill: '#172320', border: 'rgba(122,166,146,.38)', swatch: '#78a392' },
    tundra:    { name: 'Frostfields',    fill: '#1a2733', border: 'rgba(158,200,228,.4)',  swatch: '#8fbdd6' },
    ruins:     { name: 'Ruined March',   fill: '#26201a', border: 'rgba(196,176,138,.38)', swatch: '#b3a07b' },
    blight:    { name: 'Blight',         fill: '#241329', border: 'rgba(196,123,224,.52)',  swatch: '#c47be0' },
    spires:    { name: 'Spirelands',     fill: '#231f2b', border: 'rgba(186,164,220,.4)',  swatch: '#b7a3d6' },
  };

  const REGIONS = {
    Dawnlands:     { name: 'Dawnlands',     color: 'rgba(232,199,122,.55)',  label: '#e8c77a' },
    'Verdant Reach': { name: 'Verdant Reach', color: 'rgba(132,190,150,.5)',   label: '#88c29a' },
    'Ashen Waste': { name: 'Ashen Waste',   color: 'rgba(208,124,110,.52)',  label: '#cf8b7b' },
    Frostspine:    { name: 'Frostspine',    color: 'rgba(142,194,226,.5)',   label: '#9bc7df' },
  };

  const POWERS = {
    smite: {
      id: 'smite', name: 'Smite', cost: 14, target: 'hostile',
      desc: 'Call a spear of dawn down upon any hostile province, slaying 3 defenders.',
    },
    bless: {
      id: 'bless', name: 'Bless', cost: 10, target: 'self',
      desc: 'Anoint your host. Your next battle is fought with 35% more power.',
    },
    mend: {
      id: 'mend', name: 'Mend', cost: 12, target: 'self',
      desc: 'Knit the wounds of your faithful and restore 4 warriors to the host.',
    },
    convert: {
      id: 'convert', name: 'Convert', cost: 24, target: 'neutral',
      desc: 'Whisper the old oath to a free province beside your realm. It joins the Dawn.',
    },
  };

  const GLYPHS = {
    sun: '✦', tree: '❧', flame: '♨', wave: '≈', mountain: '▲',
    gate: '⌂', tower: '♜', eye: '◈', moon: '☾',
  };

  const DIFFICULTIES = {
    easy: {
      id: 'easy', name: 'Easy', title: 'Steward',
      faith: 36, host: 9, enemyStart: 6, enemyBonus: 0, growthBase: 0, aggressionTurn: 6, enemyInt: 68,
      blurb: 'A gentler dawn. The Hollow host grows slowly and hesitates to strike.',
    },
    normal: {
      id: 'normal', name: 'Normal', title: 'Sovereign',
      faith: 30, host: 8, enemyStart: 8, enemyBonus: 0, growthBase: 1, aggressionTurn: 4, enemyInt: 84,
      blurb: 'The intended fate. A fair war between the Imperial Kingdom and the Hollow King.',
    },
    hard: {
      id: 'hard', name: 'Hard', title: 'Iron Crown',
      faith: 26, host: 7, enemyStart: 10, enemyBonus: 2, growthBase: 2, aggressionTurn: 3, enemyInt: 92,
      blurb: 'A cruel sky. The Hollow host swells swiftly and hunts the Sanctum without mercy.',
    },
  };

  const CHARACTERS = {
    lux: {
      id: 'lux',
      name: 'Lux Osborn',
      epithet: 'The Young King of Imperial',
      kingdom: 'Imperial',
      affinity: 'Neutral',
      portrait: 'assets/lux-osborn.jpg',
      stats: {
        leadership: 92,
        war: 82,
        intelligence: 95,
        politics: 93,
        charisma: 86,
        ambition: 88,
      },
      skill: {
        name: 'Insight',
        desc: "Lux reads the shape of a scheme before it lands. Enemy Tactics or Magic are cancelled when his Intelligence is higher than the enemy commander's.",
      },
      personality: ['Strict', 'Disciplined', 'Competitive'],
      succession: 'Inherited from his father',
      lore: [
        'Lux Osborn is the young king of the Imperial Kingdom, inheriting the throne from his father.',
        'From an early age, Lux was raised under an exceptionally strict education. His father believed that a future ruler must prove his capabilities rather than rely solely on royal blood.',
        'To determine which of his children was most worthy of succession, his father arranged numerous competitions between Lux and his brothers and sisters. These contests tested their abilities, discipline, intelligence, and determination.',
        'Lux emerged victorious in every competition, ultimately proving himself as the strongest candidate for the throne.',
        'His upbringing shaped him into a strict and disciplined ruler who demands excellence from himself and those under his command.',
        'As king, Lux maintains an uncompromising approach to law and order. He believes that authority must be respected and that responsibility comes before privilege.',
        'Although his methods are often considered severe, Lux does not rule through cruelty. He simply refuses to accept incompetence from those entrusted with great responsibility.',
        'To him, the throne is not a privilege inherited by birth, but a responsibility that must be earned.',
      ],
    },
  };

  const STAT_LABELS = {
    leadership: 'Leadership',
    war: 'War',
    intelligence: 'Intelligence',
    politics: 'Politics',
    charisma: 'Charisma',
    ambition: 'Ambition',
  };

  window.GATC_DATA = { PROVINCES, EDGES, INITIAL, POWERS, GLYPHS, DIFFICULTIES, CHARACTERS, STAT_LABELS, TERRAIN, REGIONS };
})();
