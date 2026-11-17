/* ═══════════════════════════════════════════════════════════
   Realm map renderer — a fractured, enchanted war map
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const { PROVINCES, EDGES, GLYPHS, TERRAIN, REGIONS } = window.GATC_DATA;

  const OWNER_LABEL = { player: 'Imperial', enemy: 'Hollow', neutral: 'Free' };

  // deterministic pseudo random
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const ISLAND = [
    'M 64 420',
    'C 44 356 78 300 128 272',
    'C 158 254 168 224 196 208',
    'C 224 192 234 164 268 160',
    'C 300 156 314 128 350 126',
    'C 382 124 400 96 438 98',
    'C 470 100 486 74 522 78',
    'C 556 82 574 108 610 106',
    'C 650 104 668 82 710 90',
    'C 748 98 756 126 792 136',
    'C 830 146 866 138 894 168',
    'C 922 198 916 230 936 260',
    'C 956 292 944 322 950 356',
    'C 956 390 930 408 936 442',
    'C 944 482 914 504 908 540',
    'C 900 582 866 598 838 618',
    'C 804 642 772 676 728 680',
    'C 690 684 664 660 626 664',
    'C 588 668 566 696 524 694',
    'C 488 692 470 668 432 670',
    'C 398 672 380 698 342 694',
    'C 304 690 292 662 258 654',
    'C 220 646 198 664 168 638',
    'C 136 610 144 576 120 552',
    'C 92 526 84 482 76 456',
    'C 70 440 68 430 64 420 Z',
  ].join(' ');

  /* ── geometry ─────────────────────────────────────────── */
  function clipPolygon(poly, mx, my, nx, ny) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const cur = poly[i];
      const prev = poly[(i + poly.length - 1) % poly.length];
      const dc = (cur.x - mx) * nx + (cur.y - my) * ny;
      const dp = (prev.x - mx) * nx + (prev.y - my) * ny;
      const insideCur = dc <= 0;
      const insidePrev = dp <= 0;
      if (insideCur !== insidePrev) {
        const t = dp / (dp - dc);
        out.push({
          x: prev.x + (cur.x - prev.x) * t,
          y: prev.y + (cur.y - prev.y) * t,
        });
      }
      if (insideCur) out.push(cur);
    }
    return out;
  }

  function voronoiCell(seed, seeds) {
    let poly = [
      { x: 0, y: 0 }, { x: 1000, y: 0 },
      { x: 1000, y: 700 }, { x: 0, y: 700 },
    ];
    for (const other of seeds) {
      if (other === seed) continue;
      const nx = other.x - seed.x;
      const ny = other.y - seed.y;
      if (!nx && !ny) continue;
      poly = clipPolygon(poly, (seed.x + other.x) / 2, (seed.y + other.y) / 2, nx, ny);
      if (poly.length < 3) break;
    }
    return poly;
  }

  function pathOf(poly) {
    if (!poly.length) return '';
    return poly.map((pt, i) => (i === 0 ? 'M' : 'L') + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1)).join(' ') + ' Z';
  }

  /* ── hand-drawn map ornaments ─────────────────────────── */
  function mountain(x, y, s, stroke) {
    return `<path class="mount" d="M ${x - 12 * s} ${y + 7 * s} L ${x} ${y - 11 * s} L ${x + 12 * s} ${y + 7 * s}" fill="rgba(255,255,255,.025)" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>
      <path d="M ${x - 4 * s} ${y - 3 * s} L ${x} ${y - 11 * s} L ${x + 4 * s} ${y - 3 * s}" fill="none" stroke="rgba(255,255,255,.09)" stroke-width=".7"/>`;
  }
  function tree(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".95" fill="rgba(255,255,255,.02)">
      <path d="M ${x} ${y + 8 * s} v ${-6 * s}"/>
      <path d="M ${x - 5 * s} ${y + 3 * s} L ${x} ${y - 8 * s} L ${x + 5 * s} ${y + 3 * s}Z"/>
      <path d="M ${x - 3.6 * s} ${y - 1 * s} L ${x} ${y - 10 * s} L ${x + 3.6 * s} ${y - 1 * s}Z" fill="none"/>
    </g>`;
  }
  function waves(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".95" fill="none" opacity=".85">
      <path d="M ${x - 12 * s} ${y} q ${4 * s} ${-3 * s} ${8 * s} 0 t ${8 * s} 0 t ${8 * s} 0"/>
      <path d="M ${x - 7 * s} ${y + 6 * s} q ${4 * s} ${-3 * s} ${8 * s} 0 t ${8 * s} 0" opacity=".55"/>
    </g>`;
  }
  function grass(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".85" fill="none">
      <path d="M ${x} ${y + 5 * s} q ${-2 * s} ${-4 * s} ${-1 * s} ${-7 * s}"/>
      <path d="M ${x + 2.4 * s} ${y + 5 * s} q ${1 * s} ${-5 * s} ${3.2 * s} ${-8 * s}"/>
      <path d="M ${x - 2.6 * s} ${y + 5 * s} q ${-3 * s} ${-3 * s} ${-4.6 * s} ${-6 * s}"/>
    </g>`;
  }
  function crystal(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".85" fill="rgba(170,220,255,.05)">
      <path d="M ${x} ${y - 10 * s} L ${x + 4 * s} ${y - 2 * s} L ${x} ${y + 6 * s} L ${x - 4 * s} ${y - 2 * s}Z"/>
      <path d="M ${x + 10 * s} ${y - 4 * s} L ${x + 13 * s} ${y + 1 * s} L ${x + 10 * s} ${y + 5 * s} L ${x + 7 * s} ${y + 1 * s}Z"/>
    </g>`;
  }
  function reeds(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".85" fill="none">
      <path d="M ${x} ${y + 6 * s} q ${-1 * s} ${-6 * s} ${-2 * s} ${-12 * s}"/>
      <path d="M ${x + 4 * s} ${y + 6 * s} q ${1 * s} ${-5 * s} ${1 * s} ${-10 * s}"/>
      <ellipse cx="${x - 3 * s}" cy="${y + 4 * s}" rx="${4 * s}" ry="${1.5 * s}" fill="rgba(120,170,150,.06)" stroke="none"/>
    </g>`;
  }
  function obelisk(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".85" fill="rgba(255,255,255,.025)">
      <path d="M ${x - 4 * s} ${y + 6 * s} L ${x} ${y - 10 * s} L ${x + 4 * s} ${y + 6 * s}Z"/>
      <path d="M ${x} ${y - 4 * s} h ${2.4 * s}" fill="none"/>
    </g>`;
  }
  function ruin(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".9" fill="none">
      <path d="M ${x - 8 * s} ${y + 6 * s} v ${-10 * s} M ${x - 11 * s} ${y - 1 * s} h ${6 * s}"/>
      <path d="M ${x + 5 * s} ${y + 6 * s} v ${-6 * s} M ${x + 2 * s} ${y + 2 * s} h ${6 * s}"/>
      <path d="M ${x - 4 * s} ${y + 6 * s} q ${4 * s} ${-8 * s} ${9 * s} 0" stroke-dasharray="1 3"/>
    </g>`;
  }
  function spire(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".85" fill="rgba(255,255,255,.02)">
      <path d="M ${x} ${y + 7 * s} L ${x + 3 * s} ${y - 11 * s} L ${x + 6 * s} ${y + 7 * s}Z"/>
      <path d="M ${x + 3 * s} ${y - 11 * s} l ${3 * s} ${2 * s}" fill="none"/>
    </g>`;
  }
  function sunMark(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".8" fill="none">
      <circle cx="${x}" cy="${y}" r="${4.6 * s}"/>
      <path d="M ${x - 8 * s} ${y} h ${-3 * s} M ${x + 8 * s} ${y} h ${3 * s} M ${x} ${y - 8 * s} v ${-3 * s} M ${x} ${y + 8 * s} v ${3 * s}"/>
      <path d="M ${x - 5 * s} ${y - 5 * s} l ${-2 * s} ${-2 * s} M ${x + 5 * s} ${y - 5 * s} l ${2 * s} ${-2 * s}"/>
    </g>`;
  }
  function blightMark(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width=".85" fill="none">
      <circle cx="${x}" cy="${y}" r="${4.6 * s}"/>
      <path d="M ${x - 7 * s} ${y} h ${14 * s} M ${x} ${y - 7 * s} v ${14 * s}"/>
      <path d="M ${x - 5 * s} ${y + 8 * s} l ${3 * s} ${4 * s} l ${2 * s} ${-3 * s}"/>
    </g>`;
  }

  function terrainMarks(p) {
    const rand = mulberry(hashString(p.id) + 101);
    const count = ['mountains', 'peaks', 'forest', 'thornwood'].includes(p.terrain) ? 4 : 3;
    let out = '';
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rand() * 0.8 - 0.4;
      const dist = 38 + rand() * 30;
      const x = p.x + Math.cos(ang) * dist * 1.15;
      const y = p.y + Math.sin(ang) * dist * 0.72;
      if (x < 22 || x > 978 || y < 22 || y > 678) continue;
      const s = (0.68 + rand() * 0.4) * 1.28;
      switch (p.terrain) {
        case 'mountains': out += mountain(x, y, s + 0.12, 'rgba(196,196,216,.28)'); break;
        case 'peaks': out += mountain(x, y, s + 0.08, 'rgba(178,216,238,.3)'); break;
        case 'forest': out += tree(x, y, s, 'rgba(150,196,156,.3)'); break;
        case 'thornwood': out += tree(x, y, s * 0.92, 'rgba(168,184,120,.28)'); break;
        case 'water': out += waves(x, y, s * 0.9, 'rgba(142,190,224,.28)'); break;
        case 'coast': out += waves(x, y, s * 0.82, 'rgba(150,208,220,.24)'); break;
        case 'plains': out += grass(x, y, s, 'rgba(208,196,140,.24)'); break;
        case 'cinder': out += obelisk(x, y, s * 0.9, 'rgba(222,150,110,.3)'); break;
        case 'ash': out += obelisk(x, y, s, 'rgba(198,140,124,.28)'); break;
        case 'mire': out += reeds(x, y, s, 'rgba(136,176,154,.3)'); break;
        case 'tundra': out += crystal(x, y, s, 'rgba(168,216,240,.32)'); break;
        case 'ruins': out += ruin(x, y, s, 'rgba(198,182,148,.28)'); break;
        case 'blight': out += blightMark(x, y, s, 'rgba(198,130,224,.34)'); break;
        case 'spires': out += spire(x, y, s, 'rgba(190,168,224,.3)'); break;
        case 'sanctum': out += sunMark(x, y, s * 0.9, 'rgba(244,216,148,.34)'); break;
        default: out += grass(x, y, s, 'rgba(208,196,140,.22)');
      }
    }
    return out;
  }

  function regionWards() {
    let out = '';
    for (const [a, b] of EDGES) {
      const pa = PROVINCES[a];
      const pb = PROVINCES[b];
      if (pa.region === pb.region) continue;
      const region = REGIONS[pa.region];
      const color = region ? region.color : 'rgba(232,199,122,.4)';
      const mx = (pa.x + pb.x) / 2;
      const my = (pa.y + pb.y) / 2;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const len = Math.hypot(dx, dy) || 1;
      const px = -dy / len;
      const py = dx / len;
      const half = 15;
      out += `<g class="region-ward">
        <path d="M ${(mx - px * half).toFixed(1)} ${(my - py * half).toFixed(1)} Q ${mx.toFixed(1)} ${(my + 4).toFixed(1)} ${(mx + px * half).toFixed(1)} ${(my + py * half).toFixed(1)}" stroke="${color}"/>
        <circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="2" fill="${color}"/>
      </g>`;
    }
    return out;
  }

  const REGION_LABELS = [
    { region: 'Dawnlands', x: 296, y: 414, rotate: -9 },
    { region: 'Verdant Reach', x: 430, y: 660, rotate: -2 },
    { region: 'Ashen Waste', x: 800, y: 646, rotate: 4 },
    { region: 'Frostspine', x: 786, y: 250, rotate: -7 },
  ];

  function regionMarks() {
    return REGION_LABELS.map(l => {
      const region = REGIONS[l.region];
      const color = region ? region.label : '#e8c77a';
      const name = l.region.toUpperCase();
      return `<g class="region-mark" transform="rotate(${l.rotate} ${l.x} ${l.y})">
        <path d="M ${l.x - 44} ${l.y + 8} h 88" stroke="${color}" opacity=".3"/>
        <text x="${l.x}" y="${l.y}" fill="${color}" opacity=".42">${name}</text>
      </g>`;
    }).join('');
  }

  function floatingIsle(x, y, s, flip = 1) {
    return `<g transform="translate(${x} ${y})">
      <g class="floating-isle">
        <g transform="scale(${s * flip} ${s})">
          <path d="M -24 -2 L -10 -12 L 12 -9 L 30 0 L 13 8 L -7 11 L -22 5 Z" fill="url(#landGrad)" stroke="rgba(232,199,122,.2)" stroke-width="1"/>
          <path d="M -14 4 L -2 18 L 8 9 L 0 0 Z" fill="rgba(4,6,12,.55)" stroke="rgba(232,199,122,.08)" stroke-width=".8"/>
          <path d="M -2 -8 v -20 M 3 -4 v -14" stroke="rgba(142,190,224,.22)" stroke-width=".9"/>
          <circle cx="-2" cy="-30" r="3" fill="rgba(160,210,240,.4)"/>
          <circle cx="-2" cy="-30" r="8" fill="none" stroke="rgba(160,210,240,.14)"/>
          <circle cx="21" cy="2" r="1.4" fill="rgba(232,199,122,.45)"/>
        </g>
      </g>
    </g>`;
  }

  class MapView {
    constructor({ svg, nodes, tokens, stage, onSelect, onHover, onLeave }) {
      this.svg = svg;
      this.nodesEl = nodes;
      this.tokensEl = tokens;
      this.stage = stage;
      this.onSelect = onSelect;
      this.onHover = onHover;
      this.onLeave = onLeave;
      this.nodeEls = new Map();
      this.cellEls = new Map();
      this.tintEls = new Map();
      this.roadEls = [];
      this.tokens = {};
      this._build();
    }

    _build() {
      const seeds = PROVINCES_LIST();
      const rand = mulberry(9182);
      let stars = '';
      for (let i = 0; i < 132; i++) {
        const x = (rand() * 1000).toFixed(1);
        const y = (rand() * 700).toFixed(1);
        const r = (rand() * 1.2 + 0.2).toFixed(2);
        const o = (rand() * 0.5 + 0.1).toFixed(2);
        stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#f7ebcf" opacity="${o}"/>`;
      }
      for (let i = 0; i < 10; i++) {
        const x = (rand() * 1000).toFixed(1);
        const y = (rand() * 700).toFixed(1);
        stars += `<circle cx="${x}" cy="${y}" r="${(1.6 + rand() * 2.2).toFixed(2)}" fill="rgba(180,214,255,.08)" stroke="rgba(200,226,255,.18)" stroke-width=".5"/>`;
      }

      // runes around the celestial rings
      let runes = '';
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const r1 = 336, r2 = i % 3 === 0 ? 348 : 343;
        const x1 = 512 + Math.cos(a) * r1;
        const y1 = 358 + Math.sin(a) * r1;
        const x2 = 512 + Math.cos(a) * r2;
        const y2 = 358 + Math.sin(a) * r2;
        runes += `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
      }

      // province territories (Voronoi clipped to the isle)
      let cells = '';
      let tints = '';
      for (const p of seeds) {
        const d = pathOf(voronoiCell(p, seeds));
        if (!d) continue;
        const terrain = TERRAIN[p.terrain] || TERRAIN.plains;
        cells += `<path class="province-cell${p.capital ? ' is-capital' : ''}" data-id="${p.id}" d="${d}" fill="${terrain.fill}" stroke="${terrain.border}"/>`;
        tints += `<path class="province-tint" data-id="${p.id}" d="${d}"/>`;
      }

      let decor = '';
      for (const p of seeds) decor += terrainMarks(p);

      // larger background features
      decor += mountain(342, 184, 1.15, 'rgba(190,180,158,.18)') + mountain(424, 170, 0.9, 'rgba(190,180,158,.14)');
      decor += mountain(786, 292, 1.05, 'rgba(190,180,158,.16)') + mountain(864, 264, 0.8, 'rgba(190,180,158,.13)');
      decor += tree(202, 392, 1.1, 'rgba(170,196,170,.16)') + tree(302, 398, 0.8, 'rgba(170,196,170,.13)');
      decor += waves(318, 520, 1.1, 'rgba(150,190,220,.16)') + waves(414, 438, 0.8, 'rgba(150,190,220,.13)');
      // a great river of pale light
      decor += `<path d="M 414 250 C 448 310 340 366 362 458 C 380 530 438 588 470 630" fill="none" stroke="rgba(130,170,220,.16)" stroke-width="2.6"/>
        <path d="M 414 250 C 448 310 340 366 362 458 C 380 530 438 588 470 630" fill="none" stroke="rgba(200,226,255,.08)" stroke-width="7"/>`;

      // sanctum altar
      decor += `<g class="landmark" transform="translate(138 472)" stroke="rgba(242,212,140,.24)" fill="none">
        <circle r="48" stroke-dasharray="1 6"/><circle r="60" opacity=".5"/>
        <path d="M -70 0 h 14 M 56 0 h 14 M 0 -70 v 14 M 0 56 v 14" stroke-width="1"/>
        <path d="M -34 -34 l 8 8 M 26 26 l 8 8 M 34 -34 l -8 8 M -26 26 l -8 8" opacity=".7"/>
      </g>`;
      // dawn gate arch
      decor += `<g class="landmark" transform="translate(508 354)" stroke="rgba(232,199,122,.22)" fill="none">
        <path d="M -18 -34 v 18 M 18 -34 v 18 M -18 -34 q 18 -14 36 0"/>
        <path d="M -28 0 h 8 M 20 0 h 8" opacity=".6"/>
      </g>`;
      // sunspire needle
      decor += `<g class="landmark" transform="translate(648 222)" stroke="rgba(220,206,178,.25)" fill="rgba(232,199,122,.035)">
        <path d="M 0 44 L 7 -42 L 14 44 Z"/><path d="M 7 -42 l 12 9" fill="none"/>
        <path d="M -14 44 h 42" stroke-width="1.2"/>
      </g>`;
      // frost crown
      decor += `<g class="landmark" transform="translate(830 320)" stroke="rgba(160,210,240,.25)" fill="rgba(160,210,240,.04)">
        <path d="M -26 40 L -18 -8 L -6 18 L 4 -22 L 14 14 L 26 -4 L 30 40 Z"/>
      </g>`;
      // the citadel's broken crown
      decor += `<g class="landmark" transform="translate(884 520)" stroke="rgba(196,123,224,.35)" fill="rgba(196,123,224,.05)" stroke-width="1">
        <path d="M -34 38 L -22 -20 L -10 38Z"/><path d="M -6 38 L 8 -46 L 22 38Z"/><path d="M 26 38 L 36 -10 L 46 38Z"/>
        <path d="M -48 38 h 102" stroke-width="1.3"/>
        <circle cx="8" cy="-46" r="4" fill="none"/>
      </g>`;
      decor += `<path class="blight-rift" d="M 812 570 C 838 548 862 556 886 534 C 900 520 904 500 922 490" fill="none"/>`;
      // drowned harbour
      decor += `<g class="landmark" transform="translate(888 158)" stroke="rgba(140,190,220,.28)" fill="none">
        <path d="M -40 26 q 40 14 80 0" stroke-dasharray="2 5"/>
        <path d="M -22 20 v -18 M -22 2 l 12 8 M 24 22 v -22 M 24 0 l -12 9"/>
      </g>`;
      // bones of the ashen fields
      decor += `<g class="landmark" transform="translate(700 444)" stroke="rgba(198,160,140,.18)" fill="none">
        <path d="M -42 34 q 18 -18 34 0 M 22 34 q 16 -16 30 0"/>
        <path d="M -18 28 q 6 -14 18 0" stroke-dasharray="1 4"/>
      </g>`;

      let wards = regionWards();

      // ley roads
      let roads = '';
      EDGES.forEach(([a, b], i) => {
        const p1 = PROVINCES[a], p2 = PROVINCES[b];
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy) || 1;
        const bend = [-16, 12, -9, 18, -13, 8][i % 6];
        const cx = mx + (-dy / len) * bend;
        const cy = my + (dx / len) * bend;
        roads += `<path class="road" data-a="${a}" data-b="${b}" d="M ${p1.x} ${p1.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x} ${p2.y}"/>`;
      });

      const isles = [
        floatingIsle(74, 606, 0.82),
        floatingIsle(932, 242, 0.62, -1),
        floatingIsle(94, 208, 0.52),
        floatingIsle(944, 648, 0.48, -1),
      ].join('');

      this.svg.innerHTML = `
        <defs>
          <radialGradient id="seaGlow" cx="50%" cy="46%" r="64%">
            <stop offset="0%" stop-color="#1a2340"/>
            <stop offset="48%" stop-color="#0d1426"/>
            <stop offset="100%" stop-color="#060912"/>
          </radialGradient>
          <linearGradient id="landGrad" x1="18%" y1="0%" x2="82%" y2="100%">
            <stop offset="0%" stop-color="#1d2538"/>
            <stop offset="44%" stop-color="#141b2b"/>
            <stop offset="100%" stop-color="#0b101c"/>
          </linearGradient>
          <radialGradient id="landLight" cx="42%" cy="34%" r="58%">
            <stop offset="0%" stop-color="rgba(232,199,122,.12)"/>
            <stop offset="62%" stop-color="rgba(232,199,122,.02)"/>
            <stop offset="100%" stop-color="rgba(232,199,122,0)"/>
          </radialGradient>
          <radialGradient id="blightGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(196,123,224,.35)"/>
            <stop offset="100%" stop-color="rgba(196,123,224,0)"/>
          </radialGradient>
          <filter id="nodeBlur"><feGaussianBlur stdDeviation="4"/></filter>
          <clipPath id="landClip"><path d="${ISLAND}"/></clipPath>
        </defs>

        <rect width="1000" height="700" fill="url(#seaGlow)"/>
        <g class="map-stars">${stars}</g>

        <g class="aurora">
          <path d="M 20 170 C 180 100 290 196 460 128 S 740 60 1030 120" fill="none" stroke="rgba(160,226,214,.14)" stroke-width="3" stroke-dasharray="1 9"/>
          <path d="M 60 202 C 220 138 340 220 520 156 S 800 100 1030 156" fill="none" stroke="rgba(170,186,240,.1)" stroke-width="2" stroke-dasharray="1 12"/>
        </g>

        <g class="sea-rings">
          <circle cx="512" cy="358" r="330"/><circle cx="512" cy="358" r="420"/>
          <circle cx="512" cy="358" r="506"/>
        </g>
        <g class="sea-runes">${runes}</g>
        <g class="sea-grid">
          <path d="M0 175 H1000 M0 350 H1000 M0 525 H1000 M250 0 V700 M500 0 V700 M750 0 V700" stroke-dasharray="1 12"/>
        </g>
        <g class="sea-currents">
          <path d="M 34 604 C 160 574 240 616 372 588 S 560 566 640 598"/>
          <path d="M 350 684 C 470 656 560 686 690 660 S 860 642 972 674"/>
          <path d="M 24 312 C 96 286 140 316 210 300"/>
        </g>

        ${isles}

        <circle cx="884" cy="520" r="150" fill="url(#blightGlow)" opacity=".55"/>
        <path class="land-shadow" d="${ISLAND}" transform="translate(8,11) scale(.984)"/>
        <path class="land-coast" d="${ISLAND}"/>
        <path class="land-shape" d="${ISLAND}"/>

        <g clip-path="url(#landClip)">
          <g class="territories">${cells}</g>
          <g class="territory-tints">${tints}</g>
          <path d="${ISLAND}" fill="url(#landLight)" pointer-events="none"/>
          <g class="terrain-decor">${decor}</g>
          <g class="region-wards">${wards}</g>
          <g class="roads">${roads}</g>
        </g>

        <path class="land-edge" d="${ISLAND}"/>

        <g class="region-marks">${regionMarks()}</g>

        <g class="map-compass" transform="translate(930,96)">
          <circle r="31" stroke="rgba(232,199,122,.17)" fill="none"/>
          <circle r="24" stroke="rgba(232,199,122,.1)" fill="none"/>
          <path d="M 0 -30 L 5 -6 L 0 0 L -5 -6Z" fill="rgba(232,199,122,.4)" stroke="none"/>
          <path d="M 0 30 L 5 6 L 0 0 L -5 6Z" fill="rgba(232,199,122,.16)" stroke="none"/>
          <path d="M -30 0 L -6 5 L 0 0 L -6 -5Z" fill="rgba(232,199,122,.16)" stroke="none"/>
          <path d="M 30 0 L 6 5 L 0 0 L 6 -5Z" fill="rgba(232,199,122,.22)" stroke="none"/>
          <text x="0" y="-35" text-anchor="middle" font-family="Cinzel, serif" font-size="8" letter-spacing="2" fill="rgba(232,199,122,.4)">N</text>
        </g>
        <text x="88" y="236" class="map-label-deco" transform="rotate(-90 88 236)" letter-spacing="3.2">THE SUNLESS SEA</text>
        <text x="500" y="670" text-anchor="middle" font-family="Cinzel, serif" font-size="21" letter-spacing="11" fill="rgba(232,199,122,.08)">AETHERMOOR</text>
      `;

      this.roadEls = Array.from(this.svg.querySelectorAll('.road'));
      this.cellEls = new Map();
      this.tintEls = new Map();
      this.svg.querySelectorAll('.province-cell').forEach(el => this.cellEls.set(el.dataset.id, el));
      this.svg.querySelectorAll('.province-tint').forEach(el => this.tintEls.set(el.dataset.id, el));

      // build HTML provinces
      PROVINCES_LIST().forEach(p => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'prov is-neutral';
        btn.dataset.id = p.id;
        btn.style.left = (p.x / 10) + '%';
        btn.style.top = (p.y / 7) + '%';
        btn.setAttribute('aria-label', p.name);
        btn.innerHTML = `
          <span class="prov__halo" aria-hidden="true"></span>
          <span class="prov__pulse" aria-hidden="true"></span>
          <span class="prov__ring" aria-hidden="true"><span class="prov__glyph">${GLYPHS[p.type] || '✦'}</span></span>
          <span class="prov__badge" aria-hidden="true">0</span>
          <span class="prov__label">${p.name}</span>
          ${p.capital ? '<span class="prov__crown" aria-hidden="true"><svg><use href="#i-crown"/></svg></span>' : ''}
        `;
        btn.addEventListener('click', () => this.onSelect(p.id));
        btn.addEventListener('mouseenter', e => this.onHover && this.onHover(p.id, e));
        btn.addEventListener('mousemove', e => this.onHover && this.onHover(p.id, e));
        btn.addEventListener('mouseleave', () => this.onLeave && this.onLeave());
        btn.addEventListener('focus', e => this.onHover && this.onHover(p.id, e));
        btn.addEventListener('blur', () => this.onLeave && this.onLeave());
        this.nodesEl.appendChild(btn);
        this.nodeEls.set(p.id, btn);
      });

      // host tokens
      this.tokens.player = this._makeToken('player', '✦');
      this.tokens.enemy = this._makeToken('enemy', '◈');
    }

    _makeToken(side, glyph) {
      const el = document.createElement('div');
      el.className = 'token token--' + side;
      el.dataset.side = side;
      el.innerHTML = `
        <span class="token__halo" aria-hidden="true"></span>
        <span class="token__ring" aria-hidden="true"></span>
        <span class="token__disc" aria-hidden="true">${glyph}</span>
        <span class="token__count">0</span>
      `;
      this.tokensEl.appendChild(el);
      return el;
    }

    update(state, view = {}) {
      const playerPos = state.playerPos;
      const selected = view.selected || null;
      const targetable = view.targetable || new Set();

      PROVINCES_LIST().forEach(p => {
        const el = this.nodeEls.get(p.id);
        if (!el) return;
        const owner = state.owners[p.id] || 'neutral';
        const garrison = state.garrisons[p.id] ?? 0;
        const adjacent = p.id !== playerPos && p.neighbors.includes(playerPos);
        const isTarget = targetable.has(p.id);

        el.classList.remove('is-player', 'is-enemy', 'is-neutral', 'is-selected', 'is-adjacent', 'is-targetable', 'is-host-hidden');
        el.classList.add('is-' + owner);
        el.classList.toggle('is-selected', selected === p.id);
        el.classList.toggle('is-adjacent', adjacent);
        el.classList.toggle('is-targetable', isTarget);
        el.classList.toggle('is-host-hidden', state.playerPos === p.id || state.enemyPos === p.id);
        const badge = el.querySelector('.prov__badge');
        if (badge) badge.textContent = garrison;
        const terrain = TERRAIN[p.terrain];
        el.setAttribute('aria-label', `${p.name}, ${terrain ? terrain.name : 'unknown terrain'}, ${OWNER_LABEL[owner]}, garrison ${garrison}${state.playerPos === p.id ? ', your host is here' : ''}`);
        el.setAttribute('aria-pressed', selected === p.id ? 'true' : 'false');
        el.classList.toggle('is-capital', Boolean(p.capital));

        const tint = this.tintEls.get(p.id);
        if (tint) {
          tint.classList.remove('is-player', 'is-enemy', 'is-neutral', 'is-selected', 'is-adjacent', 'is-targetable');
          tint.classList.add('is-' + owner);
          tint.classList.toggle('is-selected', selected === p.id);
          tint.classList.toggle('is-adjacent', adjacent);
          tint.classList.toggle('is-targetable', isTarget);
        }
      });

      for (const road of this.roadEls) {
        road.classList.toggle('is-adjacent', road.dataset.a === playerPos || road.dataset.b === playerPos);
      }

      this._placeToken('player', state.playerPos, state.host);
      this._placeToken('enemy', state.enemyPos, getEnemyHost(state));
      this.stage.classList.toggle('is-targeting', Boolean(view.targeting));
    }

    _placeToken(side, provinceId, count) {
      const p = PROVINCES[provinceId];
      const el = this.tokens[side];
      if (!p || !el) return;
      el.style.left = (p.x / 10) + '%';
      el.style.top = (p.y / 7) + '%';
      const badge = el.querySelector('.token__count');
      if (badge) badge.textContent = count;
      el.classList.toggle('is-hidden', !provinceId);
    }

    flashProvince(id, kind = 'capture') {
      const el = this.nodeEls.get(id);
      const cell = this.cellEls.get(id);
      const cls = kind === 'smite' ? 'is-smited' : 'is-capture';
      for (const target of [el, cell]) {
        if (!target) continue;
        target.classList.remove(cls);
        void target.offsetWidth;
        target.classList.add(cls);
        setTimeout(() => target.classList.remove(cls), 1100);
      }
    }

    shake() {
      if (!this.stage) return;
      this.stage.classList.remove('is-shaking');
      void this.stage.offsetWidth;
      this.stage.classList.add('is-shaking');
      setTimeout(() => this.stage.classList.remove('is-shaking'), 500);
    }

    glow() {
      if (!this.stage) return;
      this.stage.classList.remove('is-breakthrough');
      void this.stage.offsetWidth;
      this.stage.classList.add('is-breakthrough');
      setTimeout(() => this.stage.classList.remove('is-breakthrough'), 1200);
    }
  }

  function PROVINCES_LIST() {
    return Object.values(PROVINCES);
  }
  function getEnemyHost(state) {
    return state.enemyHost != null ? state.enemyHost : (state.enemyHost = 9);
  }

  window.GATC_MAP = { MapView };
})();
