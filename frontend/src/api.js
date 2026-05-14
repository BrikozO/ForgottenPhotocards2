// Frontend API client + typography presets.
// Replaces the old static `data.js` — posts now come from FastAPI.
//
// API base is configured at runtime via window.__API_BASE__ (see index.html).
// In a docker-compose setup nginx proxies /api → backend, so the default
// '/api' works out of the box.

(function () {
  const API_BASE = (window.__API_BASE__ || '/api').replace(/\/$/, '');

  async function loadPosts() {
    const res = await fetch(API_BASE + '/posts', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      throw new Error('GET /posts failed: ' + res.status + ' ' + res.statusText);
    }
    return await res.json();
  }

  // Channel meta snapshot — backend ChannelMetaOut. The SPA only uses
  // `subscribers` today, but we pass the whole object through in case
  // future UI wants title/photos_count/etc. without another round-trip.
  // Falls back to { subscribers: 0 } so the UI never shows NaN.
  async function loadChannel() {
    try {
      const res = await fetch(API_BASE + '/channel', {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return { subscribers: 0 };
      const data = await res.json();
      return data && typeof data === 'object' ? data : { subscribers: 0 };
    } catch (_) {
      return { subscribers: 0 };
    }
  }

  // ── Admin ─────────────────────────────────────────────────────
  // Token-based auth — every admin request sends `Authorization: Bearer <t>`.
  // The token is held in component state only (no localStorage), so closing
  // the tab logs the admin out.
  function _adminHeaders(token) {
    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    };
  }

  async function adminLogin(token) {
    const res = await fetch(API_BASE + '/admin/login', {
      method: 'POST',
      headers: _adminHeaders(token),
    });
    if (res.status === 401) return { ok: false, error: 'Неверный токен' };
    if (res.status === 503) return { ok: false, error: 'Админ-панель отключена на сервере' };
    if (!res.ok)            return { ok: false, error: 'Ошибка ' + res.status };
    return { ok: true };
  }

  async function adminUpdatePost(token, postId, patch) {
    const res = await fetch(API_BASE + '/posts/' + postId, {
      method: 'PATCH',
      headers: _adminHeaders(token),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).detail || ''; } catch (_) {}
      throw new Error('PATCH /posts/' + postId + ' failed: ' + res.status + (detail ? ' — ' + detail : ''));
    }
    return await res.json();
  }

  // Author: { name, bio[], base, shooting_since, channel_since, cameras,
  //          email, telegram }. Optional — if missing, AboutPage uses
  // baked-in fallback copy.
  async function loadAuthor() {
    try {
      const res = await fetch(API_BASE + '/about', {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  // Typography presets stay on the frontend — they are pure UI concern,
  // not data that belongs in the DB.
  const TYPOGRAPHY_PRESETS = {
    grotesk: {
      name: 'Grotesk',
      description: 'Space Grotesk · JetBrains Mono',
      title: '"Space Grotesk", system-ui, sans-serif',
      body: '"Space Grotesk", system-ui, sans-serif',
      mono: '"JetBrains Mono", ui-monospace, monospace',
      titleWeight: 500,
      titleTracking: '-0.02em',
      logoTracking: '0.18em',
      logoWeight: 500,
    },
    geist: {
      name: 'Geist',
      description: 'Geist Sans · Geist Mono',
      title: '"Geist", system-ui, sans-serif',
      body: '"Geist", system-ui, sans-serif',
      mono: '"Geist Mono", ui-monospace, monospace',
      titleWeight: 400,
      titleTracking: '-0.03em',
      logoTracking: '0.22em',
      logoWeight: 500,
    },
    manrope: {
      name: 'Manrope',
      description: 'Manrope · IBM Plex Mono',
      title: '"Manrope", system-ui, sans-serif',
      body: '"Manrope", system-ui, sans-serif',
      mono: '"IBM Plex Mono", ui-monospace, monospace',
      titleWeight: 500,
      titleTracking: '-0.015em',
      logoTracking: '0.14em',
      logoWeight: 600,
    },
  };

  Object.assign(window, {
    loadPosts, loadChannel, loadAuthor,
    adminLogin, adminUpdatePost,
    TYPOGRAPHY_PRESETS, API_BASE,
  });
})();
