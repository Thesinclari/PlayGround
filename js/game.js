/* ═══════════════════════════════════════════════════════════
   Conquest — game rules
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const { PROVINCES, INITIAL, POWERS, DIFFICULTIES, CHARACTERS } = window.GATC_DATA;

  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const difficultyOf = (id) => DIFFICULTIES[id] || DIFFICULTIES.normal;

  function defenseLabel(p) {
    if (p.capital === 'enemy') return 'Citadel';
    if (p.capital === 'player') return 'Sanctum';
    if (p.fort >= 1.25) return 'Walled';
    if (p.fort >= 1.15) return 'High';
    return 'Open';
  }

  class Conquest {
    constructor(state, difficulty = 'normal', character = 'lux') {
      this.state = state ? Conquest.normalize(state) : Conquest.createState(difficulty, character);
    }

    static createState(difficulty = 'normal', character = 'lux') {
      const fate = difficultyOf(difficulty);
      const heroId = CHARACTERS[character] ? character : 'lux';
      return {
        version: 1,
        difficulty: fate.id,
        character: heroId,
        turns: 1,
        faith: fate.faith,
        host: fate.host,
        enemyHost: fate.enemyStart,
        playerPos: 'sanctum',
        enemyPos: 'shadow',
        owners: { ...INITIAL.owners },
        garrisons: { ...INITIAL.garrisons },
        usedPowers: [],
        blessing: false,
        outcome: null,
        startedAt: Date.now(),
        log: [
          { turn: 1, type: 'system', text: CHARACTERS[heroId].name + ', ' + CHARACTERS[heroId].epithet + ', takes the field beneath a dying sun.' },
          { turn: 1, type: 'system', text: 'His host gathers at the Sanctum. The Shadow Citadel waits in the east.' },
          { turn: 1, text: 'Hold the Sanctum. Take the Citadel. Rekindle the dawn.' },
        ],
        stats: { battlesWon: 0, captured: 0, smites: 0, fallen: 0, schemes: 0 },
      };
    }

    static normalize(state) {
      const base = Conquest.createState(state.difficulty || 'normal');
      const merged = {
        ...base,
        ...state,
        owners: { ...base.owners, ...(state.owners || {}) },
        garrisons: { ...base.garrisons, ...(state.garrisons || {}) },
        usedPowers: Array.isArray(state.usedPowers) ? state.usedPowers : [],
        stats: { ...base.stats, ...(state.stats || {}) },
        log: Array.isArray(state.log) ? state.log.slice(-60) : base.log,
      };
      if (!DIFFICULTIES[merged.difficulty]) merged.difficulty = 'normal';
      if (!CHARACTERS[merged.character]) merged.character = 'lux';
      if (!merged.playerPos) merged.playerPos = 'sanctum';
      if (!merged.enemyPos) merged.enemyPos = 'shadow';
      if (typeof merged.enemyHost !== 'number') merged.enemyHost = difficultyOf(merged.difficulty).enemyStart;
      if (typeof merged.host !== 'number') merged.host = difficultyOf(merged.difficulty).host;
      if (typeof merged.faith !== 'number') merged.faith = difficultyOf(merged.difficulty).faith;
      merged.turns = Math.max(1, merged.turns || 1);
      return merged;
    }

    get s() { return this.state; }
    get fate() { return difficultyOf(this.state.difficulty); }
    get commander() { return CHARACTERS[this.state.character] || CHARACTERS.lux; }
    province(id) { return PROVINCES[id]; }
    owner(id) { return this.state.owners[id] || 'neutral'; }
    garrison(id) { return this.state.garrisons[id] || 0; }
    isAdjacent(id) {
      return Boolean(id && PROVINCES[this.state.playerPos]?.neighbors.includes(id));
    }
    isEnemyAdjacent(id) {
      return Boolean(id && PROVINCES[this.state.enemyPos]?.neighbors.includes(id));
    }
    isHostile(id) { return this.owner(id) !== 'player'; }
    playerProvinces() { return Object.keys(this.state.owners).filter(id => this.owner(id) === 'player'); }
    enemyProvinces() { return Object.keys(this.state.owners).filter(id => this.owner(id) === 'enemy'); }
    neutralProvinces() { return Object.keys(this.state.owners).filter(id => this.owner(id) === 'neutral'); }
    countProvinces(side) {
      return Object.values(this.state.owners).filter(o => o === side).length;
    }
    income(side = 'player') {
      return this.playerProvinces().reduce((sum, id) => sum + (PROVINCES[id].income || 0), 0) * (side === 'player' ? 1 : 0);
    }
    playerIncome() {
      return this.playerProvinces().reduce((sum, id) => sum + (PROVINCES[id].income || 0), 0);
    }
    defenseLabel(id) { return defenseLabel(PROVINCES[id]); }
    provincePower(id) {
      const p = PROVINCES[id];
      const garrison = this.garrison(id);
      let power = garrison * p.fort + 2;
      if (id === this.state.playerPos) power += this.state.host * 0.8;
      if (id === this.state.enemyPos) power += this.state.enemyHost * 0.8;
      if (p.capital === 'player') power += 2;
      return Math.round(power);
    }

    addLog(text, type = '', turn = this.state.turns) {
      this.state.log.push({ text, type, turn, id: Date.now() + Math.random() });
      if (this.state.log.length > 60) this.state.log = this.state.log.slice(-60);
    }

    // ── player actions ─────────────────────────────────────
    recruit() {
      if (this.state.outcome) return { ok: false, msg: 'The chronicle is closed.' };
      if (this.state.faith < 10) return { ok: false, msg: 'Not enough faith to muster.' };
      if (this.state.host >= 40) return { ok: false, msg: 'Your host cannot grow further.' };
      this.state.faith -= 10;
      this.state.host = Math.min(40, this.state.host + 2);
      this.addLog('Two more faithful take up arms. The host swells to ' + this.state.host + '.', 'good');
      return { ok: true, msg: '+2 warriors mustered', effect: 'recruit' };
    }

    fortify() {
      if (this.state.outcome) return { ok: false, msg: 'The chronicle is closed.' };
      if (this.state.faith < 8) return { ok: false, msg: 'Not enough faith to fortify.' };
      const id = this.state.playerPos;
      if (this.owner(id) !== 'player') return { ok: false, msg: 'Your host is not in a province you hold.' };
      const p = PROVINCES[id];
      const max = p.capital === 'player' ? 10 : (p.fort >= 1.2 ? 7 : 6);
      if (this.garrison(id) >= max) return { ok: false, msg: 'The garrison is already at full strength.' };
      this.state.faith -= 8;
      this.state.garrisons[id] = Math.min(max, this.garrison(id) + 2);
      this.addLog('Walls are manned at ' + p.name + '. Garrison ' + this.garrison(id) + '.', 'good');
      return { ok: true, msg: '+2 garrison at ' + p.name, effect: 'fortify', province: id };
    }

    usePower(powerId, targetId) {
      const power = POWERS[powerId];
      if (!power) return { ok: false, msg: 'Unknown power.' };
      if (this.state.outcome) return { ok: false, msg: 'The chronicle is closed.' };
      if (this.state.usedPowers.includes(powerId)) return { ok: false, msg: power.name + ' has already answered today.' };
      if (this.state.faith < power.cost) return { ok: false, msg: 'Not enough faith for ' + power.name + '.' };

      if (powerId === 'smite') {
        if (!targetId || this.owner(targetId) === 'player') return { ok: false, msg: 'Smite must fall upon a hostile province.' };
        if (this.garrison(targetId) <= 0) return { ok: false, msg: 'There is nothing left to smite there.' };
        this.state.faith -= power.cost;
        this.state.usedPowers.push(powerId);
        const before = this.garrison(targetId);
        this.state.garrisons[targetId] = Math.max(0, before - 3);
        this.state.stats.smites++;
        const p = PROVINCES[targetId];
        this.addLog('Dawnfire falls on ' + p.name + '. Its garrison falls from ' + before + ' to ' + this.garrison(targetId) + '.', 'good');
        return { ok: true, msg: 'Smite strikes ' + p.name, effect: 'smite', province: targetId, damage: before - this.garrison(targetId) };
      }

      if (powerId === 'bless') {
        if (this.state.blessing) return { ok: false, msg: 'Your host already carries the blessing.' };
        this.state.faith -= power.cost;
        this.state.usedPowers.push(powerId);
        this.state.blessing = true;
        this.addLog('The host is anointed. Your next battle burns 35% brighter.', 'good');
        return { ok: true, msg: 'Blessing granted', effect: 'bless' };
      }

      if (powerId === 'mend') {
        if (this.state.host >= 40) return { ok: false, msg: 'Your host is already whole.' };
        this.state.faith -= power.cost;
        this.state.usedPowers.push(powerId);
        this.state.host = Math.min(40, this.state.host + 4);
        this.addLog('Light closes the wounds of your faithful. Host restored to ' + this.state.host + '.', 'good');
        return { ok: true, msg: '+4 warriors restored', effect: 'mend' };
      }

      if (powerId === 'convert') {
        if (!targetId || this.owner(targetId) !== 'neutral') return { ok: false, msg: 'Only a free province can be converted.' };
        const p = PROVINCES[targetId];
        const besideRealm = p.neighbors.some(n => this.owner(n) === 'player');
        if (!besideRealm) return { ok: false, msg: 'The province must border your realm.' };
        this.state.faith -= power.cost;
        this.state.usedPowers.push(powerId);
        this.state.owners[targetId] = 'player';
        this.state.garrisons[targetId] = Math.max(2, this.garrison(targetId));
        this.addLog(p.name + ' hears the old oath and joins the Imperial banner without a blade drawn.', 'good');
        return { ok: true, msg: p.name + ' joins the Imperial banner', effect: 'convert', province: targetId };
      }

      return { ok: false, msg: 'The power does not answer.' };
    }

    move(targetId) {
      if (this.state.outcome) return { ok: false, kind: 'none' };
      if (!PROVINCES[targetId]) return { ok: false, kind: 'none', msg: 'Unknown province.' };
      if (targetId === this.state.playerPos) return { ok: false, kind: 'none', msg: 'Your host is already here.' };
      if (!this.isAdjacent(targetId)) return { ok: false, kind: 'none', msg: 'That province is beyond your march.' };

      const p = PROVINCES[targetId];
      if (this.owner(targetId) === 'player') {
        this.state.playerPos = targetId;
        this.addLog('The host marches to ' + p.name + '.', '');
        return { ok: true, kind: 'move', target: targetId };
      }
      return this.playerBattle(targetId);
    }

    playerBattle(targetId) {
      const id = this.state.playerPos;
      const target = PROVINCES[targetId];
      const garrison = this.garrison(targetId);
      const defenderOwner = this.owner(targetId);
      const bless = this.state.blessing;

      const atk = Math.round(this.state.host * (bless ? 1.35 : 1) * rand(0.9, 1.1) + 3);
      let def = Math.round(garrison * target.fort * rand(0.9, 1.1) + 2);
      const enemySupport = this.state.enemyPos === targetId ? Math.round(this.state.enemyHost * 0.8) : 0;
      def += enemySupport;
      if (target.capital === 'player') def += 2;

      const win = atk > def;
      let losses = 0;
      let defenderLosses = 0;

      if (win) {
        losses = clamp(Math.round(garrison * rand(0.32, 0.55)) + 1, 1, Math.max(1, this.state.host - 1));
        this.state.host = Math.max(1, this.state.host - losses);
        defenderLosses = garrison;
        this.state.owners[targetId] = 'player';
        this.state.garrisons[targetId] = 1;
        this.state.playerPos = targetId;
        this.state.stats.battlesWon++;
        this.state.stats.captured++;
        this.state.faith += 4;
        this.addLog(target.name + ' falls to the Imperial banner. ' + losses + ' warriors lost, 4 faith gathered.', 'good');
        if (targetId === 'shadow') this.finish('victory');
      } else {
        losses = clamp(Math.round(this.state.host * rand(0.18, 0.32)), 1, Math.max(1, this.state.host - 1));
        this.state.host = Math.max(1, this.state.host - losses);
        defenderLosses = 1;
        this.state.garrisons[targetId] = Math.max(1, garrison - 1);
        if (this.state.enemyPos === targetId) this.state.enemyHost = Math.max(1, this.state.enemyHost - 1);
        this.addLog('The assault on ' + target.name + ' is thrown back. ' + losses + ' warriors lost.', 'bad');
      }

      if (bless) {
        this.state.blessing = false;
        this.addLog('The blessing spends itself in the fire of battle.', 'system');
      }

      return {
        ok: true, kind: 'battle',
        target: targetId,
        from: id,
        defender: defenderOwner,
        defenderName: target.name,
        atk, def, win, losses, defenderLosses,
        garrisonBefore: garrison,
        blessed: bless,
        capital: target.capital || null,
        enemySupport,
        outcome: this.state.outcome,
      };
    }

    finish(outcome) {
      this.state.outcome = outcome;
      if (outcome === 'victory') {
        this.addLog('The Shadow Citadel is taken. Dawn pours through the broken seal.', 'good');
      } else {
        this.addLog('The Sanctum of Dawn has fallen. The last light goes out.', 'bad');
      }
    }

    // ── enemy turn ────────────────────────────────────────
    beginEnemyTurn() {
      if (this.state.outcome) return { growth: 0 };
      const provinces = this.enemyProvinces();
      const growth = Math.max(1, this.fate.growthBase + Math.floor(provinces.length / 3));
      this.state.enemyHost = Math.min(40, this.state.enemyHost + growth);
      for (const id of provinces) {
        const p = PROVINCES[id];
        const max = p.capital === 'enemy' ? 12 : (p.fort >= 1.2 ? 6 : 4);
        if (this.garrison(id) < max) this.state.garrisons[id] = Math.min(max, this.garrison(id) + 1);
      }
      return { growth, enemyHost: this.state.enemyHost };
    }

    enemyScheme() {
      const s = this.state;
      const hero = this.commander;
      const name = Math.random() < 0.5 ? 'Tactic' : 'Magic';
      s.stats.schemes++;
      s.schemes = (s.schemes || 0) + 1;

      if (hero.stats.intelligence > this.fate.enemyInt) {
        s.insight = (s.insight || 0) + 1;
        this.addLog('Insight — ' + hero.name + ' reads the Hollow\'s ' + name + ' before it lands. The scheme unravels.', 'good');
        return {
          kind: 'scheme', name, countered: true,
          msg: 'Insight unravels the Hollow\'s ' + name + '.',
          enemyInt: this.fate.enemyInt, heroInt: hero.stats.intelligence,
        };
      }

      if (name === 'Tactic') {
        const loss = Math.min(4, s.faith);
        s.faith -= loss;
        this.addLog('The Hollow\'s Tactic bleeds ' + loss + ' faith from the Imperial supply.', 'bad');
        return {
          kind: 'scheme', name, countered: false, faithLoss: loss,
          msg: 'The Hollow\'s Tactic drains ' + loss + ' faith.',
          enemyInt: this.fate.enemyInt, heroInt: hero.stats.intelligence,
        };
      }

      const loss = Math.min(2, Math.max(0, s.host - 1));
      s.host -= loss;
      this.addLog('The Hollow\'s Magic sears the host. ' + loss + ' warriors fall.', 'bad');
      return {
        kind: 'scheme', name, countered: false, hostLoss: loss,
        msg: 'The Hollow\'s Magic claims ' + loss + ' warriors.',
        enemyInt: this.fate.enemyInt, heroInt: hero.stats.intelligence,
      };
    }

    _bfsPath(from, goalTest) {
      const queue = [[from]];
      const seen = new Set([from]);
      while (queue.length) {
        const path = queue.shift();
        const last = path[path.length - 1];
        if (goalTest(last)) return path;
        for (const n of PROVINCES[last].neighbors) {
          if (seen.has(n)) continue;
          seen.add(n);
          queue.push([...path, n]);
        }
      }
      return null;
    }

    _defenseAt(id) {
      const p = PROVINCES[id];
      let def = this.garrison(id) * p.fort + 2;
      if (id === this.state.playerPos) def += this.state.host * 0.8;
      if (p.capital === 'player') def += 2;
      return def;
    }

    enemyAct() {
      const s = this.state;
      if (s.outcome) return { kind: 'none' };

      // The Hollow works a dark rite before its banners move.
      if (s.turns >= this.fate.aggressionTurn && Math.random() < 0.34) {
        return this.enemyScheme();
      }

      const pos = s.enemyPos;
      const adjacent = PROVINCES[pos].neighbors.slice();
      const playerTargets = adjacent.filter(id => this.owner(id) === 'player');
      const neutralTargets = adjacent.filter(id => this.owner(id) === 'neutral');
      const aggression = s.turns >= this.fate.aggressionTurn || this.enemyProvinces().length >= 6 || s.enemyHost >= 15;

      // 1 · strike a player province when it looks breakable
      playerTargets.sort((a, b) => this._defenseAt(a) - this._defenseAt(b));
      for (const target of playerTargets) {
        const def = this._defenseAt(target);
        const mustStopDawn = target === 'sanctum';
        if (aggression || s.enemyHost >= def * 1.18 || mustStopDawn) {
          return this.enemyBattle(target);
        }
      }

      // 2 · expand into a free province
      if (neutralTargets.length) {
        neutralTargets.sort((a, b) => this._defenseAt(a) - this._defenseAt(b));
        const target = neutralTargets[0];
        const def = this._defenseAt(target);
        if (s.enemyHost >= def * 1.08) return this.enemyBattle(target);
      }

      // 3 · march toward the nearest province still held by the Dawn
      const playerIds = this.playerProvinces();
      let goal = 'sanctum';
      if (playerIds.length) {
        let best = Infinity;
        for (const id of playerIds) {
          const path = this._bfsPath(pos, cur => cur === id);
          if (path && path.length < best) { best = path.length; goal = id; }
        }
      }
      const path = this._bfsPath(pos, cur => cur === goal);
      if (path && path.length > 1) {
        const next = path[1];
        if (this.owner(next) === 'player') return this.enemyBattle(next);
        if (this.owner(next) === 'neutral') {
          const def = this._defenseAt(next);
          if (s.enemyHost >= def * 1.05) return this.enemyBattle(next);
          s.enemyHost = Math.min(40, s.enemyHost + 1);
          this.addLog('The Hollow host gathers at ' + PROVINCES[pos].name + ', waiting for more dead.', 'bad');
          return { kind: 'hold', at: pos };
        }
        s.enemyPos = next;
        this.addLog('Hollow banners move through ' + PROVINCES[next].name + '.', 'bad');
        return { kind: 'move', target: next };
      }

      this.addLog('The Hollow host holds its ground at ' + PROVINCES[pos].name + '.', 'bad');
      return { kind: 'hold', at: pos };
    }

    enemyBattle(targetId) {
      const s = this.state;
      const target = PROVINCES[targetId];
      const garrison = this.garrison(targetId);
      const atk = Math.round(s.enemyHost * rand(0.9, 1.1) + 3 + this.fate.enemyBonus);
      let def = Math.round(garrison * target.fort * rand(0.9, 1.1) + 2);
      const playerSupport = s.playerPos === targetId ? Math.round(s.host * 0.8) : 0;
      def += playerSupport;
      if (target.capital === 'player') def += 2;

      const win = atk > def;
      let losses = 0;
      let defenderLosses = 0;
      let playerLosses = 0;

      if (win) {
        losses = clamp(Math.round(garrison * rand(0.3, 0.52)) + 1, 1, Math.max(1, s.enemyHost - 1));
        s.enemyHost = Math.max(1, s.enemyHost - losses);
        defenderLosses = garrison;
        s.owners[targetId] = 'enemy';
        s.garrisons[targetId] = 1;
        s.enemyPos = targetId;
        if (s.playerPos === targetId) {
          playerLosses = clamp(Math.round(garrison * 0.4), 1, Math.max(1, s.host - 1));
          s.host = Math.max(1, s.host - playerLosses);
          // the Dawn's field host withdraws to the nearest friendly province
          const refuge = PROVINCES[targetId].neighbors.find(n => s.owners[n] === 'player');
          if (refuge) {
            s.playerPos = refuge;
            this.addLog('Your host falls back to ' + PROVINCES[refuge].name + ' with ' + s.host + ' warriors.', 'bad');
          }
        }
        if (target.capital === 'player') {
          s.stats.fallen++;
          this.addLog(target.name + ' is overrun. The altar fire dies.', 'bad');
          this.finish('defeat');
        } else {
          this.addLog('The Hollow host takes ' + target.name + '. ' + losses + ' of its soldiers fall.', 'bad');
        }
      } else {
        losses = clamp(Math.round(s.enemyHost * rand(0.2, 0.34)), 1, Math.max(1, s.enemyHost - 1));
        s.enemyHost = Math.max(1, s.enemyHost - losses);
        defenderLosses = 1;
        s.garrisons[targetId] = Math.max(1, garrison - 1);
        if (s.playerPos === targetId) {
          playerLosses = clamp(Math.round(garrison * rand(0.15, 0.3)), 1, Math.max(1, s.host - 1));
          s.host = Math.max(1, s.host - playerLosses);
        }
        this.addLog('The Imperial host holds ' + target.name + '. The Hollow host loses ' + losses + '.', 'good');
      }

      return {
        kind: 'battle',
        target: targetId,
        defender: 'player',
        defenderName: target.name,
        atk, def, win, losses, defenderLosses,
        playerLosses,
        garrisonBefore: garrison,
        support: playerSupport,
        capital: target.capital || null,
        outcome: s.outcome,
      };
    }

    startPlayerTurn() {
      if (this.state.outcome) return { income: 0, garrisonGrowth: 0 };
      this.state.turns++;
      this.state.usedPowers = [];
      const income = this.playerIncome();
      this.state.faith += income;
      let grown = 0;
      for (const id of this.playerProvinces()) {
        const p = PROVINCES[id];
        const max = p.capital === 'player' ? 10 : (p.fort >= 1.2 ? 7 : 6);
        if (this.garrison(id) < max) {
          this.state.garrisons[id] = Math.min(max, this.garrison(id) + 1);
          grown++;
        }
      }
      this.addLog('Turn ' + this.state.turns + ' — the Imperial host gathers ' + income + ' faith.', 'system');
      return { income, garrisonGrowth: grown, turn: this.state.turns };
    }

    // ── helpers for UI ────────────────────────────────────
    actionFor(id) {
      if (this.state.outcome) return { type: 'none', label: 'The chronicle is closed', disabled: true };
      if (!this.isAdjacent(id)) return { type: 'none', label: 'Beyond your march', disabled: true };
      if (this.owner(id) === 'player') {
        return { type: 'move', label: 'March to ' + PROVINCES[id].short, disabled: false };
      }
      const power = this.provincePower(id);
      const blessed = this.state.blessing ? Math.round(this.state.host * 1.35 + 3) : this.state.host + 3;
      return {
        type: 'attack',
        label: 'Attack ' + PROVINCES[id].short,
        disabled: false,
        risky: blessed < power,
        power,
      };
    }

    remainingPowers() {
      return Object.keys(POWERS).filter(id => !this.state.usedPowers.includes(id));
    }
  }

  window.GATC_GAME = { Conquest };
})();
