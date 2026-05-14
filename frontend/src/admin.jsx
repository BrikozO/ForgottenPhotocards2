// Admin page — token login + post editor (description, type).
//
// Reachable at /admin. The link is not surfaced anywhere in the public UI;
// nginx's SPA fallback returns index.html for unknown paths so this route
// boots like any other page.
//
// Auth model: the token lives in component state only (no localStorage), so
// closing the tab logs out. The login endpoint is just a verifier — every
// real mutation re-sends the bearer header, and the backend enforces it.

function AdminPage({ posts, onPostUpdated }) {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Editor state
  const [selectedId, setSelectedId] = useState(null);
  const [description, setDescription] = useState('');
  const [type, setType] = useState('film');
  const [editedFlag, setEditedFlag] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '', 'saving', 'saved', 'error:<msg>'

  // Filter for the post picker
  const [query, setQuery] = useState('');

  const sortedPosts = useMemo(() => {
    const arr = (posts || []).slice();
    arr.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    return arr;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedPosts;
    return sortedPosts.filter((p) => {
      const haystack = `${p.id} ${p.title || ''} ${p.location || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [sortedPosts, query]);

  const selectedPost = useMemo(
    () => (posts || []).find((p) => p.id === selectedId) || null,
    [posts, selectedId]
  );

  const submitLogin = async (e) => {
    e.preventDefault();
    setLoginErr('');
    setBusy(true);
    try {
      const r = await window.adminLogin(token);
      if (r.ok) {
        setAuthed(true);
      } else {
        setLoginErr(r.error || 'Не удалось войти');
      }
    } catch (err) {
      setLoginErr((err && err.message) || 'Сетевая ошибка');
    } finally {
      setBusy(false);
    }
  };

  const choosePost = (p) => {
    setSelectedId(p.id);
    setDescription(p.description || '');
    setType(p.type || 'film');
    setEditedFlag(!!p.description_edited);
    setSaveStatus('');
  };

  const save = async (e) => {
    e.preventDefault();
    if (!selectedPost) return;
    setSaveStatus('saving');
    const patch = {};
    if (description !== (selectedPost.description || '')) patch.description = description;
    if (type !== (selectedPost.type || 'film'))          patch.type        = type;
    if (Object.keys(patch).length === 0) {
      setSaveStatus('saved');
      return;
    }
    try {
      const updated = await window.adminUpdatePost(token, selectedPost.id, patch);
      // Reflect server truth in the form (description_edited may have just flipped).
      setEditedFlag(!!updated.description_edited);
      setDescription(updated.description || '');
      setType(updated.type || 'film');
      onPostUpdated && onPostUpdated(updated);
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error:' + ((err && err.message) || 'unknown'));
    }
  };

  const dirty = selectedPost && (
    description !== (selectedPost.description || '') ||
    type        !== (selectedPost.type || 'film')
  );

  if (!authed) {
    return (
      <div className="fpc-main fpc-admin-shell">
        <section className="fpc-admin-login">
          <div className="fpc-hero-eyebrow">
            <span>Admin · Service area</span>
            <span className="mono">№ 000</span>
          </div>
          <h1 className="fpc-hero-title">Вход</h1>
          <p className="fpc-hero-sub" style={{ marginBottom: 24 }}>
            Введите секретный токен. Он задаётся переменной окружения
            <span className="mono"> FPC_ADMIN_TOKEN</span> на сервере.
          </p>
          <form onSubmit={submitLogin} className="fpc-admin-form">
            <label className="fpc-admin-label">
              <span>Токен</span>
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="••••••••••••••••"
                className="fpc-admin-input mono"
                autoFocus
              />
            </label>
            {loginErr && <div className="fpc-admin-err">{loginErr}</div>}
            <button
              type="submit"
              className="fpc-tg-btn"
              disabled={busy || !token.trim()}
              style={{ alignSelf: 'flex-start' }}
            >
              <span>{busy ? 'Проверка…' : 'Войти'}</span>
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="fpc-main fpc-admin-shell">
      <section className="fpc-admin">
        <div className="fpc-hero-eyebrow">
          <span>Admin · Posts</span>
          <span className="mono">№ 000</span>
        </div>
        <h1 className="fpc-hero-title">Редактор постов</h1>

        <div className="fpc-admin-layout">
          <aside className="fpc-admin-sidebar">
            <div className="fpc-admin-search">
              <input
                type="search"
                placeholder="Поиск по № / названию / локации"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="fpc-admin-input"
              />
              <div className="fpc-admin-search-hint mono">
                {filteredPosts.length} / {sortedPosts.length}
              </div>
            </div>
            <ol className="fpc-admin-list">
              {filteredPosts.map((p) => (
                <li
                  key={p.id}
                  data-active={p.id === selectedId ? '1' : '0'}
                  onClick={() => choosePost(p)}
                >
                  <div className="fpc-admin-list-top">
                    <span className="mono">№ {p.id}</span>
                    <span
                      className="fpc-card-type"
                      data-type={p.type}
                      style={{ borderRadius: 999, padding: '2px 7px' }}
                    >
                      {p.type === 'film' ? 'Плёнка' : 'Цифра'}
                    </span>
                    {p.description_edited && (
                      <span className="fpc-admin-edited-pill mono">edited</span>
                    )}
                  </div>
                  <div className="fpc-admin-list-title">{p.title || '—'}</div>
                  <div className="fpc-admin-list-sub mono">
                    {p.location ? p.location + ' · ' : ''}
                    {p.date}
                  </div>
                </li>
              ))}
              {filteredPosts.length === 0 && (
                <li className="fpc-admin-list-empty">Ничего не найдено</li>
              )}
            </ol>
          </aside>

          <main className="fpc-admin-editor">
            {!selectedPost ? (
              <div className="fpc-admin-empty">
                <p>Выберите пост слева, чтобы отредактировать его описание и тип.</p>
              </div>
            ) : (
              <form onSubmit={save} className="fpc-admin-form">
                <div className="fpc-admin-editor-head">
                  <div>
                    <div className="fpc-admin-eyebrow mono">№ {selectedPost.id} · {selectedPost.date}</div>
                    <h2 className="fpc-admin-title">{selectedPost.title || '—'}</h2>
                  </div>
                  {selectedPost.photos && selectedPost.photos[0] && (
                    <a
                      href={`/post/${selectedPost.id}`}
                      target="_blank"
                      rel="noopener"
                      className="fpc-admin-preview"
                      title="Открыть пост на сайте"
                    >
                      <img src={selectedPost.photos[0].src} alt=""/>
                    </a>
                  )}
                </div>

                <label className="fpc-admin-label">
                  <span>Тип</span>
                  <div className="fpc-admin-radios">
                    <label className="fpc-admin-radio">
                      <input
                        type="radio"
                        name="type"
                        value="film"
                        checked={type === 'film'}
                        onChange={() => setType('film')}
                      />
                      <span>Плёнка</span>
                    </label>
                    <label className="fpc-admin-radio">
                      <input
                        type="radio"
                        name="type"
                        value="digital"
                        checked={type === 'digital'}
                        onChange={() => setType('digital')}
                      />
                      <span>Цифра</span>
                    </label>
                  </div>
                </label>

                <label className="fpc-admin-label">
                  <span>
                    Описание
                    {editedFlag && (
                      <span className="fpc-admin-edited-pill mono" style={{ marginLeft: 10 }}>
                        edited · scraper skips
                      </span>
                    )}
                  </span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={12}
                    className="fpc-admin-input fpc-admin-textarea"
                    placeholder="Текст, который видят посетители на странице поста."
                  />
                  <span className="fpc-admin-hint mono">
                    После сохранения описание перестанет переписываться парсером.
                  </span>
                </label>

                <div className="fpc-admin-actions">
                  <button
                    type="submit"
                    className="fpc-tg-btn"
                    disabled={!dirty || saveStatus === 'saving'}
                  >
                    <span>
                      {saveStatus === 'saving' ? 'Сохраняем…' :
                       saveStatus === 'saved'  ? 'Сохранено ✓' :
                       'Сохранить'}
                    </span>
                  </button>
                  {saveStatus.startsWith('error:') && (
                    <span className="fpc-admin-err">{saveStatus.slice(6)}</span>
                  )}
                </div>
              </form>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { AdminPage });
