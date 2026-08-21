/* ===== Shared behaviour: nav, language switch, tabs, journey filter, events scroll ===== */
document.addEventListener('DOMContentLoaded', () => {
  initNavToggle();
  initLanguageSwitch();
  initTabs();
  initJourneyFilter();
  initDragScroll();
  initScrollReveal();
  initHeaderScroll();
  initHeroArt();
  initPetals();
  initBackToTop();
});

/* True when the visitor has asked the OS for reduced motion. */
function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initNavToggle() {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.querySelector('nav.main-nav ul');
  if (!toggle || !menu) return;
  toggle.addEventListener('click', () => menu.classList.toggle('open'));

  // Mobile: tap a dropdown parent to expand its submenu.
  document.querySelectorAll('nav.main-nav li.has-dropdown > a').forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 900) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });
}

function initLanguageSwitch() {
  const buttons = document.querySelectorAll('.lang-bar button[data-lang]');
  if (!buttons.length) return;

  const savedLang = localStorage.getItem('site-lang') || 'en';
  applyLanguage(savedLang);

  buttons.forEach(btn => {
    if (btn.dataset.lang === savedLang) btn.classList.add('active');
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const lang = btn.dataset.lang;
      localStorage.setItem('site-lang', lang);
      applyLanguage(lang);
    });
  });
}

/* ---- Translation engine ----
   Two passes, so a page translates fully:
   1. Elements carrying data-i18n are set from their key.
   2. Every other text node is matched against the English dictionary values,
      which lets untagged headings, lists and paragraphs translate as well.
   The English original of each node is snapshotted once on load, so switching
   back to English always restores the exact source text. */

let KEYED_NODES = null;   // [{ el, key }]
let TEXT_NODES = null;    // [{ node, en }]
const TEXT_MAPS = {};     // lang -> Map(normalised English -> translation)

/* Collapses newlines and repeated spaces so HTML wrapping never breaks a match. */
function normaliseText(str) {
  return str.replace(/\s+/g, ' ').trim();
}

function snapshotPage() {
  KEYED_NODES = [];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    KEYED_NODES.push({ el: el, key: el.getAttribute('data-i18n'), en: el.textContent });
  });

  TEXT_NODES = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      if (!normaliseText(node.nodeValue)) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('script, style, .lang-bar, .to-top')) return NodeFilter.FILTER_REJECT;
      // Handled by the key pass instead.
      if (parent.closest('[data-i18n]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let node;
  while ((node = walker.nextNode())) TEXT_NODES.push({ node: node, en: node.nodeValue });
}

/* English text -> translated text, built from every key in the dictionary. */
function textMapFor(lang) {
  if (TEXT_MAPS[lang]) return TEXT_MAPS[lang];
  const map = new Map();
  Object.keys(I18N.en).forEach(key => {
    const source = I18N.en[key];
    const target = I18N[lang] && I18N[lang][key];
    if (source && target) map.set(normaliseText(source), target);
  });
  TEXT_MAPS[lang] = map;
  return map;
}

function applyLanguage(lang) {
  if (typeof I18N === 'undefined' || !I18N[lang]) return;
  if (!TEXT_NODES) snapshotPage();

  const dict = I18N[lang];
  KEYED_NODES.forEach(item => {
    const value = dict[item.key];
    item.el.textContent = value ? value : item.en;
  });

  const map = lang === 'en' ? null : textMapFor(lang);
  TEXT_NODES.forEach(item => {
    if (!map) { item.node.nodeValue = item.en; return; }
    const translated = map.get(normaliseText(item.en));
    if (!translated) { item.node.nodeValue = item.en; return; }
    // Keep the original surrounding whitespace so inline text stays spaced.
    const edges = item.en.match(/^(\s*)[\s\S]*?(\s*)$/);
    item.node.nodeValue = edges[1] + translated + edges[2];
  });

  document.documentElement.setAttribute('lang', lang);
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tabs-nav button[data-tab]');
  if (!tabButtons.length) return;
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

function initJourneyFilter() {
  const filterButtons = document.querySelectorAll('.journey-filter button[data-filter]');
  const rows = document.querySelectorAll('table.journeys-table tbody tr');
  if (!filterButtons.length || !rows.length) return;
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      rows.forEach(row => {
        row.style.display = (filter === 'all' || row.dataset.status === filter) ? '' : 'none';
      });
    });
  });
}

