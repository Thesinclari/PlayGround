/* ═══════════════════════════════════════════════════════════
   Chronicle storage — options and save slots
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const OPTIONS_KEY = 'gatc.options.v1';
  const SAVES_KEY = 'gatc.saves.v1';
  const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];
  const SLOT_LABEL = { auto: 'Autosave', slot1: 'Slot I', slot2: 'Slot II', slot3: 'Slot III' };

  const DEFAULT_OPTIONS = {
    music: 55,
    sfx: 70,
    reducedMotion: false,
    shake: true,
    muted: false,
    difficulty: 'normal',
    character: 'lux',
  };

  function safeGet(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
  }
  function safeSet(key, value) {
    try { window.localStorage.setItem(key, value); return true; } catch { return false; }
  }

  function getOptions() {
    try {
      const parsed = JSON.parse(safeGet(OPTIONS_KEY) || '{}');
      return { ...DEFAULT_OPTIONS, ...parsed };
    } catch {
      return { ...DEFAULT_OPTIONS };
    }
  }
  function setOptions(options) {
    return safeSet(OPTIONS_KEY, JSON.stringify({ ...DEFAULT_OPTIONS, ...options }));
  }

  function getSaves() {
    try {
      const parsed = JSON.parse(safeGet(SAVES_KEY) || '{}');
      const result = {};
      for (const slot of SLOTS) {
        if (parsed[slot] && parsed[slot].state) result[slot] = parsed[slot];
      }
      return result;
    } catch {
      return {};
    }
  }
  function setSaves(saves) {
    return safeSet(SAVES_KEY, JSON.stringify(saves));
  }

  function metaFromState(state, outcome = state.outcome) {
    let provinces = 0;
    for (const owner of Object.values(state.owners || {})) if (owner === 'player') provinces++;
    return {
      turn: state.turns || 1,
      provinces,
      host: state.host || 0,
      faith: state.faith || 0,
      difficulty: state.difficulty || 'normal',
      character: state.character || 'lux',
      updatedAt: Date.now(),
      outcome: outcome || null,
    };
  }

  function save(slot, state, outcome = state.outcome) {
    if (!SLOTS.includes(slot)) return false;
    const saves = getSaves();
    saves[slot] = {
      state: JSON.parse(JSON.stringify(state)),
      meta: metaFromState(state, outcome),
    };
    return setSaves(saves);
  }

  function hasAnySave() {
    return Object.keys(getSaves()).length > 0;
  }

  function newestSave() {
    const saves = getSaves();
    let best = null;
    for (const [slot, entry] of Object.entries(saves)) {
      if (!best || (entry.meta.updatedAt || 0) > (best.meta.updatedAt || 0)) best = { slot, ...entry };
    }
    return best;
  }

  function remove(slot) {
    const saves = getSaves();
    if (!saves[slot]) return false;
    delete saves[slot];
    return setSaves(saves);
  }

  function formatDate(ts) {
    if (!ts) return '';
    try {
      return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
    } catch {
      return '';
    }
  }

  window.GATC_SAVES = {
    SLOTS, SLOT_LABEL, DEFAULT_OPTIONS,
    getOptions, setOptions, getSaves, metaFromState, save, remove,
    hasAnySave, newestSave, formatDate,
  };
})();
