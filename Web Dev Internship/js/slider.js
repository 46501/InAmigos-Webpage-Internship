/**
 * InAmigos Foundation — Hero Image Carousel
 * Vanilla JavaScript — no external libraries.
 *
 * Fixes applied vs. previous version:
 *  - transitionend filtered by e.propertyName === 'transform'
 *    so it never fires twice and corrupts the isAnimating flag.
 *  - setTimeout fallback guarantees isAnimating resets even if
 *    transitionend fails to fire (e.g. tab hidden, reduced-motion).
 *  - jumpTo() never touches isAnimating so clone-jumps are safe.
 *  - Autoplay starts immediately on DOMContentLoaded with no
 *    dependency on any external event.
 *
 * Features: autoplay (2.5 s), infinite loop, arrows, dots,
 *           pause-on-hover, swipe, keyboard, Visibility API.
 */
(function () {
  'use strict';

  /* ─── Timing constants ─── */
  var TRANSITION_MS  = 700;   // slide animation duration (ms) — matches CSS 0.7s
  var AUTOPLAY_DELAY = 2500;  // interval between auto-advances (ms)
  var FALLBACK_EXTRA = 80;    // safety buffer added to timeout fallback (ms)

  /* ─── DOM references ─── */
  var track         = document.getElementById('heroSliderTrack');
  var prevBtn       = document.getElementById('heroPrev');
  var nextBtn       = document.getElementById('heroNext');
  var dotsContainer = document.getElementById('heroDots');
  var hero          = document.querySelector('.hero');

  if (!track || !prevBtn || !nextBtn || !dotsContainer || !hero) return;

  /* ─── Collect real slides & dots ─── */
  var realSlides  = track.querySelectorAll('.hero-slide');
  var dots        = dotsContainer.querySelectorAll('.hero-dot');
  var slideCount  = realSlides.length;

  /* ─── Clone edge slides for seamless infinite loop ─── */
  var firstClone = realSlides[0].cloneNode(true);
  var lastClone  = realSlides[slideCount - 1].cloneNode(true);
  firstClone.setAttribute('aria-hidden', 'true');
  lastClone.setAttribute('aria-hidden', 'true');
  track.appendChild(firstClone);                    // clone of slide 0  → appended at end
  track.insertBefore(lastClone, realSlides[0]);     // clone of last slide → prepended at start

  /* Layout: [lastClone | slide0 | slide1 | … | slideN-1 | firstClone] */
  var totalSlides = slideCount + 2;
  var currentIdx  = 1;   // real slide 0 lives at position 1

  /* ─── Size every slide to exactly 1 viewport width ─── */
  track.style.width = totalSlides * 100 + '%';
  var allSlides = track.querySelectorAll('.hero-slide');
  for (var i = 0; i < allSlides.length; i++) {
    allSlides[i].style.minWidth = (100 / totalSlides) + '%';
  }

  /* ─── State ─── */
  var isAnimating    = false;
  var autoPlayTimer  = null;
  var fallbackTimer  = null;

  /* ─────────────────────────────────────────
     jumpTo — instant reposition, no animation.
     NEVER touches isAnimating.
  ───────────────────────────────────────── */
  function jumpTo(idx) {
    track.style.transition = 'none';
    track.style.transform  = 'translateX(-' + (idx * (100 / totalSlides)) + '%)';
    void track.offsetHeight;  // force synchronous reflow so next paint picks it up
  }

  /* ─── Update active dot ─── */
  function setActiveDot(trackIdx) {
    /* map track index → 0-based real index */
    var real = trackIdx - 1;
    if (real < 0)           real = slideCount - 1;
    if (real >= slideCount) real = 0;
    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.remove('active');
    }
    if (dots[real]) dots[real].classList.add('active');
  }

  /* ─── Called when the slide animation finishes ─── */
  function onAnimationComplete() {
    clearTimeout(fallbackTimer);

    /* Seamless infinite-loop correction — jump without animation */
    if (currentIdx >= totalSlides - 1) {
      currentIdx = 1;
      jumpTo(currentIdx);
      setActiveDot(currentIdx);
    } else if (currentIdx <= 0) {
      currentIdx = slideCount;
      jumpTo(currentIdx);
      setActiveDot(currentIdx);
    }

    isAnimating = false;
  }

  /* ─── Slide to a track position with animation ─── */
  function goToSlide(idx) {
    if (isAnimating) return;
    isAnimating = true;
    currentIdx  = idx;

    track.style.transition = 'transform ' + TRANSITION_MS + 'ms ease-in-out';
    track.style.transform  = 'translateX(-' + (currentIdx * (100 / totalSlides)) + '%)';
    setActiveDot(currentIdx);

    /*
     * Primary signal: transitionend filtered to 'transform' only.
     * This prevents the double-fire bug that occurred when multiple
     * CSS properties were transitioning simultaneously.
     */
    /* handled below via the persistent listener */

    /*
     * Fallback: if transitionend never fires (tab hidden, browser
     * quirk, prefers-reduced-motion override), unlock after timeout.
     */
    fallbackTimer = setTimeout(onAnimationComplete, TRANSITION_MS + FALLBACK_EXTRA);
  }

  /* ─── Persistent transitionend listener (filter by property) ─── */
  track.addEventListener('transitionend', function (e) {
    /* Only respond to the 'transform' property — ignore any others */
    if (e.propertyName !== 'transform') return;
    onAnimationComplete();
  });

  /* ─── Next / Prev helpers ─── */
  function nextSlide() { goToSlide(currentIdx + 1); }
  function prevSlide()  { goToSlide(currentIdx - 1); }

  /* ─── Autoplay ─── */
  function startAutoPlay() {
    stopAutoPlay();
    autoPlayTimer = setInterval(nextSlide, AUTOPLAY_DELAY);
  }

  function stopAutoPlay() {
    clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }

  function resetAutoPlay() {
    stopAutoPlay();
    startAutoPlay();
  }

  /* ─── Arrow buttons ─── */
  nextBtn.addEventListener('click', function () { nextSlide(); resetAutoPlay(); });
  prevBtn.addEventListener('click', function () { prevSlide(); resetAutoPlay(); });

  /* ─── Dot navigation ─── */
  for (var d = 0; d < dots.length; d++) {
    (function (dotIdx) {
      dots[dotIdx].addEventListener('click', function () {
        goToSlide(dotIdx + 1);  // +1 offset for prepended clone
        resetAutoPlay();
      });
    })(d);
  }

  /* ─── Pause on hover ─── */
  hero.addEventListener('mouseenter', stopAutoPlay);
  hero.addEventListener('mouseleave', startAutoPlay);

  /* ─── Touch / swipe support ─── */
  var touchStartX    = 0;
  var SWIPE_THRESHOLD = 50;

  hero.addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].screenX;
    stopAutoPlay();
  }, { passive: true });

  hero.addEventListener('touchend', function (e) {
    var diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > SWIPE_THRESHOLD) {
      diff > 0 ? nextSlide() : prevSlide();
    }
    resetAutoPlay();
  }, { passive: true });

  /* ─── Keyboard accessibility ─── */
  hero.setAttribute('tabindex', '0');
  hero.setAttribute('role', 'region');
  hero.setAttribute('aria-label', 'Image slideshow — use arrow keys to navigate');

  hero.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'Right') { nextSlide(); resetAutoPlay(); }
    else if (e.key === 'ArrowLeft' || e.key === 'Left') { prevSlide(); resetAutoPlay(); }
  });

  /* ─── Visibility API: pause when tab is in background ─── */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopAutoPlay();
    } else {
      /* Resume without resetting — pick up where we left off */
      startAutoPlay();
    }
  });

  /* ─── Initialise position then start ─── */
  jumpTo(currentIdx);
  setActiveDot(currentIdx);
  startAutoPlay();

})();
