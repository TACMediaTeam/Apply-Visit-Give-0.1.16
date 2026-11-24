(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bar = document.getElementById('bar');

  /* arriving from the Seminar page: jump straight to the requested section before the slide-in */
  try {
    const goto = sessionStorage.getItem('goto');
    if (goto) {
      sessionStorage.removeItem('goto');
      const t = document.getElementById(goto);
      if (t) {
        root.style.scrollBehavior = 'auto';
        scrollTo(0, t.getBoundingClientRect().top + scrollY - bar.offsetHeight);
        root.style.scrollBehavior = '';
        history.replaceState(null, '', '#' + goto);
      }
    }
  } catch (_) {}
  const barH = () => bar.offsetHeight;

  /* smooth scroll to a section, landing just under the sticky bar */
  function go(el, hash, extra = 0) {
    const y = el.getBoundingClientRect().top + scrollY - (el.id === 'top' ? 0 : barH() + extra);
    scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    if (hash) history.pushState(null, '', hash);
  }

  /* ---- the three doors (and any in-page link to a section) ---- */
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (!el || a.classList.contains('skip')) return;
    e.preventDefault();
    if (a.classList.contains('door')) {
      document.querySelectorAll('.door').forEach(d => d.classList.toggle('is-chosen', d === a));
    }
    go(el, '#' + id);
  }));

  /* ---- apply: college vs. summer program ---- */
  const tabs = [...document.querySelectorAll('.fork-opt')];
  /* both panels start closed; choosing one expands it downward (like the President's letter).
     choosing the open one again folds it away. */
  /* one smooth motion: the panel's height eases open (or closed) on its own,
     its contents fade in with it, and the page only scrolls if the cards are off-screen */
  const EASE = 'cubic-bezier(.45,0,.2,1)';
  function animatePanel(panel, open) {
    const inner = panel.firstElementChild;
    const from = panel.getBoundingClientRect().height;
    const to = open ? inner.scrollHeight : 0;
    panel.getAnimations().forEach(a => a.cancel());
    panel.style.height = from + 'px';
    const dur = reduce ? 0 : Math.min(900, 420 + Math.abs(to - from) * 0.12);
    const anim = panel.animate(
      [{ height: from + 'px', opacity: open ? 0.0 : 1 }, { height: to + 'px', opacity: open ? 1 : 0 }],
      { duration: dur, easing: EASE, fill: 'forwards' });
    anim.onfinish = () => { anim.cancel(); panel.style.height = open ? 'auto' : '0px'; panel.style.opacity = open ? 1 : 0; };
  }
  function select(track, scroll) {
    const current = tabs.find(t => t.getAttribute('aria-selected') === 'true');
    const closing = current && current.dataset.track === track;
    const tapped = tabs.find(t => t.dataset.track === track);
    const tapTop = tapped.getBoundingClientRect().top;
    tabs.forEach(t => {
      const on = !closing && t.dataset.track === track;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      const wasOpen = panel.classList.contains('is-open');
      t.setAttribute('aria-selected', on);
      t.setAttribute('aria-expanded', on);
      panel.classList.toggle('is-open', on);
      panel.inert = !on;
      if (on) panel.querySelectorAll('.reveal:not(.in)').forEach(el => el.classList.add('in'));
      if (on === wasOpen) return;
      // a panel closing ABOVE the tapped card (phones): fold it away at once and correct the
      // scroll a single time, so the card stays under the finger and nothing fights the user
      const above = !on && panel.getBoundingClientRect().top < tapTop;
      if (above) {
        panel.getAnimations().forEach(a => a.cancel());
        panel.style.height = '0px'; panel.style.opacity = 0;
        const shift = tapped.getBoundingClientRect().top - tapTop;
        if (shift) window.scrollTo({ top: scrollY + shift, behavior: 'instant' });
      } else {
        animatePanel(panel, on);
      }
    });
    if (scroll && !closing && !matchMedia('(max-width: 800px)').matches) {
      const fork = document.querySelector('.fork');
      const top = fork.getBoundingClientRect().top;
      if (top < barH() || top > innerHeight * 0.6) go(fork, '#apply-' + track);
      else history.pushState(null, '', '#apply-' + track);
    } else if (!closing) {
      history.replaceState(null, '', '#apply-' + track);
    }
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => select(t.dataset.track, true));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const next = tabs[(tabs.indexOf(t) + 1) % tabs.length];
      next.focus();
    });
  });

  /* deep links: #apply-college, #apply-summer, #apply, #visit, #give */
  function fromHash() {
    const h = location.hash.slice(1);
    if (h === 'apply-summer' || h === 'apply-college') {
      const t = h.replace('apply-', '');
      if (!document.getElementById(h).classList.contains('is-open')) select(t, false);
      requestAnimationFrame(() => go(document.querySelector('.fork')));
    }
  }
  addEventListener('popstate', fromHash);

  /* ---- sticky bar: appears once the chooser is behind you ---- */
  const chooser = document.getElementById('top');
  bar.inert = true;
  new IntersectionObserver(([e]) => { bar.classList.toggle('is-on', !e.isIntersecting); bar.inert = e.isIntersecting; }, { threshold: 0, rootMargin: `-${bar.offsetHeight + 40}px 0px 0px 0px` }).observe(chooser);

  /* active section in the bar */
  const links = Object.fromEntries([...document.querySelectorAll('[data-nav]')].map(a => [a.dataset.nav, a]));
  const spy = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) Object.entries(links).forEach(([k, a]) => a.classList.toggle('is-active', k === e.target.id));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['apply', 'visit', 'give'].forEach(id => spy.observe(document.getElementById(id)));

  /* ---- reveal on scroll ---- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  function reveal(scope) { scope.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el)); }
  reveal(document);

  /* ---- president's letter: the wide bar expands the letter downward ---- */
  const letter = document.getElementById('president-letter');
  const letterBtn = document.querySelector('.btn-letter');
  if (letter && letterBtn) {
    const label = letterBtn.firstChild;
    const setLetter = (open, returnToBtn) => {
      letter.classList.toggle('is-open', open);
      letter.inert = !open;
      letterBtn.setAttribute('aria-expanded', open);
      label.textContent = open ? 'Close the letter ' : 'A letter from our President ';
      if (!open && returnToBtn) go(letterBtn, null, 24);
    };
    letterBtn.addEventListener('click', () => setLetter(!letter.classList.contains('is-open')));
    letter.querySelector('.letter-hide').addEventListener('click', () => setLetter(false, true));
    if (location.hash === '#president-letter') setLetter(true);
  }

  /* ---- slide to the seminar page: this view exits left, the new page enters from the right ---- */
  document.querySelectorAll('a[data-slide]').forEach(a => a.addEventListener('click', e => {
    if (reduce || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if ('onpagereveal' in window) return;   // browser animates both pages together (see @view-transition in styles.css)
    e.preventDefault();
    try { sessionStorage.setItem('slideIn', '1'); } catch (_) {}
    root.classList.add('slide-out');
    setTimeout(() => { location.href = a.href; }, 620);
  }));
  addEventListener('pageshow', () => root.classList.remove('slide-out'));

  /* ---- landing doors: smooth hover expansion with a short grace period on leave ---- */
  const doorsEl = document.querySelector('.doors');
  if (doorsEl) {
    let leaveTimer;
    const setHot = d => {
      clearTimeout(leaveTimer);
      doorsEl.classList.toggle('has-hot', !!d);
      doorsEl.querySelectorAll('.door').forEach(x => x.classList.toggle('is-hot', x === d));
    };
    doorsEl.querySelectorAll('.door').forEach(d => {
      d.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setHot(d); });
      d.addEventListener('focus', () => setHot(d));
      d.addEventListener('blur', () => setHot(null));
    });
    doorsEl.addEventListener('pointerleave', () => { leaveTimer = setTimeout(() => setHot(null), 180); });
  }

  /* ---- phones: the landing screen pins while you scroll, and scrolling opens Apply, then Visit, then Give.
         tapping a closed strip scrolls to its turn; tapping the open door's button goes to its section. ---- */
  const phoneDoors = document.querySelector('.doors');
  const chooserEl = document.getElementById('top');
  const phone = matchMedia('(max-width: 800px)');
  if (phoneDoors && chooserEl) {
    const list = [...phoneDoors.querySelectorAll('.door')];
    let idx = -1, ticking = false;
    const runway = () => chooserEl.offsetHeight - innerHeight;
    const progress = () => Math.min(1, Math.max(0, (scrollY - chooserEl.offsetTop) / Math.max(1, runway())));
    const open = i => {
      if (i === idx) return;
      idx = i;
      list.forEach((d, k) => d.classList.toggle('is-open', k === i));
    };
    const smooth = t => t * t * (3 - 2 * t);
    const update = () => {
      ticking = false;
      if (!phone.matches) return;
      // continuous position 0…n-1 that rests on each door, easing between them
      const x = Math.min(list.length - 1, Math.max(0, progress() * list.length - 0.5));
      const base = Math.floor(x), f = x - base, pos = base + smooth(f);
      list.forEach((d, k) => {
        const t = Math.max(0, 1 - Math.abs(pos - k));        // 1 = fully open, 0 = strip
        d.style.setProperty('--t', t.toFixed(3));
        d.style.flexGrow = (1 + 2.4 * t).toFixed(3);
      });
      open(Math.round(pos));
      const seg = Math.min(1, Math.max(0, progress() * list.length - Math.round(pos)));
      phoneDoors.style.setProperty('--seg', seg.toFixed(3));
    };
    const req = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', req);
    phoneDoors.addEventListener('click', e => {
      if (!phone.matches) return;
      const d = e.target.closest('.door');
      if (!d) return;
      const k = list.indexOf(d);
      if (k === idx) return;               // open door: let it go to its section
      e.preventDefault(); e.stopImmediatePropagation();
      const y = chooserEl.offsetTop + runway() * ((k + 0.5) / list.length);
      scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }, true);
    phone.addEventListener('change', () => {
      if (!phone.matches) { idx = -1; list.forEach(d => { d.classList.remove('is-open'); d.style.flexGrow = ''; d.style.removeProperty('--t'); }); } else update();
    });
    update();
  }

  /* ---- rotating quotes: gentle crossfade, dots to choose, pauses while read ---- */
  document.querySelectorAll('[data-rotate]').forEach(box => {
    const qs = [...box.querySelectorAll('.q')], dots = box.querySelector('.q-dots');
    if (qs.length < 2) return;
    let i = 0, timer = null, held = false;
    const btns = qs.map((q, k) => {
      const b = document.createElement('button'); b.type = 'button';
      b.setAttribute('aria-label', 'Quote ' + (k + 1) + ' of ' + qs.length);
      b.addEventListener('click', () => { show(k); restart(); });
      dots.appendChild(b); return b;
    });
    const show = k => {
      i = k;
      qs.forEach((q, n) => { q.classList.toggle('is-on', n === k); q.setAttribute('aria-hidden', n !== k); });
      btns.forEach((b, n) => b.setAttribute('aria-current', n === k));
    };
    const restart = () => { clearInterval(timer); if (!reduce && !held) timer = setInterval(() => show((i + 1) % qs.length), 8000); };
    const hold = v => { held = v; restart(); };
    box.addEventListener('mouseenter', () => hold(true)); box.addEventListener('mouseleave', () => hold(false));
    box.addEventListener('focusin', () => hold(true)); box.addEventListener('focusout', () => hold(false));
    show(0); restart();
  });

  fromHash();
})();
