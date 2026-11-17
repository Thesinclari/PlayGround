/* ═══════════════════════════════════════════════════════════
   Realm map renderer
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const { PROVINCES, EDGES, GLYPHS } = window.GATC_DATA;

  const OWNER_LABEL = { player: 'Imperial', enemy: 'Hollow', neutral: 'Free' };

  // deterministic pseudo random for stars
  function mulberry(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mountain(x, y, s, stroke) {
    return `<path class="mount" d="M ${x - 12 * s} ${y + 7 * s} L ${x} ${y - 11 * s} L ${x + 12 * s} ${y + 7 * s}" fill="rgba(255,255,255,.025)" stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M ${x - 4 * s} ${y - 3 * s} L ${x} ${y - 11 * s} L ${x + 4 * s} ${y - 3 * s}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width=".8"/>`;
  }
  function tree(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width="1" fill="rgba(255,255,255,.025)">
      <path d="M ${x} ${y + 8 * s} v ${-6 * s}"/>
      <path d="M ${x - 5 * s} ${y + 3 * s} L ${x} ${y - 8 * s} L ${x + 5 * s} ${y + 3 * s}Z"/>
      <path d="M ${x - 3.6 * s} ${y - 1 * s} L ${x} ${y - 10 * s} L ${x + 3.6 * s} ${y - 1 * s}Z" fill="none"/>
    </g>`;
  }
  function waves(x, y, s, stroke) {
    return `<g stroke="${stroke}" stroke-width="1" fill="none" opacity=".8">
      <path d="M ${x - 12 * s} ${y} q ${4 * s} ${-3 * s} ${8 * s} 0 t ${8 * s} 0 t ${8 * s} 0"/>
      <path d="M ${x - 7 * s} ${y + 6 * s} q ${4 * s} ${-3 * s} ${8 * s} 0 t ${8 * s} 0" opacity=".6"/>
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
      this.roadEls = [];
      this.tokens = {};
      this._build();
    }

    _build() {
      const rand = mulberry(9182);
      let stars = '';
      for (let i = 0; i < 96; i++) {
        const x = (rand() * 1000).toFixed(1);
        const y = (rand() * 700).toFixed(1);
        const r = (rand() * 1.1 + 0.2).toFixed(2);
        const o = (rand() * 0.5 + 0.12).toFixed(2);
        stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#f7ebcf" opacity="${o}"/>`;
      }

      const island = 'M 62,424 C 42,360 72,300 132,270 C 172,240 192,200 244,184 C 304,164 332,120 404,115 C 470,110 500,70 572,72 C 642,74 672,100 742,95 C 812,90 862,120 902,165 C 937,210 952,270 932,330 C 917,385 952,440 926,500 C 901,565 852,600 802,620 C 742,646 692,690 612,690 C 542,690 500,665 440,670 C 380,675 335,700 275,690 C 210,680 180,630 152,595 C 112,550 78,500 62,424 Z';

      // decorative land details
      let decor = '';
      decor += mountain(350, 188, 1.15, 'rgba(190,180,158,.3)') + mountain(430, 170, 0.9, 'rgba(190,180,158,.24)') + mountain(376, 142, 0.7, 'rgba(190,180,158,.2)');
      decor += mountain(786, 292, 1.05, 'rgba(190,180,158,.26)') + mountain(868, 264, 0.8, 'rgba(190,180,158,.2)');
      decor += mountain(628, 88, 0.8, 'rgba(190,180,158,.2)') + mountain(522, 96, 0.65, 'rgba(190,180,158,.16)');
      decor += tree(204, 382, 1.15, 'rgba(170,190,170,.25)') + tree(168, 340, 0.9, 'rgba(170,190,170,.2)') + tree(290, 398, 0.8, 'rgba(170,190,170,.2)') + tree(206, 286, 0.7, 'rgba(170,190,170,.16)');
      decor += tree(500, 606, 0.95, 'rgba(170,190,170,.22)') + tree(586, 608, 0.75, 'rgba(170,190,170,.18)') + tree(440, 688, 0.65, 'rgba(170,190,170,.16)');
      decor += waves(318, 516, 1, 'rgba(150,180,220,.2)') + waves(414, 438, 0.8, 'rgba(150,180,220,.16)') + waves(882, 210, 0.75, 'rgba(150,180,220,.15)');
      // river
      decor += `<path d="M 414 250 C 448 310 340 366 362 458 C 380 530 438 588 470 630" fill="none" stroke="rgba(130,160,210,.12)" stroke-width="2.4"/>`;
      // citadel spires behind the capital
      decor += `<g stroke="rgba(196,123,224,.28)" fill="rgba(196,123,224,.05)" stroke-width="1">
        <path d="M 848 552 L 858 500 L 868 552Z"/><path d="M 866 552 L 880 486 L 894 552Z"/><path d="M 890 552 L 902 512 L 914 552Z"/>
        <path d="M 840 552 h 82" stroke-width="1.4"/>
      </g>`;
      // ashen obelisks
      decor += `<g stroke="rgba(190,180,158,.2)" fill="rgba(190,180,158,.04)" stroke-width="1">
        <path d="M 660 462 l 4 -20 l 4 20Z"/><path d="M 736 470 l 3 -15 l 3 15Z"/><path d="M 682 480 l 2 -11 l 2 11Z"/>
      </g>`;
      // ruins at gate
      decor += `<g stroke="rgba(190,180,158,.18)" fill="none" stroke-width="1">
        <path d="M 486 386 v -18 M 482 372 h 8 M 530 382 v -13 M 527 372 h 6"/>
      </g>`;
      // sea compass
      decor += `<g class="map-compass" transform="translate(86,134)">
        <circle r="31" stroke="rgba(232,199,122,.17)" fill="none"/>
        <circle r="24" stroke="rgba(232,199,122,.1)" fill="none"/>
        <path d="M 0 -30 L 5 -6 L 0 0 L -5 -6Z" fill="rgba(232,199,122,.4)" stroke="none"/>
        <path d="M 0 30 L 5 6 L 0 0 L -5 6Z" fill="rgba(232,199,122,.16)" stroke="none"/>
        <path d="M -30 0 L -6 5 L 0 0 L -6 -5Z" fill="rgba(232,199,122,.16)" stroke="none"/>
        <path d="M 30 0 L 6 5 L 0 0 L 6 -5Z" fill="rgba(232,199,122,.22)" stroke="none"/>
        <text x="0" y="-35" text-anchor="middle" font-family="Cinzel, serif" font-size="8" letter-spacing="2" fill="rgba(232,199,122,.4)">N</text>
      </g>`;
      decor += `<text x="88" y="205" class="map-label-deco" transform="rotate(-90 88 205)" letter-spacing="3.2">THE SUNLESS SEA</text>`;
      decor += `<text x="500" y="668" text-anchor="middle" font-family="Cinzel, serif" font-size="22" letter-spacing="11" fill="rgba(232,199,122,.07)">AETHERMOOR</text>`;

      // roads
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

      this.svg.innerHTML = `
        <defs>
          <radialGradient id="seaGlow" cx="50%" cy="46%" r="62%">
            <stop offset="0%" stop-color="#16203a"/>
            <stop offset="55%" stop-color="#0c1222"/>
            <stop offset="100%" stop-color="#070a12"/>
          </radialGradient>
          <linearGradient id="landGrad" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%" stop-color="#1a2132"/>
            <stop offset="42%" stop-color="#131a29"/>
            <stop offset="100%" stop-color="#0c111d"/>
          </linearGradient>
          <radialGradient id="landLight" cx="42%" cy="34%" r="55%">
            <stop offset="0%" stop-color="rgba(232,199,122,.09)"/>
            <stop offset="70%" stop-color="rgba(232,199,122,.015)"/>
            <stop offset="100%" stop-color="rgba(232,199,122,0)"/>
          </radialGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity=".55"/>
          </filter>
          <filter id="nodeBlur"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        <rect width="1000" height="700" fill="url(#seaGlow)"/>
        <g>${stars}</g>
        <g class="sea-rings">
          <circle cx="500" cy="350" r="330"/><circle cx="500" cy="350" r="420"/>
          <circle cx="500" cy="350" r="510"/>
        </g>
        <g class="sea-grid">
          <path d="M0 175 H1000 M0 350 H1000 M0 525 H1000 M250 0 V700 M500 0 V700 M750 0 V700" stroke-dasharray="1 12"/>
        </g>
        <path class="land-coast" d="${island}" transform="translate(7,9) scale(.985)"/>
        <path class="land-shape" d="${island}"/>
        <path d="${island}" fill="url(#landLight)"/>
        <g opacity=".9">${decor}</g>
        <g>${roads}</g>
      `;

      this.roadEls = Array.from(this.svg.querySelectorAll('.road'));

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
      const hostProvince = selected;

      PROVINCES_LIST().forEach(p => {
        const el = this.nodeEls.get(p.id);
        if (!el) return;
        const owner = state.owners[p.id] || 'neutral';
        const garrison = state.garrisons[p.id] ?? 0;
        el.classList.remove('is-player', 'is-enemy', 'is-neutral', 'is-selected', 'is-adjacent', 'is-targetable', 'is-host-hidden');
        el.classList.add('is-' + owner);
        el.classList.toggle('is-selected', selected === p.id);
        el.classList.toggle('is-adjacent', p.id !== playerPos && p.neighbors.includes(playerPos));
        el.classList.toggle('is-targetable', targetable.has(p.id));
        el.classList.toggle('is-host-hidden', state.playerPos === p.id || state.enemyPos === p.id);
        const badge = el.querySelector('.prov__badge');
        if (badge) badge.textContent = garrison;
        el.setAttribute('aria-label', `${p.name}, ${OWNER_LABEL[owner]}, garrison ${garrison}${state.playerPos === p.id ? ', your host is here' : ''}`);
        el.setAttribute('aria-pressed', selected === p.id ? 'true' : 'false');
        el.classList.toggle('is-capital', Boolean(p.capital));
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
      if (!el) return;
      const cls = kind === 'smite' ? 'is-smited' : 'is-capture';
      el.classList.remove(cls);
      // force reflow so the animation can replay
      void el.offsetWidth;
      el.classList.add(cls);
      setTimeout(() => el.classList.remove(cls), 1100);
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
