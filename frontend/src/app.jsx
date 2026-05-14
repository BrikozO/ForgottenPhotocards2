// About page + App shell + router + Tweaks integration.

const { useState: useStateA, useEffect: useEffectA } = React;

// ─── About page ────────────────────────────────────────────────
// Author data is optional — comes from GET /api/about. If the backend
// hasn't shipped that endpoint yet, the page falls back to baked-in
// copy so the design still reads as final.
function AboutPage({ posts, author, subs = 0, onNav }) {
  const a = author || {};

  const totalPhotos = posts.reduce(
    (s, p) => s + (Array.isArray(p.photos) ? p.photos.length : 0),
    0
  );
  const filmPosts = posts.filter((p) => p.type === 'film').length;

  // Name on two lines if it splits naturally into two words
  const nameRaw = a.name || 'Oleg Iakushev';
  const nameParts = nameRaw.split(/\s+/);
  const nameNode = nameParts.length >= 2
    ? <React.Fragment>{nameParts[0]}<br/>{nameParts.slice(1).join(' ')}</React.Fragment>
    : nameRaw;

  // Bio paragraphs — array preferred, single string allowed, fallback baked in
  const bio = Array.isArray(a.bio) && a.bio.length > 0
    ? a.bio
    : (typeof a.bio === 'string' && a.bio ? [a.bio] : [
        'Снимаю на плёнку и цифру с 2019 года. Архив того, что хочется не забыть — переулки, фасады, друзья, окраины городов. То, что обычно проходит мимо.',
        'Канал в Telegram — личный фотоальбом. Каждый пост — одна плёнка или серия. Этот сайт собирает их в архив с возможностью прокликать и рассмотреть кадры крупно.',
      ]);

  // Spec rows — each conditional, so empty backend never produces empty dt/dd
  const specs = [
    a.base                  && { dt: 'База',           dd: a.base },
    a.shooting_since        && { dt: 'Снимаю с',       dd: a.shooting_since },
    a.channel_since         && { dt: 'Канал с',        dd: a.channel_since },
    posts.length > 0        && { dt: 'Постов',         dd: posts.length },
    totalPhotos > 0         && { dt: 'Кадров',         dd: totalPhotos },
    filmPosts > 0           && { dt: 'Плёнок',         dd: filmPosts },
    Number(subs) > 0        && { dt: 'Подписчиков',    dd: subs },
    a.cameras               && { dt: 'Камеры',         dd: a.cameras },
    a.email                 && { dt: 'Связь',          dd: a.email },
  ].filter(Boolean);

  const telegramHref = a.telegram || 'https://t.me/forgottenphotocards';

  return (
    <div className="fpc-main">
      <section className="fpc-about-page">
        <div className="fpc-about-left">
          <div className="fpc-hero-eyebrow">
            <span>About the author</span>
            <span className="mono">№ 002</span>
          </div>
          <h1 className="fpc-hero-title">{nameNode}</h1>
          {bio.map((p, i) => (
            <p className="fpc-about-bio-lg" key={i}>{p}</p>
          ))}
          <div style={{ marginTop: 24 }}>
            <a href={telegramHref} target="_blank" rel="noopener" className="fpc-tg-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
              <span>Подписаться в Telegram</span>
            </a>
          </div>
        </div>
        <div className="fpc-about-right">
          {specs.length > 0 && (
            <dl className="fpc-post-specs">
              {specs.map((s, i) => (
                <div className="fpc-post-spec" key={i}><dt>{s.dt}</dt><dd>{s.dd}</dd></div>
              ))}
            </dl>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── 404 ───────────────────────────────────────────────────────
// Reached either from an unknown hash (`#/whatever`), a non-root path
// (`/docs`), or a post id that doesn't exist. Uses plain <a href="/"> for
// "back to feed" so it also clears a non-root pathname, which the SPA's
// hash-only navigate() wouldn't.
function NotFoundPage() {
  return (
    <div className="fpc-main">
      <section className="fpc-hero">
        <div>
          <div className="fpc-hero-eyebrow">
            <span>Страница не найдена</span>
            <span className="mono">404</span>
          </div>
          <h1 className="fpc-hero-title">Тут пусто</h1>
          <p className="fpc-hero-sub">
            Такой страницы нет — возможно, ссылка устарела или вы перешли по
            опечатке. Архив целиком лежит в ленте.
          </p>
          <div style={{ marginTop: 24 }}>
            <a href="/" className="fpc-tg-btn">
              <span>← Вернуться в ленту</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Router (URL path → state) ─────────────────────────────────
// nginx serves index.html as the SPA fallback for any path (try_files), so
// every URL reaches this code. Unknown paths render NotFoundPage.
function parseRoute() {
  const path = (location.pathname || '/').replace(/^\/+|\/+$/g, '');
  if (path === '' || path === 'index.html') return { view: 'feed' };
  const parts = path.split('/');

  if (parts[0] === 'post' && parts[1] && parts.length === 2) {
    // Post IDs are numeric on the backend; coerce so `posts.find(p => p.id === route.id)`
    // matches under strict equality.
    const n = Number(parts[1]);
    return { view: 'post', id: Number.isFinite(n) ? n : parts[1] };
  }
  if (parts.length === 1) {
    if (parts[0] === 'about')   return { view: 'about' };
    if (parts[0] === 'admin')   return { view: 'admin' };
    if (parts[0] === 'film')    return { view: 'feed', filter: 'film' };
    if (parts[0] === 'digital') return { view: 'feed', filter: 'digital' };
  }
  return { view: 'notfound' };
}
function routeToUrl(r) {
  if (r.view === 'post')  return `/post/${r.id}`;
  if (r.view === 'about') return '/about';
  if (r.view === 'admin') return '/admin';
  if (r.filter)           return `/${r.filter}`;
  return '/';
}

// ─── Defaults: only Tweaks-editable values (typography, carousel) ─
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "typography": "grotesk",
  "carousel": "vertical"
}/*EDITMODE-END*/;

// ─── App ───────────────────────────────────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useStateA(() => parseRoute());
  const [mobileMenu, setMobileMenu] = useStateA(false);
  const [isMobile, setIsMobile] = useStateA(() => window.innerWidth < 768);

  useEffectA(() => {
    const onPop = () => setRoute(parseRoute());
    const onResize = () => setIsMobile(window.innerWidth < 768);
    // External (parent canvas) can broadcast tweak overrides — apply them.
    const onMsg = (e) => {
      const d = e.data;
      if (!d || d.type !== '__fpc_set') return;
      if (d.values && typeof d.values === 'object') {
        setTweak(d.values);
      }
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('resize', onResize);
    window.addEventListener('message', onMsg);
    // Tell parent we are ready, so it can push current tweak values on load
    try { window.parent.postMessage({ type: '__fpc_ready' }, '*'); } catch (_) {}
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('message', onMsg);
    };
  }, []);

  const navigate = (r) => {
    const url = routeToUrl(r);
    if (location.pathname !== url) {
      history.pushState({}, '', url);
    }
    // pushState doesn't fire popstate, so always sync state explicitly.
    setRoute(r);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Apply typography
  const typo = TYPOGRAPHY_PRESETS[t.typography] || TYPOGRAPHY_PRESETS.grotesk;
  useEffectA(() => {
    const root = document.documentElement;
    root.style.setProperty('--font-title', typo.title);
    root.style.setProperty('--font-body', typo.body);
    root.style.setProperty('--font-mono', typo.mono);
    root.style.setProperty('--title-w', typo.titleWeight);
    root.style.setProperty('--title-track', typo.titleTracking);
    root.style.setProperty('--logo-track', typo.logoTracking);
    root.style.setProperty('--logo-w', typo.logoWeight);
  }, [t.typography]);

  // Hold posts in state so admin edits propagate to the feed/post views
  // without a reload. Initial value is the boot snapshot from window.POSTS.
  const [posts, setPosts] = useStateA(() => Array.isArray(POSTS) ? POSTS : []);
  const safePosts = posts;
  const channel = (typeof window !== 'undefined' && window.CHANNEL) || {};
  const author = (typeof window !== 'undefined' && window.AUTHOR) || null;
  const subs = Number(channel.subscribers) || 0;

  const replacePost = (updated) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  };

  const post = route.view === 'post' ? safePosts.find((p) => p.id === route.id) : null;
  // A post route pointing at a missing id is effectively a dead link → 404.
  const isMissingPost = route.view === 'post' && !post;

  const totalPhotos = safePosts.reduce(
    (s, p) => s + (Array.isArray(p.photos) ? p.photos.length : 0),
    0
  );

  return (
    <div className="fpc-app">
      <Header
        route={route}
        onNav={navigate}
        mobile={isMobile}
        onMobileMenu={() => setMobileMenu(true)}
        photoCount={totalPhotos}
        subs={subs}
      />
      <MobileMenu open={mobileMenu} onClose={() => setMobileMenu(false)} route={route} onNav={navigate}/>

      {route.view === 'feed' && (
        <FeedPage posts={safePosts} route={route} onNav={navigate} subs={subs}/>
      )}
      {route.view === 'post' && !isMissingPost && (
        <PostPage post={post} posts={safePosts} carouselVariant={t.carousel} onNav={navigate}/>
      )}
      {route.view === 'about' && (
        <AboutPage posts={safePosts} author={author} subs={subs} onNav={navigate}/>
      )}
      {route.view === 'admin' && (
        <AdminPage posts={safePosts} onPostUpdated={replacePost}/>
      )}
      {(route.view === 'notfound' || isMissingPost) && <NotFoundPage/>}

      <Footer mobile={isMobile}/>

      <TweaksPanel>
        <TweakSection label="Typography"/>
        <TweakSelect
          label="Шрифты"
          value={t.typography}
          options={[
            { value: 'grotesk', label: 'Grotesk · Space Grotesk + JetBrains Mono' },
            { value: 'geist',   label: 'Geist · Geist Sans + Geist Mono' },
            { value: 'manrope', label: 'Manrope · Manrope + IBM Plex Mono' },
          ]}
          onChange={(v) => setTweak('typography', v)}
        />
        <TweakSection label="Просмотр поста"/>
        <TweakRadio
          label="Карусель"
          value={t.carousel}
          options={[
            { value: 'arrows',   label: 'A · Стрелки + миниатюры' },
            { value: 'dots',     label: 'B · Стрелки + точки' },
            { value: 'vertical', label: 'C · Вертикальная лента' },
            { value: 'grid',     label: 'D · Сетка + лайтбокс' },
          ]}
          onChange={(v) => setTweak('carousel', v)}
        />
        <div className="fpc-tweak-hint">
          Откройте любой пост — внутри переключайте карусель в&nbsp;real-time.
        </div>
      </TweaksPanel>
    </div>
  );
}

Object.assign(window, { AboutPage, App });
