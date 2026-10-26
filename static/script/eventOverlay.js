/*
 * Archiv-Version (2026-10-26): Das Overlay laedt die Event-Details nicht mehr
 * vom Server (/events/<slug>/<lang>?embed=1), sondern aus der lokalen Seite
 * static/html/event.html, die sie aus static/script/archive-data.js rendert.
 * Funktioniert per file:// und auf jedem statischen Webserver.
 */

// Wurzel des Archivs (meshfestival.ch/) aus dem Pfad dieses Skripts ableiten
var MESH_ROOT = (function () {
    var s = document.currentScript && document.currentScript.src;
    if (!s) {
        var all = document.getElementsByTagName('script');
        for (var i = all.length - 1; i >= 0; i--) {
            if (/eventOverlay\.js/.test(all[i].src)) { s = all[i].src; break; }
        }
    }
    return (s || '').replace(/static\/script\/eventOverlay\.js.*$/, '');
})();

function isTopWindow() {
    try {
        return window.self === window.top;
    } catch (e) {
        return true;
    }
}

function currentLang() {
    if (typeof language !== 'undefined' && language && language[0]) return language[0];
    return /\/en(\.html)?$/.test(window.location.pathname) ? 'en' : 'de';
}

// Slug und Sprache aus beliebigen Event-URLs lesen:
// ../../events/x/de.html, events/x, https://meshfestival.ch/events/x/en?embed=1, file:///events/x/de ...
function parseEventHref(href) {
    var m = String(href).match(/events\/([^\/?#]+?)(?:\.html)?(?:\/(de|en)(?:\.html)?)?\/?(?:[?#].*)?$/);
    if (!m) return null;
    return { slug: decodeURIComponent(m[1]), lang: m[2] || currentLang() };
}

function navigateOverlayFrame(href) {
    var frame = document.getElementById('eventOverlayFrame');
    var target = 'about:blank';
    if (href !== 'about:blank') {
        var ev = parseEventHref(href);
        if (ev) {
            target = MESH_ROOT + 'static/html/event.html?event=' + encodeURIComponent(ev.slug) + '&lang=' + ev.lang;
        }
    }
    try {
        frame.contentWindow.location.replace(target);
    } catch (e) {
        frame.src = target;
    }
}

function openEventOverlay(href, pushState) {
    navigateOverlayFrame(href);
    $('#eventOverlay').addClass('open');
    $('body').addClass('block');
    $('main, footer, #startpageNav, #filters, #dayNav').addClass('blur');

    if (pushState !== false) {
        var ev = parseEventHref(href);
        if (ev) {
            try {
                history.pushState({ eventOverlay: true, href: href }, '',
                    MESH_ROOT + 'events/' + ev.slug + '/' + ev.lang + '.html');
            } catch (err) {
                // file:// erlaubt pushState auf andere Dateien nicht – Overlay funktioniert trotzdem
            }
        }
    }
}

function closeEventOverlay() {
    if (history.state && history.state.eventOverlay) {
        history.back();
    } else {
        hideEventOverlay();
    }
}

function hideEventOverlay() {
    $('#eventOverlay').removeClass('open');
    $('body').removeClass('block');
    $('main, footer, #startpageNav, #filters, #dayNav').removeClass('blur');
    navigateOverlayFrame('about:blank');
}

$(document).ready(function () {
    if (!isTopWindow()) return;

    $(document).on('click', 'a[href]', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

        var raw = this.getAttribute('href') || '';
        if (!/events\/[^\/?#]+/.test(raw)) return;

        if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\/(www\.)?meshfestival\.ch\//i.test(raw)) {
            var linkOrigin;
            try {
                linkOrigin = new URL(raw).origin;
            } catch (err) {
                return;
            }
            if (linkOrigin !== window.location.origin) return;
        }

        if (!parseEventHref(raw)) return;
        e.preventDefault();
        openEventOverlay(raw);
    });

    $('#eventOverlay').on('click', function (e) {
        if (e.target === this) closeEventOverlay();
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape' && $('#eventOverlay').hasClass('open')) closeEventOverlay();
    });

    // Nachrichten aus der Detailseite im iframe (Links auf andere Events, Zurueck-Button)
    window.addEventListener('message', function (e) {
        var d = e.data;
        if (!d || typeof d !== 'object' || !d.mesh) return;
        if (d.mesh === 'open' && d.event) {
            openEventOverlay('events/' + d.event + '/' + (d.lang === 'en' ? 'en' : 'de'));
        } else if (d.mesh === 'close') {
            closeEventOverlay();
        }
    });

    window.addEventListener('popstate', function (e) {
        if (e.state && e.state.eventOverlay) {
            openEventOverlay(e.state.href, false);
        } else {
            hideEventOverlay();
        }
    });
});
