/* Success4Sure analytics helper — pushes events to Google Tag Manager's dataLayer.
   GTM (GTM-TFQ9CSN9) turns these into Google Analytics events. Safe to load everywhere:
   on localhost GTM isn't loaded, so pushes just sit in the array. */
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  window.s4sTrack = function (event, params) {
    var o = { event: event };
    if (params) for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k)) o[k] = params[k];
    window.dataLayer.push(o);
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
