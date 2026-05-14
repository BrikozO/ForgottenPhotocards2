// Feed page (home) + filters + grid.

const { useMemo, useState: useState_F } = React;

function FeedPage({ posts, route, onNav, subs = 0 }) {
  const filter = route.filter || null;
  const [sort, setSort] = useState_F('desc'); // 'desc' = новые сначала, 'asc' = старые сначала
  const gridRef = useRef(null);

  const filtered = useMemo(() => {
    const base = filter ? posts.filter((p) => p.type === filter) : posts;
    const arr = base.slice();
    arr.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      const diff = db - da;
      const tie = (Number(b.id) || 0) - (Number(a.id) || 0);
      const ordered = diff !== 0 ? diff : tie;
      return sort === 'desc' ? ordered : -ordered;
    });
    return arr;
  }, [posts, filter, sort]);

  // Replay the card-pop animation each time the order changes.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    el.classList.remove('is-sorted-anim');
    // Force reflow so the animation restarts on consecutive toggles.
    void el.offsetWidth;
    el.classList.add('is-sorted-anim');
  }, [sort, filter]);

  const toggleSort = () => setSort((s) => (s === 'desc' ? 'asc' : 'desc'));

  const counts = useMemo(() => ({
    all: posts.length,
    film: posts.filter((p) => p.type === 'film').length,
    digital: posts.filter((p) => p.type === 'digital').length,
  }), [posts]);

  const totalPhotos = useMemo(
    () => posts.reduce(
      (sum, p) => sum + (Array.isArray(p.photos) ? p.photos.length : 0),
      0
    ),
    [posts]
  );

  return (
    <div className="fpc-main">
      <section className="fpc-hero">
        <div>
          <div className="fpc-hero-eyebrow">
            <span>Personal photo-album</span>
            <span className="mono">№ 001</span>
          </div>
          <h1 className="fpc-hero-title">
            Забытые<br/>фотокарточки
          </h1>
          <blockquote className="fpc-hero-sub fpc-hero-quote">
            «Приятнее всего дарить человеку не вещи, а воспоминания о&nbsp;чём‑то прожитом вместе».
            <cite>— Одри Тоту</cite>
          </blockquote>
        </div>
        <div className="fpc-hero-side">
          <div className="fpc-hero-stat">
            <b>{posts.length}</b>
            <span>{plural(posts.length, PL.posts)}</span>
          </div>
          <div className="fpc-hero-stat">
            <b>{totalPhotos}</b>
            <span>{plural(totalPhotos, PL.photocards)}</span>
          </div>
          <div className="fpc-hero-stat">
            <b>{Number(subs) || 0}</b>
            <span>{plural(Number(subs) || 0, PL.subscribers)}</span>
          </div>
        </div>
      </section>

      <div className="fpc-toolbar">
        <FilterChips active={filter} onChange={(id) => onNav({ view: 'feed', filter: id || undefined })} counts={counts}/>
        <button
          type="button"
          className="fpc-sort fpc-sort-toggle"
          onClick={toggleSort}
          data-sort={sort}
          aria-label={sort === 'desc' ? 'Сначала новые. Переключить на сначала старые.' : 'Сначала старые. Переключить на сначала новые.'}
        >
          <span>Сначала</span>
          <span className="fpc-sort-flip">
            <b key={sort}>{sort === 'desc' ? 'новые' : 'старые'}</b>
          </span>
          <svg className="fpc-sort-arrow" width="9" height="11" viewBox="0 0 9 11" fill="none" aria-hidden="true">
            <path d="M4.5 0.5V10M4.5 10L1 6.5M4.5 10L8 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="fpc-grid" ref={gridRef}>
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} onOpen={(id) => onNav({ view: 'post', id })}/>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { FeedPage });
