/* Success4Sure analytics helper — sends each event to Google Analytics 4 (via gtag) and to
   Google Tag Manager's dataLayer. Safe to load everywhere: on localhost neither Google script
   loads, so calls just queue up in the dataLayer array. */
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  window.s4sTrack = function (event, params) {
    var o = { event: event }, p = {};
    if (params) for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) { o[k] = params[k]; p[k] = params[k]; }
    window.dataLayer.push(o); // for Google Tag Manager (future marketing tags)
    // Straight to Google Analytics 4 (G-JS9KYRZB46). In-app screen changes are sent as GA4 page views.
    if (typeof window.gtag === 'function') {
      if (event === 'virtual_page_view') window.gtag('event', 'page_view', { page_location: p.page_location, page_title: p.page_title });
      else window.gtag('event', event, p);
    }
  };
  // Any element with data-track="event_name" (and optional data-track-params='{"k":"v"}') reports a click.
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-track]') : null;
    if (!el) return;
    var p = {};
    try { p = JSON.parse(el.getAttribute('data-track-params') || '{}'); } catch (err) { /* ignore bad params */ }
    if (el.href) p.link_url = el.href;
    window.s4sTrack(el.getAttribute('data-track'), p);
  }, true);
})();
