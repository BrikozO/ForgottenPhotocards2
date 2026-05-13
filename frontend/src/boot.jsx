// Mount the React app once API data has resolved.
//
// The actual fetches are kicked off in index.html (a tiny inline <script>
// running before this bundle downloads), so by the time we get here the
// network round-trip has already overlapped with React + bundle download.

(async function boot() {
  // One-time URL migration: the SPA used to use `#/path` hash routing.
  // Anyone with an old bookmark / Telegram link / DM-ed URL like
  // `/#/post/351` lands here — rewrite to a real path so the new router
  // (which reads location.pathname) picks it up. replaceState so we don't
  // leave a hash-form entry in browser history.
  const legacy = location.hash || '';
  if (legacy.length > 1 && legacy.startsWith('#/')) {
    history.replaceState({}, '', legacy.slice(1) + location.search);
  }

  const bootEl = document.getElementById('boot');
  try {
    const [posts, channel, author] = await window.__fpcBoot;
    window.POSTS = posts;
    window.CHANNEL = channel || { subscribers: 0 };
    window.AUTHOR = author || null;
  } catch (e) {
    console.error('Failed to load posts', e);
    if (bootEl) {
      bootEl.setAttribute('data-state', 'error');
      bootEl.innerHTML =
        '<div>Не удалось загрузить архив.</div>' +
        '<small>' + (e && e.message ? e.message : 'unknown error') +
        ' · проверьте, что backend поднят и /api/posts отвечает 200.</small>';
    }
    return;
  }
  if (bootEl) bootEl.remove();
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App/>);
})();
