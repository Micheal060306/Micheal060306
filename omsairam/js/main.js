(function () {
  'use strict';

  var WHATSAPP_NUMBER = '918608008343';

  /* ---------------- Lazy-load gallery images ----------------
     Native loading="lazy" doesn't reliably fire inside the
     horizontally-clipped (overflow-x:hidden) carousel track, so the
     wrapping section is observed instead — once it nears the
     viewport on normal vertical scroll, every img[data-src] inside
     gets its real src swapped in. */
  (function () {
    var wraps = document.querySelectorAll('[data-gallery]');
    function loadImages(root) {
      root.querySelectorAll('img[data-src]').forEach(function (img) {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
      });
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          loadImages(entry.target);
          obs.unobserve(entry.target);
        });
      }, { rootMargin: '400px 0px' });
      wraps.forEach(function (wrap) { observer.observe(wrap); });
    } else {
      wraps.forEach(loadImages);
    }
  })();

  /* ---------------- Mobile nav ---------------- */
  document.querySelectorAll('[data-nav-toggle]').forEach(function (btn) {
    var nav = document.getElementById(btn.getAttribute('aria-controls'));
    if (!nav) return;
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.textContent = open ? '✕' : '☰';
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.textContent = '☰';
      });
    });
  });

  /* ---------------- FAQ accordion ---------------- */
  document.querySelectorAll('.faq-item').forEach(function (item, idx) {
    var btn = item.querySelector('.faq-q');
    var symbol = item.querySelector('.faq-symbol');
    if (!btn) return;
    // First FAQ item open by default, matching the source design.
    if (idx === 0) {
      item.classList.add('open');
      if (symbol) symbol.textContent = '−';
    }
    btn.addEventListener('click', function () {
      var isOpen = item.classList.contains('open');
      var group = item.closest('[data-faq-group]') || item.parentElement;
      group.querySelectorAll('.faq-item.open').forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove('open');
          var s = openItem.querySelector('.faq-symbol');
          if (s) s.textContent = '+';
        }
      });
      item.classList.toggle('open', !isOpen);
      if (symbol) symbol.textContent = !isOpen ? '−' : '+';
    });
  });

  /* ---------------- WhatsApp booking forms ----------------
     Generic across every booking form on the site: reads name/phone/area
     (always), count (only if the field exists, e.g. "No. of Sarees"), and
     any checked item[] checkboxes plus a free-text items_other field (used
     by the Old Cloth Buyer category picker). The intro line is per-form via
     data-whatsapp-intro so one handler serves every page. */
  document.querySelectorAll('[data-whatsapp-form]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var phone = (data.get('phone') || '').toString().trim();
      var area = (data.get('area') || '').toString().trim();
      var intro = form.getAttribute('data-whatsapp-intro') || 'Hi, I\'d like to book a pickup.';
      var lines = [intro, 'Name: ' + name, 'Phone: ' + phone, 'Area: ' + area];

      var count = (data.get('count') || '').toString().trim();
      if (count) lines.push('No. of Sarees: ' + count);

      var qty = (data.get('quantity') || '').toString().trim();
      if (qty) lines.push('Approx. Quantity: ' + qty);

      var items = data.getAll('items').map(function (v) { return v.toString(); });
      var other = (data.get('items_other') || '').toString().trim();
      if (other) items.push(other);
      if (items.length) lines.push('Items to Sell: ' + items.join(', '));

      var msg = lines.join('\n');
      window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(msg), '_blank');

      var widget = form.closest('[data-booking-widget]') || form.parentElement;
      var success = widget.querySelector('[data-form-success]');
      if (success) {
        var nameSlot = success.querySelector('[data-name-slot]');
        if (nameSlot) nameSlot.textContent = name;
        success.hidden = false;
        form.hidden = true;
      }
    });
  });

  /* ---------------- Press / newspaper carousel ---------------- */
  var pressData = [
    { name: 'Daily Hunt', date: 'Jun 2026', dropCap: 'C', headline: "OM Sairam Pattu Center: Chennai's Most Trusted Old Silk Saree Buyers Since 1985", excerpt: "overage of how OM Sairam Pattu Center has built its reputation among Chennai's old silk saree sellers over four decades of doorstep service.", href: 'https://m.dailyhunt.in/news/india/english/r+news+india-epaper-dhfacc36dfce9c4bb68db0e89d033c921b/om+sairam+pattu+center+chennais+most+trusted+old+silk+saree+buyers+since+1985-newsid-dhfacc36dfce9c4bb68db0e89d033c921b_cdd0dc50360c11f08fe961b2033a9de2?sm=Y' },
    { name: 'Hindustan Metro', date: 'Jun 2026', dropCap: 'A', headline: "OM Sairam Pattu Center: Chennai's Most Trusted Old Silk Saree Buyers Since 1985", excerpt: 'feature on the family-run business and its transparent approach to valuing and buying old pattu sarees.', href: 'https://www.hindustanmetro.com/om-sairam-pattu-center-chennais-most-trusted-old-silk-saree-buyers-since-1985/' },
    { name: 'Republic News India', date: 'Jun 2026', dropCap: 'A', headline: "OM Sairam Pattu Center: Chennai's Most Trusted Old Silk Saree Buyers Since 1985", excerpt: 'n in-depth look at how the business built trust with customers through fair pricing and doorstep pickup.', href: 'https://republicnewsindia.com/om-sairam-pattu-center-chennais-most-trusted-old-silk-saree-buyers-since-1985/' },
    { name: 'Flip Board', date: 'Jun 2026', dropCap: 'S', headline: "OM Sairam Pattu Center: Chennai's Most Trusted Old Silk Saree Buyers Since 1985", excerpt: "yndicated coverage highlighting the brand's four decades of service to Chennai's silk saree sellers.", href: 'https://flipboard.com/@republicnewsind/-om-sairam-pattu-center-chennais-most-tr/a-g-7mhsMNTxKxNGhpAeod0w%3Aa%3A3544623556-b80301c206%2Frepublicnewsindia.com' }
  ];

  var pressRoot = document.querySelector('[data-press-carousel]');
  if (pressRoot) {
    var pressIndex = 0;
    var elName = pressRoot.querySelector('[data-press-name]');
    var elDate = pressRoot.querySelector('[data-press-date]');
    var elHeadline = pressRoot.querySelector('[data-press-headline]');
    var elDropcap = pressRoot.querySelector('[data-press-dropcap]');
    var elExcerpt = pressRoot.querySelector('[data-press-excerpt]');
    var elLink = pressRoot.querySelector('[data-press-link]');
    var dotsWrap = pressRoot.querySelector('[data-press-dots]');

    if (dotsWrap) {
      pressData.forEach(function (p, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', p.name);
        b.addEventListener('click', function () { renderPress(i); });
        dotsWrap.appendChild(b);
      });
    }

    function renderPress(i) {
      pressIndex = (i + pressData.length) % pressData.length;
      var p = pressData[pressIndex];
      if (elName) elName.textContent = p.name;
      if (elDate) elDate.textContent = p.date;
      if (elHeadline) elHeadline.textContent = p.headline;
      if (elDropcap) elDropcap.textContent = p.dropCap;
      if (elExcerpt) elExcerpt.textContent = p.excerpt;
      if (elLink) elLink.href = p.href;
      if (dotsWrap) {
        Array.prototype.forEach.call(dotsWrap.children, function (dot, i2) {
          dot.setAttribute('aria-current', i2 === pressIndex ? 'true' : 'false');
        });
      }
    }

    var prevBtn = pressRoot.querySelector('[data-press-prev]');
    var nextBtn = pressRoot.querySelector('[data-press-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { renderPress(pressIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { renderPress(pressIndex + 1); });

    renderPress(0);
  }

  /* ---------------- Gallery carousel ---------------- */
  document.querySelectorAll('[data-gallery]').forEach(function (wrap) {
    var track = wrap.querySelector('.gallery-track');
    if (!track) return;
    var paused = false;
    var raf = null;
    var resumeTimer = null;

    /* Continuous flowing auto-scroll, looping back to the start. */
    function tick() {
      if (!paused) {
        track.scrollLeft += 0.6;
        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 1) {
          track.scrollLeft = 0;
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    wrap.addEventListener('mouseenter', function () { paused = true; });
    wrap.addEventListener('mouseleave', function () { paused = false; });
    wrap.addEventListener('touchstart', function () {
      paused = true;
      clearTimeout(resumeTimer);
    }, { passive: true });
    wrap.addEventListener('touchend', function () {
      resumeTimer = setTimeout(function () { paused = false; }, 2000);
    });

    function step(dir) {
      var card = track.firstElementChild;
      var gap = parseFloat(getComputedStyle(track).gap) || 12;
      var cardWidth = card ? card.getBoundingClientRect().width + gap : 320;
      var maxScroll = track.scrollWidth - track.clientWidth;
      var target = track.scrollLeft + dir * cardWidth;
      if (target < 0) target = maxScroll;
      if (target > maxScroll) target = 0;
      track.scrollTo({ left: target, behavior: 'smooth' });
    }

    var prevBtn = wrap.querySelector('[data-gallery-prev]');
    var nextBtn = wrap.querySelector('[data-gallery-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
  });
})();
