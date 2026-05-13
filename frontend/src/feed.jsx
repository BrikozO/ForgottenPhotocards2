// Feed page (home) + filters + grid.

const { useMemo, useState: useState_F } = React;

function FeedPage({ posts, route, onNav, subs = 0 }) {
  const filter = route.filter || null;

  const filtered = useMemo(() => {
    if (!filter) return posts;
    return posts.filter((p) => p.type === filter);
  }, [posts, filter]);

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
          <p className="fpc-hero-sub">
            Архив плёночных и цифровых снимков Олега Якушева — города,
            архитектура, лица. Каждый пост — отдельная плёнка или серия:
            откройте, чтобы посмотреть все кадры и узнать, чем снято.
          </p>
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
        <div className="fpc-sort">
          <span>Сначала</span>
          <b>новые</b>
        </div>
      </div>

      <div className="fpc-grid">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} onOpen={(id) => onNav({ view: 'post', id })}/>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { FeedPage });