/* Enables click-and-drag horizontal scrolling for tables/events (left-to-right readability). */
function initDragScroll() {
  document.querySelectorAll('.scroll-x, .events-scroll').forEach(el => {
    let isDown = false, startX, scrollLeft;
    el.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    });
    ['mouseleave', 'mouseup'].forEach(evt => el.addEventListener(evt, () => isDown = false));
    el.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      el.scrollLeft = scrollLeft - (x - startX) * 1.2;
    });
  });
}

/* Fades content in as it enters the viewport.
   The .reveal class is added here (not in the HTML) so that without JS
   or IntersectionObserver every section simply stays visible. */
function initScrollReveal() {
  if (prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  const selector = '.section-title, .card, .initiative-card, .contact-card, ' +
                   '.journey-detail, .events-scroll .event-card, .note-box, ' +
                   'form.enquiry, .content-page .prose > *';
  const items = document.querySelectorAll(selector);
  if (!items.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('in-view');
      obs.unobserve(el);
      // Drop the stagger delay once revealed, so hover effects stay instant.
      setTimeout(() => { el.style.transitionDelay = ''; }, Number(el.dataset.revealDelay) + 900);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => {
    el.classList.add('reveal');
    // Stagger siblings so a row of cards lights up one after another.
    const delay = Math.min(Array.from(el.parentElement.children).indexOf(el), 5) * 90;
    el.dataset.revealDelay = delay;
    el.style.transitionDelay = delay + 'ms';
    observer.observe(el);
  });
}

/* Compacts the sticky header once the page is scrolled. */
function initHeaderScroll() {
  const header = document.querySelector('header.site-header');
  if (!header) return;
  const update = () => header.classList.toggle('scrolled', window.scrollY > 40);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* Builds the hero artwork: aarti glow, a temple gopuram skyline and a row of
   lit diyas. Injected here so every page's hero gets it without markup changes. */
function initHeroArt() {
  const hero = document.querySelector('.hero');
  if (!hero || hero.querySelector('.hero-skyline')) return;

  const glow = document.createElement('div');
  glow.className = 'hero-glow';

  const skyline = document.createElement('div');
  skyline.className = 'hero-skyline';

  const lamps = document.createElement('div');
  lamps.className = 'hero-lamps';
  for (let i = 0; i < 5; i++) lamps.appendChild(document.createElement('i'));

  hero.appendChild(glow);
  hero.appendChild(skyline);
  hero.appendChild(lamps);
}

/* Pushpa vrushti - a slow shower of marigold petals over the hero banner. */
function initPetals() {
  const hero = document.querySelector('.hero');
  if (!hero || prefersReducedMotion()) return;

  for (let i = 0; i < 14; i++) {
    const petal = document.createElement('span');
    petal.className = 'petal';
    petal.style.left = Math.random() * 100 + '%';
    petal.style.animationDuration = (9 + Math.random() * 9).toFixed(1) + 's';
    petal.style.animationDelay = (Math.random() * 12).toFixed(1) + 's';
    const scale = 0.7 + Math.random() * 0.9;
    petal.style.width = (10 * scale).toFixed(1) + 'px';
    petal.style.height = (14 * scale).toFixed(1) + 'px';
    petal.style.opacity = (0.45 + Math.random() * 0.4).toFixed(2);
    hero.appendChild(petal);
  }
}

/* Floating "back to top" button, shown after the first screen. */
function initBackToTop() {
  const btn = document.createElement('button');
  btn.className = 'to-top';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Back to top');
  btn.innerHTML = '&#9650;';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });

  const update = () => btn.classList.toggle('show', window.scrollY > 500);
  update();
  window.addEventListener('scroll', update, { passive: true });
}
