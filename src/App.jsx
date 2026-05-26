import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight, Search, Sparkles, WandSparkles
} from 'lucide-react';
import { copy } from './i18n';
import {
  fallbackRepoUrl, takeDistinctCases, HERO_CASE_COUNT, HOT_STRIP_CASE_COUNT,
  orderByLibrary, localizeLabel, normalizeFavoriteRows, getAuthHeaders
} from './utils';
import { useGaPageViews, useCopy } from './hooks';
import { isSupabaseConfigured, supabase } from './supabaseClient';
import Hero from './components/Hero';
import FilterPill from './components/FilterPill';
import LanguageSwitch from './components/LanguageSwitch';
import CommunityNavItem from './components/CommunityNavItem';
import UserMenu from './components/UserMenu';
import PromptCard from './components/PromptCard';
import PreviewDialog from './components/PreviewDialog';
import AuthModal from './components/AuthModal';
import AccountPanel from './components/AccountPanel';
import AdminPanel from './components/AdminPanel';
import BillingPanel from './components/BillingPanel';
import SkillSection from './components/SkillSection';
import TemplateSection from './components/TemplateSection';
import GenerationHistory from './components/GenerationHistory';
import './App.css';

function App() {
  useGaPageViews();
  const [siteData, setSiteData] = useState(null);
  const [styleLibrary, setStyleLibrary] = useState(null);
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [style, setStyle] = useState('All');
  const [scene, setScene] = useState('All');
  const [preview, setPreview] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [phpSession, setPhpSession] = useState(false);
  const [favoriteRows, setFavoriteRows] = useState([]);
  const [favoriteBusyId, setFavoriteBusyId] = useState(null);
  const [favoriteMessage, setFavoriteMessage] = useState('');
  const [authOpen, setAuthOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountInitialSection, setAccountInitialSection] = useState('overview');
  const [adminOpen, setAdminOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(72);
  const [billingOpen, setBillingOpen] = useState(false);
  const [billingNotice, setBillingNotice] = useState('');
  const { copiedId, copyPrompt, copyText } = useCopy();
  const repoUrl = siteData?.repository || fallbackRepoUrl;
  const t = copy[language] || copy.en;

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/cases.json').then((response) => response.json()),
      fetch('/style-library.json').then((response) => response.json())
    ])
      .then(([payload, library]) => {
        if (!cancelled) {
          setSiteData(payload);
          setStyleLibrary(library);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSiteData({ cases: [], categories: [], styles: [], scenes: [], totalCases: 0 });
          setStyleLibrary({ categories: [], styles: [], scenes: [], templates: [], tagLabels: {} });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) return undefined;

    let cancelled = false;
    fetch('/api/me')
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload?.ok && payload.user) {
          setPhpSession(true);
          setSession({ phpSession: true });
          setProfile(payload.user);
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!session?.access_token && !session?.phpSession) {
      setProfile(null);
      setFavoriteRows([]);
      return () => {
        cancelled = true;
      };
    }

    fetch('/api/me', {
      headers: getAuthHeaders(session)
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload?.ok) {
          setProfile(payload.user);
        }
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, session?.phpSession]);

  async function loadFavorites({ silent = true } = {}) {
    if (!session?.access_token && !session?.phpSession) {
      setFavoriteRows([]);
      return [];
    }

    try {
      const response = await fetch('/api/favorites', {
        headers: getAuthHeaders(session)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload.error || 'FAVORITES_LOAD_FAILED');
      }
      const favorites = normalizeFavoriteRows(payload.favorites);
      setFavoriteRows(favorites);
      return favorites;
    } catch {
      if (!silent) setTimedFavoriteMessage(t.favoriteFailed);
      return [];
    }
  }

  useEffect(() => {
    let cancelled = false;

    if (!session?.access_token && !session?.phpSession) {
      setFavoriteRows([]);
      return () => {
        cancelled = true;
      };
    }

    loadFavorites().then((favorites) => {
      if (cancelled) return;
      setFavoriteRows(favorites);
    });

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, session?.phpSession]);

  useEffect(() => {
    setVisibleCount(72);
  }, [query, category, style, scene]);

  useEffect(() => {
    if (!siteData || !styleLibrary || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    if (!target) return;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'start' });
    });
  }, [siteData, styleLibrary]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get('billing');
    if (!billing) return;
    if (billing === 'success') setBillingNotice(t.billingSuccess);
    if (billing === 'cancelled') setBillingNotice(t.billingCancelled);
    setBillingOpen(true);
    params.delete('billing');
    params.delete('session_id');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  }, [t.billingCancelled, t.billingSuccess]);

  const latestCases = useMemo(() => {
    if (!siteData) return [];
    return [...siteData.cases].sort((a, b) => b.id - a.id);
  }, [siteData]);

  const heroCases = useMemo(
    () => takeDistinctCases(latestCases, HERO_CASE_COUNT),
    [latestCases]
  );

  const hotStripCases = useMemo(
    () => takeDistinctCases(
      latestCases,
      HOT_STRIP_CASE_COUNT,
      new Set(heroCases.map((caseItem) => caseItem.id))
    ),
    [heroCases, latestCases]
  );

  const filteredCases = useMemo(() => {
    if (!siteData) return [];
    const q = query.trim().toLowerCase();
    return siteData.cases.filter((item) => {
      const matchQuery =
        !q ||
        `${item.id} ${item.title} ${item.category} ${item.prompt} ${item.sourceLabel}`
          .toLowerCase()
          .includes(q);
      const matchCategory = category === 'All' || item.category === category;
      const matchStyle = style === 'All' || (item.styles || []).includes(style);
      const matchScene = scene === 'All' || (item.scenes || []).includes(scene);
      return matchQuery && matchCategory && matchStyle && matchScene;
    });
  }, [siteData, query, category, style, scene]);

  const orderedCategories = useMemo(
    () => (siteData && styleLibrary ? orderByLibrary(siteData.categories, styleLibrary.categories) : []),
    [siteData, styleLibrary]
  );
  const orderedStyles = useMemo(
    () => (siteData && styleLibrary ? orderByLibrary(siteData.styles, styleLibrary.styles) : []),
    [siteData, styleLibrary]
  );
  const orderedScenes = useMemo(
    () => (siteData && styleLibrary ? orderByLibrary(siteData.scenes, styleLibrary.scenes) : []),
    [siteData, styleLibrary]
  );

  const visibleCases = filteredCases.slice(0, visibleCount);
  const hasMore = filteredCases.length > visibleCases.length;
  const loadMore = useCallback(() => setVisibleCount((n) => n + 72), []);
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);
  const casesById = useMemo(() => new Map((siteData?.cases || []).map((caseItem) => [caseItem.id, caseItem])), [siteData]);
  const favoriteCaseIds = useMemo(
    () => new Set(normalizeFavoriteRows(favoriteRows).map((favorite) => favorite.caseId)),
    [favoriteRows]
  );

  async function handleSignOut() {
    if (session?.phpSession) {
      await fetch('/api/auth.php?action=logout').catch(() => {});
      setPhpSession(false);
    }
    if (supabase) await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    setFavoriteRows([]);
    setAccountOpen(false);
    setAdminOpen(false);
    setBillingOpen(false);
  }

  function handlePhpSignIn(userData) {
    const user = userData?.id ? userData : null;
    setPhpSession(Boolean(user));
    setSession(user ? { phpSession: true } : null);
    if (user) setProfile(user);
  }

  function handleProfileChange(nextProfile) {
    if (nextProfile) setProfile(nextProfile);
  }

  function handleFilterChange(setter, value) {
    setter(value);
    setTimeout(() => {
      const el = document.querySelector('.caseGrid') || document.getElementById('gallery');
      if (el) {
        const top = el.getBoundingClientRect().top + window.pageYOffset - 84;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    }, 100);
  }

  function handleOpenCaseFromAccount(caseItem) {
    setAccountOpen(false);
    setAccountInitialSection('overview');
    setBillingOpen(false);
    setPreview({ type: 'case', item: caseItem });
  }

  function handleOpenCaseFromAdmin(caseItem) {
    setAdminOpen(false);
    setPreview({ type: 'case', item: caseItem });
  }

  function setTimedFavoriteMessage(message) {
    setFavoriteMessage(message);
    window.setTimeout(() => {
      setFavoriteMessage((current) => (current === message ? '' : current));
    }, 2400);
  }

  async function handleToggleFavorite(caseItem) {
    if (!caseItem?.id) return;
    if (!session?.access_token && !session?.phpSession) {
      setAuthOpen(true);
      setTimedFavoriteMessage(t.signInToFavorite);
      return;
    }

    const caseId = Number(caseItem.id);
    const isFavorite = favoriteCaseIds.has(caseId);
    const previousRows = favoriteRows;
    setFavoriteBusyId(caseId);

    if (isFavorite) {
      setFavoriteRows((current) => normalizeFavoriteRows(current).filter((favorite) => favorite.caseId !== caseId));
    } else {
      setFavoriteRows((current) => [
        { caseId, createdAt: new Date().toISOString() },
        ...normalizeFavoriteRows(current).filter((favorite) => favorite.caseId !== caseId)
      ]);
    }

    try {
      const response = await fetch(isFavorite ? `/api/favorites?caseId=${caseId}` : '/api/favorites', {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: {
          ...(isFavorite ? {} : { 'Content-Type': 'application/json' }),
          ...getAuthHeaders(session)
        },
        body: isFavorite ? undefined : JSON.stringify({ caseId })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.ok) {
        if (payload.error === 'AUTH_REQUIRED' || payload.loginRequired) setAuthOpen(true);
        throw new Error(payload.error || 'FAVORITE_FAILED');
      }

      if (!isFavorite && payload.favorite) {
        const favorite = normalizeFavoriteRows([payload.favorite])[0];
        if (favorite) {
          setFavoriteRows((current) => [
            favorite,
            ...normalizeFavoriteRows(current).filter((item) => item.caseId !== caseId)
          ]);
        }
      }
      setTimedFavoriteMessage(isFavorite ? t.favoriteRemoved : t.favoriteSaved);
    } catch {
      setFavoriteRows(previousRows);
      setTimedFavoriteMessage(t.favoriteFailed);
    } finally {
      setFavoriteBusyId(null);
    }
  }

  function handleOpenAccount(section = 'overview') {
    setAccountInitialSection(section);
    setAccountOpen(true);
    if (section === 'favorites') {
      loadFavorites({ silent: false });
    }
  }

  function handleCloseAccount() {
    setAccountOpen(false);
    setAccountInitialSection('overview');
  }

  if (!siteData || !styleLibrary) {
    return (
      <main>
        <div className="loadingScreen">
          <WandSparkles size={28} />
          <span>{t.loading}</span>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#">
          <WandSparkles size={21} />
          {t.brand}
        </a>
        <div className="topbarControls">
          <nav>
            <a href="#gallery">{t.navCases}</a>
            <a href="#templates">{t.navTemplates}</a>
            <a href="#agent-skill">{t.navSkill}</a>
            <CommunityNavItem language={language} onFreeCreate={() => setPreview({ type: 'free' })} />
            <a href={repoUrl} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
          <LanguageSwitch language={language} setLanguage={setLanguage} />
          <UserMenu
            language={language}
            session={session}
            profile={profile}
            onSignIn={() => setAuthOpen(true)}
            onSignOut={handleSignOut}
            onAccount={() => handleOpenAccount('overview')}
            onFavorites={() => handleOpenAccount('favorites')}
            onHistory={() => setHistoryOpen(true)}
            onAdmin={() => setAdminOpen(true)}
            onBilling={() => {
              setBillingNotice('');
              setBillingOpen(true);
            }}
          />
        </div>
      </header>
      {favoriteMessage ? <div className="toastNotice">{favoriteMessage}</div> : null}

      <Hero
        latestCases={heroCases}
        language={language}
        repoUrl={repoUrl}
        totalCases={siteData.totalCases}
        categoryCount={siteData.categories.length}
        onOpenCase={(item) => setPreview({ type: 'case', item })}
      />

      <section className="hotStrip">
        {hotStripCases.map((caseItem) => (
          <button
            type="button"
            aria-label={`${language === 'zh' ? '打开案例' : 'Open case'} ${caseItem.id}: ${caseItem.title}`}
            onClick={() => setPreview({ type: 'case', item: caseItem })}
            key={caseItem.id}
          >
            <img src={caseItem.image} alt={caseItem.imageAlt} />
            <span>#{caseItem.id}</span>
          </button>
        ))}
      </section>

      <section className="gallerySection" id="gallery">
        <div className="sectionHead">
          <div>
            <span className="eyebrow">{t.sectionEyebrow}</span>
            <h2>{t.sectionTitle}</h2>
          </div>
          <div className="searchBox">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t.search}
            />
          </div>
        </div>

        <div className="filterPanel">
          <div>
            <strong>{t.category}</strong>
            <div className="filterRow">
              <FilterPill active={category === 'All'} onClick={() => handleFilterChange(setCategory, 'All')}>{t.all}</FilterPill>
              {orderedCategories.map((item) => (
                <FilterPill key={item} active={category === item} onClick={() => handleFilterChange(setCategory, item)}>
                  {localizeLabel(item, language, styleLibrary)}
                </FilterPill>
              ))}
            </div>
          </div>
          <div>
            <strong>{t.style}</strong>
            <div className="filterRow">
              <FilterPill active={style === 'All'} onClick={() => handleFilterChange(setStyle, 'All')}>{t.all}</FilterPill>
              {orderedStyles.map((item) => (
                <FilterPill key={item} active={style === item} onClick={() => handleFilterChange(setStyle, item)}>
                  {localizeLabel(item, language, styleLibrary)}
                </FilterPill>
              ))}
            </div>
          </div>
          <div>
            <strong>{t.scene}</strong>
            <div className="filterRow">
              <FilterPill active={scene === 'All'} onClick={() => handleFilterChange(setScene, 'All')}>{t.all}</FilterPill>
              {orderedScenes.map((item) => (
                <FilterPill key={item} active={scene === item} onClick={() => handleFilterChange(setScene, item)}>
                  {localizeLabel(item, language, styleLibrary)}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>

        <div className="resultBar">
          <span>{language === 'zh' ? `${filteredCases.length} ${t.matching}` : `${filteredCases.length} ${t.matching}`}</span>
          <a href={repoUrl} target="_blank" rel="noreferrer">
            {t.openGithub}
            <ArrowUpRight size={16} />
          </a>
        </div>

        <div className="caseGrid">
          {visibleCases.map((caseItem) => (
            <PromptCard
              caseItem={caseItem}
              copied={copiedId === `case-${caseItem.id}`}
              favorited={favoriteCaseIds.has(caseItem.id)}
              favoriteBusy={favoriteBusyId === caseItem.id}
              language={language}
              onCopy={copyPrompt}
              onOpen={(item) => setPreview({ type: 'case', item })}
              onGenerate={(item) => {
                setPreview({ type: 'case', item });
                if (!session?.access_token && !session?.phpSession) setAuthOpen(true);
              }}
              onToggleFavorite={handleToggleFavorite}
              styleLibrary={styleLibrary}
              key={caseItem.id}
            />
          ))}
        </div>

        {hasMore && (
          <div className="loadMoreBar">
            <span>{language === 'zh'
              ? `已显示 ${visibleCases.length} / ${filteredCases.length} 个案例`
              : `Showing ${visibleCases.length} of ${filteredCases.length} cases`}
            </span>
            <button type="button" onClick={loadMore}>
              {language === 'zh' ? '加载更多' : 'Load more'}
            </button>
          </div>
        )}
        <div ref={sentinelRef} className="loadMoreSentinel" />
      </section>

      <TemplateSection
        language={language}
        styleLibrary={styleLibrary}
        onOpenTemplate={(item) => setPreview({ type: 'template', item })}
      />

      <SkillSection language={language} repoUrl={repoUrl} />
      <PreviewDialog
        preview={preview}
        language={language}
        styleLibrary={styleLibrary}
        copiedId={copiedId}
        session={session}
        profile={profile}
        favorite={preview?.type === 'case' ? favoriteCaseIds.has(preview.item.id) : false}
        favoriteBusy={preview?.type === 'case' && favoriteBusyId === preview.item.id}
        onClose={() => setPreview(null)}
        onCopyText={copyText}
        onToggleFavorite={handleToggleFavorite}
        onAuthRequired={() => setAuthOpen(true)}
        onBillingRequired={() => {
          setBillingNotice(t.creditsRequired);
          setBillingOpen(true);
        }}
        onProfileChange={handleProfileChange}
      />
      <AuthModal
        open={authOpen}
        language={language}
        onClose={() => setAuthOpen(false)}
        onSignIn={handlePhpSignIn}
      />
      <AccountPanel
        open={accountOpen}
        language={language}
        session={session}
        profile={profile}
        casesById={casesById}
        favoriteRows={favoriteRows}
        initialSection={accountInitialSection}
        onClose={handleCloseAccount}
        onProfileChange={handleProfileChange}
        onOpenCase={handleOpenCaseFromAccount}
        onBilling={() => {
          setAccountOpen(false);
          setBillingNotice('');
          setBillingOpen(true);
        }}
      />
      <AdminPanel
        open={adminOpen}
        language={language}
        session={session}
        casesById={casesById}
        onClose={() => setAdminOpen(false)}
        onOpenCase={handleOpenCaseFromAdmin}
      />
      <GenerationHistory
        open={historyOpen}
        language={language}
        onClose={() => setHistoryOpen(false)}
      />
      <BillingPanel
        open={billingOpen}
        language={language}
        session={session}
        profile={profile}
        notice={billingNotice}
        casesById={casesById}
        onClose={() => setBillingOpen(false)}
        onAuthRequired={() => setAuthOpen(true)}
        onProfileChange={handleProfileChange}
        onOpenCase={handleOpenCaseFromAccount}
      />
    </main>
  );
}

export default App;
