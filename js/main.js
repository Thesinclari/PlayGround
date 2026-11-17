/* ═══════════════════════════════════════════════════════════
   Goddess and the Conquest — application controller
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const { PROVINCES, POWERS, DIFFICULTIES, CHARACTERS, TERRAIN, REGIONS } = window.GATC_DATA;
  const SAVES = window.GATC_SAVES;
  const { Conquest } = window.GATC_GAME;
  const { MapView } = window.GATC_MAP;
  const { SoundEngine } = window.GATC_AUDIO;

  const $ = id => document.getElementById(id);
  const OWNER_LABEL = { player: 'Imperial', enemy: 'Hollow', neutral: 'Free' };
  const NON_DISMISSIBLE = new Set(['modal-battle', 'modal-result']);
  const wait = ms => new Promise(resolve => setTimeout(resolve, options.reducedMotion ? Math.min(ms, 90) : ms));

  let options = SAVES.getOptions();
  const audio = new SoundEngine(options);

  let game = null;
  let map = null;
  let selected = 'sanctum';
  let targeting = null;
  let busy = false;
  let flow = 0;
  let battleResolve = null;
  let loadContext = 'menu';
  let optionsReturn = null;
  let introReturn = 'scenario';
  let bannerTimer = null;
  let toastTimer = null;
  let lastFocus = null;

  /* ── elements ─────────────────────────────────────────── */
  const screenMenu = $('screen-menu');
  const screenScenario = $('screen-scenario');
  const screenCharacter = $('screen-character');
  const screenIntro = $('screen-intro');
  const screenGame = $('screen-game');
  const screenFarewell = $('screen-farewell');

  const statTurn = $('stat-turn');
  const statFaith = $('stat-faith');
  const statHost = $('stat-host');
  const statProvinces = $('stat-provinces');
  const hudObjective = $('hud-objective');
  const hostLocation = $('host-location');
  const hostTroops = $('host-troops');
  const blessingChip = $('blessing-chip');
  const btnRecruit = $('btn-recruit');
  const btnFortify = $('btn-fortify');
  const btnEndTurn = $('btn-endturn');
  const btnEndTurnText = btnEndTurn.querySelector('.btn--endturn__text');
  const btnPause = $('btn-pause');
  const btnSound = $('btn-sound');
  const mapHint = $('map-hint');
  const mapHintText = $('map-hint-text');
  const mapBanner = $('map-banner');
  const mapToast = $('map-toast');
  const provincePanel = $('province-panel');
  const provinceOwner = $('province-owner');
  const provinceName = $('province-name');
  const provinceFlavor = $('province-flavor');
  const provinceGarrison = $('province-garrison');
  const provinceIncome = $('province-income');
  const provinceDefence = $('province-defence');
  const provinceTerrain = $('province-terrain');
  const provinceAction = $('btn-province-action');
  const provinceNote = $('province-note');
  const chronicle = $('chronicle');
  const powersMeta = $('powers-meta');
  const powersCancel = $('powers-cancel');
  const tooltip = $('tooltip');
  const fxFlash = $('fx-flash');
  const battleOutcome = $('battle-outcome');
  const battleLosses = $('battle-losses');
  const battleAtkFill = $('battle-atk-fill');
  const battleDefFill = $('battle-def-fill');
  const battleAtkPower = $('battle-atk-power');
  const battleDefPower = $('battle-def-power');
  const battleAtkTroops = $('battle-atk-troops');
  const battleDefTroops = $('battle-def-troops');
  const battleDefName = $('battle-def-name');
  const battleTitle = $('battle-title');

  /* ═══════════════════════════════════════════════════════
     setup
     ═══════════════════════════════════════════════════════ */
  function init() {
    map = new MapView({
      svg: $('realm-map'),
      nodes: $('map-nodes'),
      tokens: $('map-tokens'),
      stage: $('map-stage'),
      onSelect: handleProvinceSelect,
      onHover: showTooltip,
      onLeave: hideTooltip,
    });

    applyOptions();
    buildEmbers();
    buildPresets();
    buildCharacter();
    bindEvents();
    updateMenuSaveCount();
    syncOptionsUI();
    syncScenarioUI();

    const unlocked = () => {
      audio.init();
      document.removeEventListener('pointerdown', unlocked);
      document.removeEventListener('keydown', unlocked);
    };
    document.addEventListener('pointerdown', unlocked);
    document.addEventListener('keydown', unlocked);

    // gentle entrance
    requestAnimationFrame(() => document.body.classList.add('ready'));
  }

  function applyOptions() {
    audio.setMusic(options.music);
    audio.setSfx(options.sfx);
    audio.setMuted(options.muted);
    document.body.classList.toggle('reduced-motion', Boolean(options.reducedMotion));
    updateSoundButton();
  }

  function buildEmbers() {
    const host = $('menu-embers');
    if (!host) return;
    const seed = [0.42, 0.71, 0.58, 0.86, 0.63, 0.77, 0.49, 0.91, 0.68, 0.55, 0.81, 0.37];
    seed.forEach((r, i) => {
      const el = document.createElement('span');
      el.className = 'ember';
      el.style.left = (52 + r * 44) + '%';
      el.style.bottom = (4 + ((i * 13) % 46)) + '%';
      el.style.animationDelay = (i * 1.3) + 's';
      el.style.animationDuration = (9 + (i % 5) * 2.2) + 's';
      el.style.width = el.style.height = (2 + (i % 3)) + 'px';
      host.appendChild(el);
    });
  }

  /* ═══════════════════════════════════════════════════════
     screens
     ═══════════════════════════════════════════════════════ */
  function showScreen(name) {
    screenMenu.hidden = name !== 'menu';
    screenScenario.hidden = name !== 'scenario';
    screenCharacter.hidden = name !== 'character';
    screenIntro.hidden = name !== 'intro';
    screenGame.hidden = name !== 'game';
    screenFarewell.hidden = true;
    screenMenu.classList.toggle('is-active', name === 'menu');
    document.body.classList.toggle('in-game', name === 'game');
    window.scrollTo({ top: 0 });
  }

  function showMenu() {
    flow++;
    busy = false;
    targeting = null;
    game = null;
    closeAllModals({ silent: true });
    showScreen('menu');
    updateMenuSaveCount();
    audio.close();
    audio.init();
  }

  function startIntro(origin = 'scenario') {
    introReturn = origin;
    closeAllModals({ silent: true });
    showScreen('intro');
    audio.open();
    if (screenIntro.scrollTo) screenIntro.scrollTo(0, 0);
  }

  function showScenario() {
    closeAllModals({ silent: true });
    syncScenarioUI();
    switchScenarioTab('scenario');
    showScreen('scenario');
    audio.open();
  }

  function currentCharacter() {
    return CHARACTERS[options.character] || CHARACTERS.lux;
  }

  function showCharacter() {
    closeAllModals({ silent: true });
    buildCharacter();
    syncScenarioUI();
    showScreen('character');
    audio.open();
  }

  function buildCharacter() {
    const hero = currentCharacter();
    const statOrder = [
      ['leadership', 'Leadership'],
      ['war', 'War'],
      ['intelligence', 'Intelligence'],
      ['politics', 'Politics'],
      ['charisma', 'Charisma'],
      ['ambition', 'Ambition'],
    ];

    const portrait = $('character-portrait-img');
    if (portrait) {
      portrait.src = hero.portrait;
      portrait.alt = 'Portrait of ' + hero.name;
    }
    $('character-name').textContent = hero.name;
    $('character-title').textContent = hero.epithet;
    $('character-kingdom').textContent = hero.kingdom;
    $('character-affinity').textContent = hero.affinity;
    $('character-kingdom-2').textContent = hero.kingdom;
    $('character-affinity-2').textContent = hero.affinity;
    $('character-personality').textContent = hero.personality.join(' · ');
    $('character-succession').textContent = hero.succession;
    $('character-skill-name').textContent = hero.skill.name;
    $('character-skill-desc').textContent = hero.skill.desc;
    $('character-hint').innerHTML =
      '<span class="scenario-hint__mark" aria-hidden="true">✦</span> ' + hero.name + ' will lead the Imperial host into Aethermoor.';

    const stats = $('character-stats');
    const frag = document.createDocumentFragment();
    for (const [key, label] of statOrder) {
      const value = hero.stats[key];
      const row = document.createElement('div');
      row.className = 'character-stat';
      const name = document.createElement('span');
      name.className = 'character-stat__label';
      name.textContent = label;
      const track = document.createElement('span');
      track.className = 'character-stat__track';
      const fill = document.createElement('i');
      fill.style.width = Math.max(0, Math.min(100, value)) + '%';
      track.appendChild(fill);
      const score = document.createElement('b');
      score.textContent = value;
      row.append(name, track, score);
      frag.appendChild(row);
    }
    stats.replaceChildren(frag);

    const lore = $('character-lore');
    const loreFrag = document.createDocumentFragment();
    for (const paragraph of hero.lore) {
      const p = document.createElement('p');
      p.textContent = paragraph;
      loreFrag.appendChild(p);
    }
    lore.replaceChildren(loreFrag);

    document.querySelectorAll('[data-character-id]').forEach(btn => {
      const on = btn.dataset.characterId === hero.id;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function selectCharacter(id) {
    if (!CHARACTERS[id] || options.character === id) return;
    options.character = id;
    SAVES.setOptions(options);
    buildCharacter();
    syncScenarioUI();
    audio.select();
  }

  function startNewGame() {
    const hero = currentCharacter();
    flow++;
    closeAllModals({ silent: true });
    game = new Conquest(null, options.difficulty, hero.id);
    selected = game.state.playerPos;
    targeting = null;
    busy = false;
    showScreen('game');
    updateAll();
    autoSave();
    showBanner(hero.name, 'Turn 1 · ' + game.fate.title + ' · ' + game.fate.name);
    setTimeout(() => showToast(hero.name + ', ' + hero.epithet + ', takes up the crown.', 'is-good'), 500);
    audio.open();
  }

  /* ═══════════════════════════════════════════════════════
     scenario select
     ═══════════════════════════════════════════════════════ */
  function currentFate() {
    return DIFFICULTIES[options.difficulty] || DIFFICULTIES.normal;
  }

  function buildPresets() {
    const grid = $('preset-grid');
    if (!grid) return;
    grid.replaceChildren();
    Object.values(DIFFICULTIES).forEach(fate => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'preset-card';
      card.dataset.difficulty = fate.id;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
      card.innerHTML =
        '<span class="preset-card__mark" aria-hidden="true">✦</span>' +
        '<span class="preset-card__title">' + fate.title + '</span>' +
        '<span class="preset-card__name">' + fate.name + '</span>' +
        '<span class="preset-card__blurb">' + fate.blurb + '</span>' +
        '<span class="preset-card__stats">' +
          '<span><small>Faith</small><b>' + fate.faith + '</b></span>' +
          '<span><small>Host</small><b>' + fate.host + '</b></span>' +
          '<span><small>Hollow</small><b>' + fate.enemyStart + '</b></span>' +
        '</span>';
      card.addEventListener('click', () => selectDifficulty(fate.id));
      grid.appendChild(card);
    });
  }

  function syncScenarioUI() {
    const fate = currentFate();
    const hero = currentCharacter();
    const label = fate.title + ' · ' + fate.name;
    const tag = $('scenario-difficulty-tag');
    if (tag) tag.textContent = label;
    const fateEl = $('scenario-fate');
    if (fateEl) fateEl.textContent = label;
    const heroName = $('scenario-hero-name');
    if (heroName) heroName.textContent = hero.name;
    const heroTitle = $('scenario-hero-title');
    if (heroTitle) heroTitle.textContent = hero.epithet;
    const heroPortrait = $('scenario-portrait-img');
    if (heroPortrait) heroPortrait.style.backgroundImage = 'url("' + hero.portrait + '")';
    const hint = $('scenario-hint');
    if (hint) {
      hint.innerHTML = '<span class="scenario-hint__mark" aria-hidden="true">✦</span> The Beginning awaits · ' + label;
    }
    document.querySelectorAll('[data-difficulty]').forEach(btn => {
      const on = btn.dataset.difficulty === fate.id;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.classList.toggle('is-selected', on);
    });
  }

  function selectDifficulty(id) {
    if (!DIFFICULTIES[id] || options.difficulty === id) return;
    options.difficulty = id;
    SAVES.setOptions(options);
    syncScenarioUI();
    syncOptionsUI();
    audio.click();
  }

  function switchScenarioTab(tab) {
    const showPreset = tab === 'preset';
    document.querySelectorAll('[data-scenario-tab]').forEach(btn => {
      const on = btn.dataset.scenarioTab === tab;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    const scenarioPanel = $('scenario-panel-scenario');
    const presetPanel = $('scenario-panel-preset');
    if (scenarioPanel) scenarioPanel.hidden = showPreset;
    if (presetPanel) presetPanel.hidden = !showPreset;
  }

  /* ═══════════════════════════════════════════════════════
     rendering
     ═══════════════════════════════════════════════════════ */
  function updateAll() {
    if (!game) return;
    renderHUD();
    renderProvince();
    renderPowers();
    renderLog();
    renderMap();
    renderEndTurn();
  }

  function renderMap() {
    if (!game) return;
    map.update(game.state, {
      selected,
      targetable: targetableSet(),
      targeting: Boolean(targeting),
    });
    const hints = [];
    if (busy) hints.push('The Hollow host moves...');
    else if (targeting) hints.push('Choose a province for ' + POWERS[targeting].name);
    else if (PROVINCES[game.state.playerPos].neighbors.some(id => game.owner(id) !== 'player')) {
      hints.push('Hostile borders within reach · select a province');
    } else {
      hints.push('Select a province, or march your host');
    }
    mapHintText.textContent = hints[0];
    mapHint.classList.toggle('is-active', Boolean(targeting) || (!busy && PROVINCES[game.state.playerPos].neighbors.some(id => game.owner(id) !== 'player')));
  }

  function renderHUD() {
    if (!game) return;
    statTurn.textContent = game.state.turns;
    statFaith.textContent = game.state.faith;
    statHost.textContent = game.state.host;
    statProvinces.innerHTML = game.countProvinces('player') + '<span class="stat__of">/15</span>';
    hostLocation.textContent = PROVINCES[game.state.playerPos].name;
    hostLocation.className = 'owner-badge owner-badge--player';
    hostTroops.textContent = game.state.host;
    const hostName = $('host-name');
    if (hostName) hostName.innerHTML = game.commander.name + ' <em>' + game.commander.epithet + '</em>';
    blessingChip.hidden = !game.state.blessing;
    hudObjective.textContent = game.state.outcome ? 'The chronicle is closed' : 'Seize the Shadow Citadel';

    const closed = Boolean(game.state.outcome);
    btnRecruit.disabled = busy || closed || game.state.faith < 10 || game.state.host >= 40;
    const maxGarrison = game.state.playerPos && PROVINCES[game.state.playerPos].capital === 'player' ? 10 : 6;
    btnFortify.disabled = busy || closed || game.state.faith < 8 ||
      game.owner(game.state.playerPos) !== 'player' ||
      game.garrison(game.state.playerPos) >= maxGarrison;
    btnPause.disabled = busy;
    btnPause.setAttribute('aria-disabled', busy ? 'true' : 'false');
  }

  function renderEndTurn() {
    if (!game) return;
    const closed = Boolean(game.state.outcome);
    btnEndTurn.disabled = busy || closed;
    btnEndTurn.classList.toggle('is-busy', busy || closed);
    const text = game.state.outcome
      ? 'Chronicle Closed'
      : busy
        ? 'The Hollow Moves...'
        : 'End Turn';
    if (btnEndTurnText) btnEndTurnText.textContent = text;
    else btnEndTurn.textContent = text;
  }

  function renderProvince() {
    if (!game) return;
    const p = PROVINCES[selected] || PROVINCES[game.state.playerPos];
    const owner = game.owner(p.id);
    const garrison = game.garrison(p.id);

    provinceOwner.textContent = OWNER_LABEL[owner];
    provinceOwner.className = 'owner-badge owner-badge--' + owner;
    provinceName.textContent = p.name;
    provinceFlavor.textContent = p.flavor;
    provinceGarrison.textContent = garrison;
    provinceIncome.textContent = '+' + p.income;
    provinceDefence.textContent = game.defenseLabel(p.id);
    if (provinceTerrain) {
      const terrain = TERRAIN[p.terrain];
      provinceTerrain.textContent = terrain ? terrain.name : 'Unknown';
      provinceTerrain.title = p.region ? p.region + ' · ' + (game.defenseLabel(p.id) || '') : '';
    }

    provinceAction.hidden = true;
    provinceAction.disabled = true;
    provinceAction.classList.remove('is-danger');
    provinceNote.className = 'province-note';

    if (targeting) {
      provinceAction.hidden = true;
      const power = POWERS[targeting];
      const isTarget = targetableSet().has(p.id);
      provinceNote.textContent = isTarget
        ? 'This province can receive ' + power.name + '. Click it on the map.'
        : power.name + ' cannot reach here. Choose a glowing province.';
      provinceNote.classList.toggle('is-ready', isTarget);
      return;
    }

    if (busy) {
      provinceNote.textContent = 'The Hollow host is moving across the realm...';
      return;
    }

    if (p.id === game.state.playerPos) {
      provinceNote.textContent = 'Your host is stationed here. Choose a neighbouring province to march.';
      if (owner === 'player') provinceNote.classList.add('is-ready');
      return;
    }

    const action = game.actionFor(p.id);
    if (action.type === 'none') {
      provinceAction.hidden = false;
      provinceAction.textContent = action.label;
      provinceAction.disabled = true;
      if (p.capital === 'enemy') {
        provinceNote.textContent = 'Beyond your march. The Hollow King waits behind ten thousand shadows.';
      } else if (owner === 'player') {
        provinceNote.textContent = 'Held in the Imperial name · +' + p.income + ' faith each turn.';
      } else {
        provinceNote.textContent = 'Beyond your march. Move closer to engage.';
      }
      return;
    }

    provinceAction.hidden = false;
    provinceAction.disabled = false;
    provinceAction.textContent = action.label;
    if (action.type === 'attack') {
      provinceAction.classList.add('is-danger');
      const forecast = game.state.host + (game.state.blessing ? ' (blessed)' : '');
      provinceNote.textContent = 'Forecast: your host of ' + forecast + ' against a defence of ' + action.power + '.';
      provinceNote.classList.add(action.risky ? 'is-warn' : 'is-ready');
      if (action.risky) provinceNote.textContent += ' This will be a hard fight.';
    } else {
      provinceNote.textContent = 'A safe march through land you already hold. +' + p.income + ' faith each turn.';
      provinceNote.classList.add('is-ready');
    }
  }

  function renderPowers() {
    if (!game) return;
    const closed = Boolean(game.state.outcome);
    document.querySelectorAll('.power').forEach(btn => {
      const id = btn.dataset.power;
      const power = POWERS[id];
      const used = game.state.usedPowers.includes(id);
      const poor = game.state.faith < power.cost;
      btn.classList.toggle('is-used', used);
      btn.classList.toggle('is-active', targeting === id);
      btn.classList.toggle('is-poor', poor && !used);
      btn.setAttribute('aria-disabled', used || poor || closed ? 'true' : 'false');
    });
    powersMeta.textContent = targeting
      ? 'Choose a province'
      : game.remainingPowers().length + ' of 4 miracles remain';
    powersCancel.hidden = !targeting;
  }

  function renderLog() {
    if (!game) return;
    const frag = document.createDocumentFragment();
    for (const entry of game.state.log.slice(-40)) {
      const li = document.createElement('li');
      li.textContent = entry.text;
      if (entry.type) li.classList.add('is-' + entry.type);
      li.title = 'Turn ' + entry.turn;
      frag.appendChild(li);
    }
    chronicle.replaceChildren(frag);
    chronicle.scrollTop = chronicle.scrollHeight;
  }

  function targetableSet() {
    if (!game || !targeting) return new Set();
    const ids = [];
    if (targeting === 'smite') {
      for (const [id, owner] of Object.entries(game.state.owners)) {
        if (owner !== 'player' && game.garrison(id) > 0) ids.push(id);
      }
    } else if (targeting === 'convert') {
      for (const [id, owner] of Object.entries(game.state.owners)) {
        if (owner !== 'neutral') continue;
        if (PROVINCES[id].neighbors.some(n => game.owner(n) === 'player')) ids.push(id);
      }
    }
    return new Set(ids);
  }

  function bump(statId) {
    const el = $(statId);
    if (!el) return;
    const stat = el.closest('.stat');
    if (!stat) return;
    stat.classList.remove('is-bumped');
    void stat.offsetWidth;
    stat.classList.add('is-bumped');
    setTimeout(() => stat.classList.remove('is-bumped'), 650);
  }

  function showBanner(kicker, text) {
    if (!mapBanner) return;
    mapBanner.querySelector('.map-banner__kicker').textContent = kicker;
    mapBanner.querySelector('.map-banner__text').textContent = text;
    mapBanner.classList.add('is-visible');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => mapBanner.classList.remove('is-visible'), 3800);
  }

  function showToast(text, tone = '') {
    if (!mapToast) return;
    mapToast.textContent = text;
    mapToast.className = 'map-toast' + (tone ? ' ' + tone : '');
    mapToast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => mapToast.classList.remove('is-visible'), 3000);
  }

  function updateSoundButton() {
    if (!btnSound) return;
    btnSound.setAttribute('aria-pressed', options.muted ? 'true' : 'false');
    btnSound.setAttribute('aria-label', options.muted ? 'Unmute sound' : 'Mute sound');
    const use = btnSound.querySelector('use');
    if (use) use.setAttribute('href', options.muted ? '#i-muted' : '#i-sound');
  }

  function updateMenuSaveCount() {
    const count = Object.keys(SAVES.getSaves()).length;
    const sub = document.querySelector('[data-menu="load"] .menu-btn__sub');
    if (sub) sub.textContent = count ? count + ' chronicle' + (count > 1 ? 's' : '') + ' sealed' : 'Return to a sealed chronicle';
  }

  function autoSave() {
    if (!game) return;
    SAVES.save('auto', game.state);
    updateMenuSaveCount();
  }

  /* ═══════════════════════════════════════════════════════
     province + power interactions
     ═══════════════════════════════════════════════════════ */
  function handleProvinceSelect(id) {
    hideTooltip();
    if (!game || busy) return;
    if (targeting) {
      resolvePowerAt(id);
      return;
    }
    selected = id;
    audio.select();
    renderProvince();
    renderMap();
    if (id === 'shadow') showToast('The Shadow Citadel · defence ' + game.provincePower(id) + '.', 'is-bad');
  }

  function selectPower(id) {
    if (!game || busy || game.state.outcome) return;
    if (targeting === id) {
      targeting = null;
      renderPowers();
      renderMap();
      audio.close();
      return;
    }
    const power = POWERS[id];
    if (game.state.usedPowers.includes(id)) {
      audio.deny();
      showToast(power.name + ' has already answered today.', 'is-bad');
      return;
    }
    if (game.state.faith < power.cost) {
      audio.deny();
      showToast('Not enough faith for ' + power.name + '.', 'is-bad');
      return;
    }

    if (power.target === 'self') {
      const result = game.usePower(id);
      if (!result.ok) {
        audio.deny();
        showToast(result.msg, 'is-bad');
        return;
      }
      audio.power();
      targeting = null;
      updateAll();
      bump('stat-faith');
      bump('stat-host');
      showToast(result.msg, 'is-good');
      autoSave();
      return;
    }

    const targets = targetSetFor(id);
    if (!targets.size) {
      audio.deny();
      showToast(id === 'convert' ? 'No free province borders your realm.' : 'No valid target for ' + power.name + '.', 'is-bad');
      return;
    }
    targeting = id;
    selected = game.state.playerPos;
    audio.open();
    updateAll();
    showToast('Choose a province for ' + power.name + '.', 'is-good');
  }

  function targetSetFor(id) {
    if (id === 'smite') {
      return new Set(Object.keys(PROVINCES).filter(pid => game.owner(pid) !== 'player' && game.garrison(pid) > 0));
    }
    if (id === 'convert') {
      return new Set(Object.keys(PROVINCES).filter(pid =>
        game.owner(pid) === 'neutral' && PROVINCES[pid].neighbors.some(n => game.owner(n) === 'player')
      ));
    }
    return new Set();
  }

  function resolvePowerAt(id) {
    if (!targeting || !game) return;
    if (!targetableSet().has(id)) {
      audio.deny();
      showToast(POWERS[targeting].name + ' cannot reach ' + PROVINCES[id].name + '.', 'is-bad');
      return;
    }
    const powerId = targeting;
    const result = game.usePower(powerId, id);
    if (!result.ok) {
      audio.deny();
      showToast(result.msg, 'is-bad');
      return;
    }
    audio.power();
    if (powerId === 'smite') map.flashProvince(id, 'smite');
    targeting = null;
    if (result.effect === 'convert') selected = id;
    updateAll();
    bump('stat-faith');
    if (result.effect === 'convert') bump('stat-provinces');
    showToast(result.msg, 'is-good');
    autoSave();
  }

  function performProvinceAction() {
    if (!game || busy || targeting) return;
    const action = game.actionFor(selected);
    if (action.disabled || action.type === 'none') {
      audio.deny();
      showToast(action.label, 'is-bad');
      return;
    }
    if (action.type === 'move') {
      const result = game.move(selected);
      if (!result.ok) {
        audio.deny();
        showToast(result.msg || 'The march cannot be made.', 'is-bad');
        return;
      }
      selected = game.state.playerPos;
      audio.move();
      updateAll();
      showToast('The host marches to ' + PROVINCES[selected].name + '.');
      autoSave();
      return;
    }
    if (action.type === 'attack') attack(selected);
  }

  async function attack(targetId) {
    if (!game || busy) return;
    busy = true;
    const run = flow;
    const result = game.move(targetId);
    if (!result.ok || result.kind !== 'battle') {
      busy = false;
      showToast(result.msg || 'The assault cannot begin.', 'is-bad');
      renderEndTurn();
      return;
    }

    selected = game.state.playerPos;
    renderEndTurn();
    if (result.win) {
      if (options.shake) map.shake();
      map.flashProvince(targetId, 'capture');
      map.glow();
    } else {
      if (options.shake) map.shake();
    }
    audio.battle();
    await showBattle(result, true);
    if (run !== flow) return;

    busy = false;
    if (result.win) selected = game.state.playerPos;
    updateAll();
    if (result.win) {
      map.flashProvince(targetId, 'capture');
      bump('stat-provinces');
      bump('stat-faith');
      bump('stat-host');
      showToast(PROVINCES[targetId].name + ' joins the Imperial banner. +4 faith.', 'is-good');
    } else {
      bump('stat-host');
      map.flashProvince(targetId, 'smite');
      showToast('The assault on ' + PROVINCES[targetId].name + ' is repelled. ' + result.losses + ' lost.', 'is-bad');
    }
    autoSave();

    if (result.outcome === 'victory') {
      setTimeout(() => showResult('victory'), 450);
    }
  }

  /* ═══════════════════════════════════════════════════════
     turn cycle
     ═══════════════════════════════════════════════════════ */
  async function endTurn() {
    if (!game || busy || game.state.outcome) return;
    if (closeTopModalIfAny()) return;
    busy = true;
    targeting = null;
    const run = ++flow;
    renderHUD();
    renderPowers();
    renderProvince();
    renderMap();
    renderEndTurn();
    audio.click();
    showBanner('The Hollow stirs', 'The shadow answers your move');

    await wait(600);
    if (run !== flow) return;

    const growth = game.beginEnemyTurn();
    if (growth.growth) {
      game.addLog('The Hollow host swells by ' + growth.growth + ' at the Shadow Citadel.', 'bad');
    }
    renderHUD();
    renderLog();
    await wait(750);
    if (run !== flow) return;

    const event = game.enemyAct();
    renderLog();
    renderHUD();
    if (event.kind === 'move') {
      updateAll();
      showToast('Hollow banners advance into ' + PROVINCES[event.target].name + '.', 'is-bad');
      await wait(850);
    } else if (event.kind === 'scheme') {
      updateAll();
      if (event.countered) {
        audio.power();
        showToast(event.msg, 'is-good');
      } else {
        audio.deny();
        if (options.shake) map.shake();
        showToast(event.msg, 'is-bad');
      }
      await wait(900);
      if (run !== flow) return;
    } else if (event.kind === 'battle') {
      audio.battle();
      if (options.shake) map.shake();
      await showBattle(event, false);
      if (run !== flow) return;
      updateAll();
      map.flashProvince(event.target, event.win ? 'smite' : 'capture');
      if (options.shake) map.shake();
      showToast(
        event.win ? PROVINCES[event.target].name + ' falls to the Hollow.' : 'The Imperial host holds ' + PROVINCES[event.target].name + '.',
        event.win ? 'is-bad' : 'is-good'
      );
      autoSave();
      await wait(800);
      if (run !== flow) return;
    } else if (event.kind === 'scheme') {
      updateAll();
      if (event.countered) {
        audio.power();
        bump('stat-faith');
        showBanner('Insight', 'The Hollow\'s ' + event.name + ' is undone');
        showToast(event.msg, 'is-good');
      } else {
        audio.deny();
        if (event.faithLoss) bump('stat-faith');
        if (event.hostLoss) bump('stat-host');
        showBanner('A dark rite', 'The Hollow works a ' + event.name);
        showToast(event.msg, 'is-bad');
      }
      autoSave();
      await wait(900);
      if (run !== flow) return;
    } else {
      updateAll();
      await wait(600);
    }

    if (run !== flow) return;
    if (game.state.outcome === 'defeat') {
      finishResult('defeat');
      return;
    }

    const start = game.startPlayerTurn();
    busy = false;
    updateAll();
    autoSave();
    bump('stat-turn');
    bump('stat-faith');
    showBanner('Turn ' + start.turn, 'The Imperial host gathers ' + start.income + ' faith');
    showToast('+' + start.income + ' faith gathered. The realm stirs.', 'is-good');
    audio.select();
  }

  function finishResult(outcome) {
    busy = false;
    if (game) game.state.outcome = outcome;
    renderEndTurn();
    renderHUD();
    showResult(outcome);
  }

  /* ═══════════════════════════════════════════════════════
     battle overlay
     ═══════════════════════════════════════════════════════ */
  function showBattle(event, playerAttacking) {
    return new Promise(resolve => {
      battleResolve = resolve;

      const dawnPower = playerAttacking ? event.atk : event.def;
      const hollowPower = playerAttacking ? event.def : event.atk;
      const dawnTroops = playerAttacking ? game.state.host + event.losses : event.garrisonBefore;
      const hollowTroops = playerAttacking ? event.garrisonBefore : game.state.enemyHost + event.losses;
      const maxPower = Math.max(1, dawnPower, hollowPower) * 1.12;

      battleAtkTroops.textContent = dawnTroops;
      battleDefTroops.textContent = hollowTroops;
      battleAtkPower.textContent = dawnPower;
      battleDefPower.textContent = hollowPower;
      battleDefName.textContent = playerAttacking ? event.defenderName : 'Hollow Legion';
      battleAtkFill.style.width = '0%';
      battleDefFill.style.width = '0%';

      const playerWon = playerAttacking ? event.win : !event.win;
      if (playerAttacking) {
        battleTitle.textContent = event.win ? 'The line breaks' : 'The assault falters';
      } else {
        battleTitle.textContent = event.win ? 'The Hollow breaks through' : 'The Imperial line holds';
      }

      const outcomeText = playerAttacking
        ? (event.win ? 'Your host carves through the defenders of ' + event.defenderName + '.' : 'Steel rings, but the defenders of ' + event.defenderName + ' do not yield.')
        : (event.win ? 'The dark tide rolls over ' + event.defenderName + '.' : 'The faithful of ' + event.defenderName + ' throw back the dark.');
      battleOutcome.textContent = outcomeText + (!playerAttacking && event.insight ? ' Insight unravels the Hollow\'s ' + event.gambit + '.' : '');
      battleOutcome.classList.toggle('is-win', playerWon);
      battleOutcome.classList.toggle('is-loss', !playerWon);

      if (playerAttacking) {
        battleLosses.innerHTML =
          '<span>Imperial <b class="loss">−' + event.losses + '</b></span>' +
          '<span>' + event.defenderName + ' <b class="loss">−' + event.defenderLosses + '</b></span>' +
          (event.win ? '<span class="gain">Province taken</span>' : '');
      } else {
        const dawnLosses = (event.defenderLosses || 0) + (event.playerLosses || 0);
        battleLosses.innerHTML =
          '<span>Imperial <b class="loss">−' + dawnLosses + '</b></span>' +
          '<span>Hollow <b class="loss">−' + event.losses + '</b></span>' +
          (event.win ? '<span class="loss">Province lost</span>' : '<span class="gain">Imperial holds</span>');
      }
      battleLosses.hidden = false;

      openModal('modal-battle', { silent: true });
      requestAnimationFrame(() => {
        setTimeout(() => {
          battleAtkFill.style.width = Math.min(100, (dawnPower / maxPower) * 100) + '%';
          battleDefFill.style.width = Math.min(100, (hollowPower / maxPower) * 100) + '%';
        }, options.reducedMotion ? 10 : 120);
      });
    });
  }

  function resolveBattle() {
    if (!battleResolve) return;
    const resolve = battleResolve;
    battleResolve = null;
    closeModal('modal-battle', { silent: true });
    audio.click();
    resolve();
  }

  /* ═══════════════════════════════════════════════════════
     result
     ═══════════════════════════════════════════════════════ */
  function showResult(outcome) {
    if (!game) return;
    const win = outcome === 'victory';
    const card = $('result-card');
    card.classList.toggle('is-defeat', !win);
    $('result-kicker').textContent = win ? 'The chronicle is complete' : 'The chronicle ends';
    $('result-title').textContent = win ? 'The Citadel Falls' : 'The Light Fades';
    $('result-text').textContent = win
      ? 'The seal breaks from within. For the first time in nine hundred years, the sun rises over Aethermoor. ' + game.commander.name + ', the Young King of Imperial, has kept his promise — and the realm remembers his name.'
      : 'The altar fire gutters and dies. The Hollow King\'s shadow pours through the Sanctum, and the last light of Aethermoor goes out. Yet every chronicle can be rewritten.';
    $('result-turns').textContent = game.state.turns;
    $('result-provinces').textContent = game.countProvinces('player');
    $('result-host').textContent = game.state.host;
    SAVES.save('auto', game.state, outcome);
    updateMenuSaveCount();
    openModal('modal-result', { silent: true });
    if (win) {
      audio.victory();
      flashScreen();
    } else {
      audio.defeat();
    }
  }

  function flashScreen() {
    fxFlash.classList.remove('is-firing');
    void fxFlash.offsetWidth;
    fxFlash.classList.add('is-firing');
    setTimeout(() => fxFlash.classList.remove('is-firing'), 1200);
  }

  /* ═══════════════════════════════════════════════════════
     save / load / options modals
     ═══════════════════════════════════════════════════════ */
  function openModal(id, { silent = false } = {}) {
    const layer = $(id);
    if (!layer) return;
    const open = layer.hidden === false;
    lastFocus = document.activeElement;
    layer.hidden = false;
    if (!silent) audio.open();
    const focusTarget = layer.querySelector('.modal__actions .btn, [data-close], button');
    setTimeout(() => {
      if (!layer.hidden && focusTarget) focusTarget.focus({ preventScroll: true });
    }, 40);
    if (open) return;
  }

  function closeModal(id, { silent = false, noReturn = false } = {}) {
    const layer = $(id);
    if (!layer || layer.hidden) return;
    layer.hidden = true;
    if (!silent) audio.close();
    if (!noReturn && id === 'modal-options' && optionsReturn) {
      const ret = optionsReturn;
      optionsReturn = null;
      openModal(ret, { silent: true });
      return;
    }
    if (lastFocus && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
      lastFocus = null;
    }
  }

  function closeAllModals({ silent = true } = {}) {
    document.querySelectorAll('.modal-layer').forEach(layer => {
      layer.hidden = true;
    });
    optionsReturn = null;
    if (silent) battleResolve = null;
  }

  function closeTopModalIfAny() {
    const layers = Array.from(document.querySelectorAll('.modal-layer')).filter(layer => !layer.hidden);
    if (!layers.length) return false;
    const top = layers[layers.length - 1];
    if (NON_DISMISSIBLE.has(top.id)) return true;
    closeModal(top.id);
    return true;
  }

  function openOptions(from) {
    optionsReturn = from === 'pause' ? 'modal-pause' : null;
    if (from === 'pause') closeModal('modal-pause', { silent: true, noReturn: true });
    syncOptionsUI();
    openModal('modal-options');
  }

  function syncOptionsUI() {
    const music = $('opt-music');
    const sfx = $('opt-sfx');
    music.value = options.music;
    sfx.value = options.sfx;
    $('opt-music-value').textContent = options.music;
    $('opt-sfx-value').textContent = options.sfx;
    paintRange(music);
    paintRange(sfx);
    const sound = $('opt-sound');
    if (sound) sound.setAttribute('aria-checked', options.muted ? 'false' : 'true');
    const motion = $('opt-motion');
    motion.setAttribute('aria-checked', options.reducedMotion ? 'true' : 'false');
    const shake = $('opt-shake');
    shake.setAttribute('aria-checked', options.shake ? 'true' : 'false');
    const fate = currentFate();
    document.querySelectorAll('#opt-difficulty .seg').forEach(btn => {
      const on = btn.dataset.difficulty === fate.id;
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.classList.toggle('is-selected', on);
    });
    const note = $('difficulty-note');
    if (note) note.textContent = fate.blurb;
  }

  function paintRange(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.background = 'linear-gradient(90deg, var(--gold-bright) 0%, var(--gold) ' + pct + '%, rgba(232,199,122,.16) ' + pct + '%)';
  }

  function openPause() {
    if (!game || busy || game.state.outcome) return;
    $('pause-sub').textContent = 'Turn ' + game.state.turns + ' · ' + PROVINCES[game.state.playerPos].name;
    openModal('modal-pause');
  }

  function openLoad(context) {
    loadContext = context;
    renderSaveList('load');
    openModal('modal-load');
  }

  function openSave() {
    if (!game) return;
    renderSaveList('save');
    openModal('modal-save');
  }

  function renderSaveList(mode) {
    const container = mode === 'load' ? $('load-list') : $('save-list');
    if (!container) return;
    const saves = SAVES.getSaves();
    container.replaceChildren();
    const slots = mode === 'load' ? SAVES.SLOTS : ['slot1', 'slot2', 'slot3'];

    for (const slot of slots) {
      const entry = saves[slot];
      if (!entry) {
        const empty = document.createElement(mode === 'save' ? 'button' : 'div');
        if (mode === 'save') empty.type = 'button';
        empty.className = 'save-row is-empty' + (mode === 'save' ? ' is-sealable' : '');
        empty.innerHTML = '<span class="save-row__slot">' + SAVES.SLOT_LABEL[slot] + '</span>' +
          '<span class="save-row__body"><span class="save-row__empty">No chronicle is sealed here.</span></span>' +
          '<span class="save-row__action">' + (mode === 'save' ? 'Seal' : 'Empty') + '</span>';
        if (mode === 'save') empty.addEventListener('click', () => writeChronicle(slot));
        container.appendChild(empty);
        continue;
      }

      const meta = entry.meta || {};
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'save-row is-loadable';
      const slotLabel = slot === 'auto' ? 'AUTO' : SAVES.SLOT_LABEL[slot].replace('Slot ', '');
      const title = document.createElement('span');
      title.className = 'save-row__title';
      title.textContent = 'Turn ' + (meta.turn || 1) + ' · ' + (meta.provinces || 0) + ' provinces';
      if (meta.outcome) {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = meta.outcome === 'victory' ? 'Victory' : 'Defeat';
        title.appendChild(tag);
      }
      const metaEl = document.createElement('span');
      metaEl.className = 'save-row__meta';
      const fateName = (DIFFICULTIES[meta.difficulty] || DIFFICULTIES.normal).name;
      metaEl.textContent = 'Host ' + (meta.host || 0) + ' · Faith ' + (meta.faith || 0) + ' · ' + fateName + ' · ' + SAVES.formatDate(meta.updatedAt);
      const body = document.createElement('span');
      body.className = 'save-row__body';
      body.append(title, metaEl);
      const action = document.createElement('span');
      action.className = 'save-row__action';
      action.textContent = mode === 'load' ? 'Load' : (slot in saves ? 'Overwrite' : 'Seal');
      row.innerHTML = '<span class="save-row__slot">' + slotLabel + '</span>';
      row.append(body, action);
      row.addEventListener('click', () => {
        if (mode === 'load') loadChronicle(slot);
        else writeChronicle(slot);
      });
      container.appendChild(row);
    }

    if (mode === 'load' && !slots.some(slot => saves[slot])) {
      const note = document.createElement('p');
      note.className = 'save-empty-note';
      note.textContent = 'The archive is empty. Begin a New Game, and your chronicle will be sealed here.';
      container.appendChild(note);
    }
  }

  function writeChronicle(slot) {
    if (!game) return;
    const ok = SAVES.save(slot, game.state);
    if (!ok) {
      audio.deny();
      showToast('The archive will not open. Storage is unavailable.', 'is-bad');
      return;
    }
    audio.save();
    showToast('Chronicle sealed in ' + SAVES.SLOT_LABEL[slot] + '.', 'is-good');
    renderSaveList('save');
    updateMenuSaveCount();
  }

  function loadChronicle(slot) {
    const entry = SAVES.getSaves()[slot];
    if (!entry) return;
    flow++;
    game = new Conquest(entry.state);
    selected = game.state.playerPos;
    targeting = null;
    busy = false;
    closeAllModals();
    showScreen('game');
    updateAll();
    autoSave();
    showBanner('Turn ' + game.state.turns, 'The chronicle resumes');
    showToast('The chronicle resumes in ' + PROVINCES[game.state.playerPos].name + '.', 'is-good');
    audio.open();
    if (game.state.outcome) setTimeout(() => showResult(game.state.outcome), 550);
  }

  /* ═══════════════════════════════════════════════════════
     tooltip
     ═══════════════════════════════════════════════════════ */
  function showTooltip(id, event) {
    if (!game || !tooltip) return;
    const p = PROVINCES[id];
    if (!p) return;
    const owner = game.owner(id);
    const hint = targeting
      ? (targetableSet().has(id) ? 'Click to receive ' + POWERS[targeting].name : 'Out of reach for this miracle')
      : (id === game.state.playerPos ? 'Your host is here' : game.isAdjacent(id) ? (owner === 'player' ? 'Click to march here' : 'Click to inspect · attack from the panel') : 'Click to inspect');
    const terrain = TERRAIN[p.terrain];
    const region = REGIONS[p.region];
    tooltip.innerHTML = '<strong>' + p.name + '</strong>' +
      '<div>' + (region ? region.name + ' · ' : '') + (terrain ? terrain.name : 'Unknown terrain') + '</div>' +
      '<div>' + OWNER_LABEL[owner] + ' · Garrison ' + game.garrison(id) + ' · +' + p.income + ' faith</div>' +
      '<div class="tooltip__hint">' + hint + '</div>';
    tooltip.hidden = false;
    let x = 20, y = 20;
    if (event && event.clientX != null) {
      x = event.clientX + 16;
      y = event.clientY + 16;
    } else if (event && event.target && event.target.getBoundingClientRect) {
      const rect = event.target.getBoundingClientRect();
      x = rect.right + 10;
      y = rect.top;
    }
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
  }

  function hideTooltip() {
    if (tooltip) tooltip.hidden = true;
  }

  /* ═══════════════════════════════════════════════════════
     events
     ═══════════════════════════════════════════════════════ */
  function bindEvents() {
    document.querySelectorAll('[data-menu]').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.click();
        const action = btn.dataset.menu;
        if (action === 'new') showScenario();
        else if (action === 'load') openLoad('menu');
        else if (action === 'options') openOptions('menu');
        else if (action === 'create') {
          audio.lock();
          openModal('modal-locked');
        } else if (action === 'exit') openModal('modal-exit');
      });
    });

    document.querySelectorAll('[data-intro]').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.click();
        if (btn.dataset.intro === 'begin') startNewGame();
        else if (introReturn === 'character') showCharacter();
        else showScenario();
      });
    });

    document.querySelectorAll('[data-character-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-locked')) {
          audio.lock();
          return;
        }
        selectCharacter(btn.dataset.characterId);
      });
    });

    document.querySelectorAll('[data-character]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.character;
        if (action === 'back') { audio.close(); showScenario(); return; }
        if (action === 'prologue') { audio.select(); startIntro('character'); return; }
        if (action === 'begin') { audio.open(); startNewGame(); }
      });
    });

    document.querySelectorAll('[data-scenario-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.click();
        switchScenarioTab(btn.dataset.scenarioTab);
      });
    });

    document.querySelectorAll('[data-scenario-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('is-locked')) {
          audio.lock();
          const hint = $('scenario-hint');
          if (hint) hint.innerHTML = '<span class="scenario-hint__mark" aria-hidden="true">✦</span> ' + btn.querySelector('.scenario-item__name').textContent + ' is still sealed. Only The Beginning is unsealed in this edition.';
          return;
        }
        audio.select();
        document.querySelectorAll('[data-scenario-id]').forEach(item => {
          const on = item === btn;
          item.classList.toggle('is-selected', on);
          item.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        syncScenarioUI();
      });
    });

    document.querySelectorAll('[data-scenario]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.scenario;
        if (action === 'back') { audio.close(); showMenu(); return; }
        if (action === 'prologue') { audio.select(); startIntro('scenario'); return; }
        if (action === 'begin') { audio.open(); showCharacter(); }
      });
    });

    document.querySelectorAll('[data-pause]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.pause;
        if (action === 'resume') { closeModal('modal-pause'); return; }
        if (action === 'save') { closeModal('modal-pause'); openSave(); return; }
        if (action === 'load') { closeModal('modal-pause'); openLoad('game'); return; }
        if (action === 'options') { openOptions('pause'); return; }
        if (action === 'menu') {
          closeModal('modal-pause');
          autoSave();
          showMenu();
        }
      });
    });

    document.querySelectorAll('[data-result]').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.click();
        if (btn.dataset.result === 'menu') {
          closeModal('modal-result', { silent: true });
          showMenu();
        } else {
          closeModal('modal-result', { silent: true });
          startNewGame();
        }
      });
    });

    btnRecruit.addEventListener('click', () => {
      if (!game || busy) return;
      const result = game.recruit();
      if (!result.ok) {
        audio.deny();
        showToast(result.msg, 'is-bad');
        return;
      }
      audio.select();
      bump('stat-faith');
      bump('stat-host');
      updateAll();
      showToast(result.msg, 'is-good');
      autoSave();
    });

    btnFortify.addEventListener('click', () => {
      if (!game || busy) return;
      const result = game.fortify();
      if (!result.ok) {
        audio.deny();
        showToast(result.msg, 'is-bad');
        return;
      }
      audio.select();
      bump('stat-faith');
      updateAll();
      map.flashProvince(result.province, 'capture');
      showToast(result.msg, 'is-good');
      autoSave();
    });

    provinceAction.addEventListener('click', performProvinceAction);

    document.querySelectorAll('.power').forEach(btn => {
      btn.addEventListener('click', () => selectPower(btn.dataset.power));
    });

    $('btn-cancel-target').addEventListener('click', () => {
      targeting = null;
      audio.close();
      updateAll();
    });

    btnEndTurn.addEventListener('click', endTurn);
    btnPause.addEventListener('click', openPause);
    btnSound.addEventListener('click', toggleMute);

    $('btn-clear-log').addEventListener('click', () => {
      if (!game) return;
      game.state.log = [];
      renderLog();
      audio.click();
    });

    $('btn-battle-continue').addEventListener('click', resolveBattle);

    $('btn-confirm-exit').addEventListener('click', () => {
      closeAllModals({ silent: true });
      screenMenu.hidden = true;
      screenScenario.hidden = true;
      screenCharacter.hidden = true;
      screenIntro.hidden = true;
      screenGame.hidden = true;
      screenFarewell.hidden = false;
      audio.close();
      setTimeout(() => {
        try { window.open('', '_self'); } catch { /* noop */ }
        try { window.close(); } catch { /* noop */ }
      }, 320);
    });

    $('btn-farewell-return').addEventListener('click', () => {
      audio.click();
      screenFarewell.hidden = true;
      showMenu();
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const layer = btn.closest('.modal-layer');
        if (layer) closeModal(layer.id);
      });
    });

    document.querySelectorAll('.modal-layer').forEach(layer => {
      layer.addEventListener('click', event => {
        if (event.target !== layer) return;
        if (NON_DISMISSIBLE.has(layer.id)) return;
        closeModal(layer.id);
      });
    });

    $('opt-music').addEventListener('input', event => {
      options.music = Number(event.target.value);
      $('opt-music-value').textContent = options.music;
      audio.setMusic(options.music);
      paintRange(event.target);
      SAVES.setOptions(options);
    });
    $('opt-sfx').addEventListener('input', event => {
      options.sfx = Number(event.target.value);
      $('opt-sfx-value').textContent = options.sfx;
      audio.setSfx(options.sfx);
      paintRange(event.target);
      SAVES.setOptions(options);
    });
    $('opt-sfx').addEventListener('change', () => audio.click());
    $('opt-sound').addEventListener('click', () => {
      toggleMute();
      syncOptionsUI();
    });
    document.querySelectorAll('#opt-difficulty .seg').forEach(btn => {
      btn.addEventListener('click', () => selectDifficulty(btn.dataset.difficulty));
    });
    $('opt-motion').addEventListener('click', () => {
      options.reducedMotion = !options.reducedMotion;
      document.body.classList.toggle('reduced-motion', options.reducedMotion);
      $('opt-motion').setAttribute('aria-checked', options.reducedMotion ? 'true' : 'false');
      SAVES.setOptions(options);
      audio.click();
    });
    $('opt-shake').addEventListener('click', () => {
      options.shake = !options.shake;
      $('opt-shake').setAttribute('aria-checked', options.shake ? 'true' : 'false');
      SAVES.setOptions(options);
      audio.click();
    });
    $('btn-reset-options').addEventListener('click', () => {
      options = { ...SAVES.DEFAULT_OPTIONS };
      SAVES.setOptions(options);
      applyOptions();
      syncOptionsUI();
      syncScenarioUI();
      audio.click();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const layers = Array.from(document.querySelectorAll('.modal-layer')).filter(layer => !layer.hidden);
        if (layers.length) {
          const top = layers[layers.length - 1];
          if (NON_DISMISSIBLE.has(top.id)) return;
          closeModal(top.id);
          return;
        }
        if (!screenFarewell.hidden) { showMenu(); return; }
        if (targeting) { targeting = null; updateAll(); audio.close(); return; }
        if (!screenGame.hidden) { openPause(); return; }
        if (!screenScenario.hidden) { showMenu(); return; }
        if (!screenCharacter.hidden) { showScenario(); return; }
        if (!screenIntro.hidden) { if (introReturn === 'character') showCharacter(); else showScenario(); return; }
      }

      if ((event.key === 'e' || event.key === 'E') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (screenGame.hidden || busy) return;
        if (document.querySelector('.modal-layer:not([hidden])')) return;
        endTurn();
      }
    });

    window.addEventListener('blur', hideTooltip);
    window.addEventListener('scroll', hideTooltip, true);
  }

  function toggleMute() {
    options.muted = !options.muted;
    SAVES.setOptions(options);
    audio.init();
    audio.setMuted(options.muted);
    updateSoundButton();
    syncOptionsUI();
    if (!options.muted) audio.click();
  }

  init();
})();
