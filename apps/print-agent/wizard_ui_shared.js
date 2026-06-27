/* Shared printer-mapping wizard helpers (configure + setup). */
(function (global) {
  'use strict';

  var DEFAULT_TEST_BLOCK_IDS = [
    'testStationLabel', 'testStation', 'testPrintBtn', 'testErr', 'testSent',
    'testConfirmBlock', 'testDone',
  ];

  function t(ui, key) {
    return ui && ui[key] ? ui[key] : key;
  }

  function fmt(ui, key, val) {
    return t(ui, key).replace('%s', val);
  }

  function fmt2(ui, key, a, b) {
    var s = t(ui, key);
    s = s.replace('%s', a);
    s = s.replace('%s', b);
    return s;
  }

  function formatSaveError(ui, payload) {
    var j = payload || {};
    if (j.error_code === 'station_mapping_conflict' && Array.isArray(j.conflicts) && j.conflicts.length) {
      var lines = j.conflicts.map(function (c) {
        var dev = (c.other_device_label && String(c.other_device_label).trim()) ||
          String(c.other_device_id || '').slice(0, 8);
        return fmt2(ui, 'save_station_conflict_line', c.station_label || c.station_id || '?', dev);
      });
      return t(ui, 'save_station_conflict_title') + '\n' + lines.join('\n');
    }
    return j.error || t(ui, 'save_failed');
  }

  /** Non-empty station_id -> printer target from .station-row / .station-printer selects. */
  function collectFromRows(root, opts) {
    opts = opts || {};
    var out = {};
    var scope = root || document;
    scope.querySelectorAll('.station-printer').forEach(function (sel) {
      var row = sel.closest('.station-row');
      if (!row) return;
      var sid = row.dataset.stationId;
      if (!sid) return;
      if (opts.draft) opts.draft[sid] = sel.value;
      if (sel.value) out[sid] = sel.value;
    });
    return out;
  }

  function mappingCount(maps) {
    return Object.keys(maps || {}).length;
  }

  function isMappingCleared(maps) {
    return mappingCount(maps) === 0;
  }

  function saveOkMessage(ui, maps) {
    return isMappingCleared(maps) ? t(ui, 'save_cleared_ok') : t(ui, 'save_ok');
  }

  function postSetup(stationPrinters) {
    return fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ station_printers: stationPrinters || {} }),
    }).then(function (r) {
      return r.json().then(function (j) {
        return { ok: r.ok, status: r.status, j: j };
      });
    });
  }

  function setTestBlockVisible(show, ids) {
    (ids || DEFAULT_TEST_BLOCK_IDS).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !show);
    });
  }

  global.MesaWizardUI = {
    DEFAULT_TEST_BLOCK_IDS: DEFAULT_TEST_BLOCK_IDS,
    t: t,
    fmt: fmt,
    fmt2: fmt2,
    formatSaveError: formatSaveError,
    collectFromRows: collectFromRows,
    mappingCount: mappingCount,
    isMappingCleared: isMappingCleared,
    saveOkMessage: saveOkMessage,
    postSetup: postSetup,
    setTestBlockVisible: setTestBlockVisible,
  };
})(typeof window !== 'undefined' ? window : globalThis);
