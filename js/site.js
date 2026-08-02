/**

Wise King Enterprise — Shared Website Functionality
File: js/site.js
Provides shared navigation, accessibility, performance and interaction
behaviour. Product catalogue, cart and checkout logic belong elsewhere.
*/

(() => {
"use strict";

const SITE_NAMESPACE = "wiseKing";
const MOBILE_BREAKPOINT = "(min-width: 64rem)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FOCUSABLE_SELECTOR = [
"a[href]:not([tabindex='-1'])",
"area[href]:not([tabindex='-1'])",
"button:not([disabled]):not([tabindex='-1'])",
"input:not([disabled]):not([type='hidden']):not([tabindex='-1'])",
"select:not([disabled]):not([tabindex='-1'])",
"textarea:not([disabled]):not([tabindex='-1'])",
"details > summary:first-of-type",
"iframe:not([tabindex='-1'])",
"[contenteditable='true']:not([tabindex='-1'])",
"[tabindex]:not([tabindex='-1'])"
].join(",");

const state = {
activeOverlay: null,
lastFocusedElement: null,
scrollLockPosition: 0,
scrollTicking: false
};

const media = {
desktop: window.matchMedia(MOBILE_BREAKPOINT),
reducedMotion: window.matchMedia(REDUCED_MOTION_QUERY)
};

/**

Safely queries a single element.
@param {string} selector
@param {ParentNode} [context=document]
@returns {Element|null}
*/
function select(selector, context = document) {
try {
return context.querySelector(selector);
} catch {
return null;
}
}

/**

Safely queries multiple elements.
@param {string} selector
@param {ParentNode} [context=document]
@returns {Element[]}
*/
function selectAll(selector, context = document) {
try {
return Array.from(context.querySelectorAll(selector));
} catch {
return [];
}
}

/**

Creates a namespaced CustomEvent.
@param {string} name
@param {Record<string, unknown>} [detail={}]
@returns {CustomEvent}
*/
function createSiteEvent(name, detail = {}) {
return new CustomEvent(${SITE_NAMESPACE}:${name}, {
bubbles: true,
detail
});
}

/**

Runs a callback after a short pause in repeated calls.
@param {Function} callback
@param {number} [delay=150]
@returns {Function}
*/
function debounce(callback, delay = 150) {
let timeoutId;
return function debounced(...args) {
  window.clearTimeout(timeoutId);
  timeoutId = window.setTimeout(() => {
    callback.apply(this, args);
  }, delay);
};

}

/**

Limits a callback to one execution per animation frame.
@param {Function} callback
@returns {Function}
*/
function throttleFrame(callback) {
let ticking = false;
return function throttled(...args) {
  if (ticking) {
    return;
  }

  ticking = true;

  window.requestAnimationFrame(() => {
    callback.apply(this, args);
    ticking = false;
  });
};

}

/**

Returns whether an element is currently visible and interactive.
@param {Element} element
@returns {boolean}
*/
function isVisible(element) {
if (!(element instanceof HTMLElement)) {
return false;
}
const styles = window.getComputedStyle(element);
return (
  styles.display !== "none" &&
  styles.visibility !== "hidden" &&
  !element.hasAttribute("hidden") &&
  element.getClientRects().length > 0
);

}

/**

Returns the focusable descendants of an element.
@param {ParentNode} container
@returns {HTMLElement[]}
*/
function getFocusableElements(container) {
return selectAll(FOCUSABLE_SELECTOR, container).filter(
(element) =>
element instanceof HTMLElement &&
isVisible(element) &&
element.getAttribute("aria-hidden") !== "true"
);
}

/**

Moves focus without changing scroll position where supported.
@param {HTMLElement|null} element
*/
function focusElement(element) {
if (!(element instanceof HTMLElement)) {
return;
}
try {
  element.focus({ preventScroll: true });
} catch {
  element.focus();
}

}

/**

Escapes an ID before using it in a selector.
@param {string} value
@returns {string}
*/
function escapeSelector(value) {
if (window.CSS && typeof window.CSS.escape === "function") {
return window.CSS.escape(value);
}
return value.replace(/([^\w-])/g, "\\$1");

}

/**

Reads a URL safely.
@param {string} value
@returns {URL|null}
*/
function parseUrl(value) {
try {
return new URL(value, window.location.href);
} catch {
return null;
}
}

/**

Returns the effective sticky-header offset.
@returns {number}
*/
function getHeaderOffset() {
const header = select("[data-site-header], .site-header");
if (!(header instanceof HTMLElement) || !isVisible(header)) {
  return 0;
}

const styles = window.getComputedStyle(header);
const isPositioned =
  styles.position === "sticky" || styles.position === "fixed";

return isPositioned ? Math.ceil(header.getBoundingClientRect().height) : 0;

}

/**

Scrolls an element into view while respecting the sticky header.
@param {Element} target
@param {{updateHistory?: boolean, focus?: boolean}} [options={}]
*/
function scrollToElement(
target,
{ updateHistory = false, focus = false } = {}
) {
if (!(target instanceof Element)) {
return;
}
const offset = getHeaderOffset();
const targetTop =
  target.getBoundingClientRect().top + window.scrollY - offset - 16;

window.scrollTo({
  top: Math.max(0, targetTop),
  behavior: media.reducedMotion.matches ? "auto" : "smooth"
});

if (updateHistory && target.id) {
  const hash = `#${encodeURIComponent(target.id)}`;

  if (window.location.hash !== hash) {
    window.history.pushState(null, "", hash);
  }
}

if (focus && target instanceof HTMLElement) {
  const hadTabIndex = target.hasAttribute("tabindex");

  if (!hadTabIndex) {
    target.setAttribute("tabindex", "-1");
  }

  window.setTimeout(() => {
    focusElement(target);

    if (!hadTabIndex) {
      target.addEventListener(
        "blur",
        () => {
          target.removeAttribute("tabindex");
        },
        { once: true }
      );
    }
  }, media.reducedMotion.matches ? 0 : 350);
}

}

/**

Prevents background scrolling while an overlay is open.
*/
function lockPageScroll() {
if (document.body.classList.contains("is-scroll-locked")) {
return;
}
state.scrollLockPosition = window.scrollY;
document.body.style.top = `-${state.scrollLockPosition}px`;
document.body.classList.add("is-scroll-locked");
document.documentElement.classList.add("has-open-overlay");

}

/**

Restores page scrolling after an overlay closes.
*/
function unlockPageScroll() {
if (!document.body.classList.contains("is-scroll-locked")) {
return;
}
document.body.classList.remove("is-scroll-locked");
document.documentElement.classList.remove("has-open-overlay");
document.body.style.removeProperty("top");
window.scrollTo(0, state.scrollLockPosition);

}

/**

Keeps keyboard focus inside an open overlay.
@param {KeyboardEvent} event
@param {HTMLElement} container
*/
function trapFocus(event, container) {
if (event.key !== "Tab") {
return;
}
const focusableElements = getFocusableElements(container);
if (focusableElements.length === 0) {
  event.preventDefault();
  focusElement(container);
  return;
}

const firstElement = focusableElements[0];
const lastElement = focusableElements[focusableElements.length - 1];
const activeElement = document.activeElement;

if (event.shiftKey && activeElement === firstElement) {
  event.preventDefault();
  focusElement(lastElement);
} else if (!event.shiftKey && activeElement === lastElement) {
  event.preventDefault();
  focusElement(firstElement);
}

}

/**

Adds a polite live region for non-visual status updates.
*/
function initialiseLiveRegion() {
if (select("[data-site-announcer]")) {
return;
}
const announcer = document.createElement("div");
announcer.className = "visually-hidden";
announcer.dataset.siteAnnouncer = "";
announcer.setAttribute("role", "status");
announcer.setAttribute("aria-live", "polite");
announcer.setAttribute("aria-atomic", "true");
document.body.append(announcer);

}

/**

Announces a short message to assistive technologies.
@param {string} message
*/
function announce(message) {
const announcer = select("[data-site-announcer]");
if (!(announcer instanceof HTMLElement)) {
  return;
}

announcer.textContent = "";

window.setTimeout(() => {
  announcer.textContent = message;
}, 50);

}

/**

Enhances the shared site header with sticky-state classes.
*/
function initialiseStickyHeader() {
const header = select("[data-site-header], .site-header");
if (!(header instanceof HTMLElement)) {
  return;
}

const stickyThreshold = Math.max(
  1,
  Number.parseInt(header.dataset.stickyThreshold || "16", 10)
);

const updateHeaderState = () => {
  const isScrolled = window.scrollY > stickyThreshold;
  const isScrollingDown = window.scrollY > (state.previousScrollY || 0);

  header.classList.toggle("is-scrolled", isScrolled);
  header.classList.toggle(
    "is-scrolling-down",
    isScrolled && isScrollingDown
  );

  state.previousScrollY = Math.max(0, window.scrollY);
};

const throttledUpdate = throttleFrame(updateHeaderState);

updateHeaderState();
window.addEventListener("scroll", throttledUpdate, { passive: true });

}

/**

Initialises the responsive mobile navigation and focus management.
*/
function initialiseMobileMenu() {
const toggle = select("[data-menu-toggle], .menu-toggle");
const menu = select("[data-mobile-menu], .mobile-menu");
if (
  !(toggle instanceof HTMLButtonElement) ||
  !(menu instanceof HTMLElement)
) {
  return;
}

let backdrop = select(
  "[data-menu-backdrop], .interface-backdrop[data-for='mobile-menu']"
);

if (!(backdrop instanceof HTMLElement)) {
  backdrop = select(".interface-backdrop");
}

if (!menu.id) {
  menu.id = "mobile-navigation";
}

toggle.setAttribute("aria-controls", menu.id);
toggle.setAttribute("aria-expanded", "false");

if (!menu.hasAttribute("aria-label")) {
  menu.setAttribute("aria-label", "Mobile navigation");
}

menu.setAttribute("aria-hidden", "true");
menu.setAttribute("inert", "");

const closeMenu = ({ restoreFocus = true } = {}) => {
  if (!menu.classList.contains("is-open")) {
    return;
  }

  menu.classList.remove("is-open");
  toggle.classList.remove("is-active");
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open menu");
  menu.setAttribute("aria-hidden", "true");
  menu.setAttribute("inert", "");

  if (backdrop instanceof HTMLElement) {
    backdrop.classList.remove("is-visible");
    backdrop.setAttribute("aria-hidden", "true");
  }

  state.activeOverlay = null;
  unlockPageScroll();

  if (restoreFocus) {
    focusElement(toggle);
  }

  document.dispatchEvent(createSiteEvent("menu-close"));
};

const openMenu = () => {
  if (menu.classList.contains("is-open")) {
    return;
  }

  state.lastFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : toggle;

  menu.classList.add("is-open");
  toggle.classList.add("is-active");
  toggle.setAttribute("aria-expanded", "true");
  toggle.setAttribute("aria-label", "Close menu");
  menu.setAttribute("aria-hidden", "false");
  menu.removeAttribute("inert");

  if (backdrop instanceof HTMLElement) {
    backdrop.classList.add("is-visible");
    backdrop.setAttribute("aria-hidden", "false");
  }

  state.activeOverlay = menu;
  lockPageScroll();

  window.requestAnimationFrame(() => {
    const firstFocusable = getFocusableElements(menu)[0];
    focusElement(firstFocusable || menu);
  });

  document.dispatchEvent(createSiteEvent("menu-open"));
};

toggle.addEventListener("click", () => {
  if (menu.classList.contains("is-open")) {
    closeMenu();
  } else {
    openMenu();
  }
});

selectAll("[data-menu-close]", menu).forEach((button) => {
  button.addEventListener("click", () => closeMenu());
});

selectAll("a[href]", menu).forEach((link) => {
  link.addEventListener("click", () => closeMenu({ restoreFocus: false }));
});

if (backdrop instanceof HTMLElement) {
  backdrop.addEventListener("click", () => closeMenu());
}

menu.addEventListener("keydown", (event) => {
  trapFocus(event, menu);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.classList.contains("is-open")) {
    event.preventDefault();
    closeMenu();
  }
});

const handleBreakpointChange = (event) => {
  if (event.matches) {
    closeMenu({ restoreFocus: false });
  }
};

if (typeof media.desktop.addEventListener === "function") {
  media.desktop.addEventListener("change", handleBreakpointChange);
} else {
  media.desktop.addListener(handleBreakpointChange);
}

}

/**

Adds accessible keyboard behaviour to navigation dropdowns.
*/
function initialiseNavigationDropdowns() {
const dropdowns = selectAll(
"[data-navigation-dropdown], .primary-navigation__item--has-children"
);
dropdowns.forEach((dropdown) => {
  if (!(dropdown instanceof HTMLElement)) {
    return;
  }

  const trigger = select(
    "[data-dropdown-toggle], button[aria-expanded]",
    dropdown
  );
  const panel = select(
    "[data-dropdown-menu], .primary-navigation__submenu",
    dropdown
  );

  if (
    !(trigger instanceof HTMLButtonElement) ||
    !(panel instanceof HTMLElement)
  ) {
    return;
  }

  if (!panel.id) {
    panel.id = `navigation-dropdown-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  trigger.setAttribute("aria-controls", panel.id);
  trigger.setAttribute("aria-expanded", "false");
  panel.setAttribute("aria-hidden", "true");

  const close = ({ restoreFocus = false } = {}) => {
    dropdown.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");

    if (restoreFocus) {
      focusElement(trigger);
    }
  };

  const open = ({ focusFirst = false } = {}) => {
    closeOtherDropdowns(dropdown);
    dropdown.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    panel.setAttribute("aria-hidden", "false");

    if (focusFirst) {
      focusElement(getFocusableElements(panel)[0] || panel);
    }
  };

  trigger.addEventListener("click", (event) => {
    event.preventDefault();

    if (dropdown.classList.contains("is-open")) {
      close();
    } else {
      open();
    }
  });

  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      open({ focusFirst: true });
    } else if (event.key === "Escape") {
      close({ restoreFocus: true });
    }
  });

  panel.addEventListener("keydown", (event) => {
    const items = getFocusableElements(panel);
    const currentIndex = items.indexOf(document.activeElement);

    if (event.key === "Escape") {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }

    if (event.key === "ArrowDown" && items.length > 0) {
      event.preventDefault();
      focusElement(items[(currentIndex + 1) % items.length]);
    }

    if (event.key === "ArrowUp" && items.length > 0) {
      event.preventDefault();
      const nextIndex =
        currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      focusElement(items[nextIndex]);
    }

    if (event.key === "Home" && items.length > 0) {
      event.preventDefault();
      focusElement(items[0]);
    }

    if (event.key === "End" && items.length > 0) {
      event.preventDefault();
      focusElement(items[items.length - 1]);
    }
  });

  dropdown.addEventListener("focusout", (event) => {
    const nextElement = event.relatedTarget;

    if (
      nextElement instanceof Node &&
      !dropdown.contains(nextElement)
    ) {
      close();
    }
  });
});

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Node)) {
    return;
  }

  dropdowns.forEach((dropdown) => {
    if (
      dropdown instanceof HTMLElement &&
      !dropdown.contains(event.target)
    ) {
      const trigger = select(
        "[data-dropdown-toggle], button[aria-expanded]",
        dropdown
      );
      const panel = select(
        "[data-dropdown-menu], .primary-navigation__submenu",
        dropdown
      );

      dropdown.classList.remove("is-open");
      trigger?.setAttribute("aria-expanded", "false");
      panel?.setAttribute("aria-hidden", "true");
    }
  });
});

function closeOtherDropdowns(exception) {
  dropdowns.forEach((dropdown) => {
    if (!(dropdown instanceof HTMLElement) || dropdown === exception) {
      return;
    }

    dropdown.classList.remove("is-open");

    select(
      "[data-dropdown-toggle], button[aria-expanded]",
      dropdown
    )?.setAttribute("aria-expanded", "false");

    select(
      "[data-dropdown-menu], .primary-navigation__submenu",
      dropdown
    )?.setAttribute("aria-hidden", "true");
  });
}

}

/**

Enables same-page smooth scrolling while preserving normal link behaviour.
*/
function initialiseSmoothScrolling() {
document.addEventListener("click", (event) => {
if (
event.defaultPrevented ||
event.button !== 0 ||
event.metaKey ||
event.ctrlKey ||
event.shiftKey ||
event.altKey
) {
return;
}

const link =
event.target instanceof Element
? event.target.closest("a[href*='#']")
: null;

if (!(link instanceof HTMLAnchorElement)) {
return;
}

const url = parseUrl(link.href);

if (
!url ||
url.origin !== window.location.origin ||
url.pathname.replace(//+$/, "") !==
window.location.pathname.replace(//+$/, "") ||
!url.hash ||
url.hash === "#"
) {
return;
}

const id = decodeURIComponent(url.hash.slice(1));
const target = select(#${escapeSelector(id)});

if (!target) {
return;
}

event.preventDefault();

scrollToElement(target, {
updateHistory: true,
focus: link.dataset.focusTarget === "true"
});
});

window.addEventListener("load", () => {
  if (!window.location.hash) {
    return;
  }

  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = select(`#${escapeSelector(id)}`);

  if (target) {
    window.requestAnimationFrame(() => {
      scrollToElement(target);
    });
  }
});

}

/**

Marks the navigation link matching the current page.
*/
function initialiseCurrentNavigation() {
const currentPath = normalisePath(window.location.pathname);
selectAll(
  ".primary-navigation a[href], .mobile-menu a[href], .site-footer a[href]"
).forEach((link) => {
  if (!(link instanceof HTMLAnchorElement)) {
    return;
  }

  const url = parseUrl(link.href);

  if (
    !url ||
    url.origin !== window.location.origin ||
    url.hash ||
    normalisePath(url.pathname) !== currentPath
  ) {
    return;
  }

  link.setAttribute("aria-current", "page");
});

function normalisePath(pathname) {
  const cleanedPath = pathname.replace(/\/index\.html$/i, "/");
  return cleanedPath.length > 1
    ? cleanedPath.replace(/\/+$/, "")
    : cleanedPath;
}

}

/**

Adds an accessible skip link when one is not already present.
*/
function initialiseSkipLink() {
const main = select("main");
let skipLink = select(".skip-link, [data-skip-link]");
if (!(main instanceof HTMLElement)) {
  return;
}

if (!main.id) {
  main.id = "main-content";
}

if (!(skipLink instanceof HTMLAnchorElement)) {
  skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = `#${main.id}`;
  skipLink.textContent = "Skip to main content";
  document.body.prepend(skipLink);
}

skipLink.addEventListener("click", (event) => {
  event.preventDefault();
  scrollToElement(main, { focus: true });
});

}

/**

Enhances native and custom disclosure components.
*/
function initialiseDisclosures() {
selectAll("[data-disclosure]").forEach((disclosure) => {
if (!(disclosure instanceof HTMLElement)) {
return;
}

const trigger = select("[data-disclosure-toggle]", disclosure);
const panel = select("[data-disclosure-panel]", disclosure);

if (
!(trigger instanceof HTMLButtonElement) ||
!(panel instanceof HTMLElement)
) {
return;
}

if (!panel.id) {
panel.id = disclosure-${Math.random().toString(36).slice(2, 9)};
}

trigger.setAttribute("aria-controls", panel.id);

const setExpanded = (expanded) => {
trigger.setAttribute("aria-expanded", String(expanded));
panel.hidden = !expanded;
disclosure.classList.toggle("is-open", expanded);
};

setExpanded(trigger.getAttribute("aria-expanded") === "true");

trigger.addEventListener("click", () => {
setExpanded(trigger.getAttribute("aria-expanded") !== "true");
});

trigger.addEventListener("keydown", (event) => {
if (event.key === "Escape" && trigger.getAttribute("aria-expanded") === "true") {
event.preventDefault();
setExpanded(false);
focusElement(trigger);
}
});
});
}

/**

Applies loading hints and observes deferred media.
*/
function initialiseLazyMedia() {
selectAll("img").forEach((image, index) => {
if (!(image instanceof HTMLImageElement)) {
return;
}

if (!image.hasAttribute("decoding")) {
image.decoding = "async";
}

const isPriority =
image.hasAttribute("fetchpriority") ||
image.dataset.priority === "true" ||
index === 0;

if (!isPriority && !image.hasAttribute("loading")) {
image.loading = "lazy";
}

const markLoaded = () => {
image.classList.add("is-loaded");
image.closest("[data-media-container]")?.classList.add("is-loaded");
};

if (image.complete && image.naturalWidth > 0) {
markLoaded();
} else {
image.addEventListener("load", markLoaded, { once: true });
image.addEventListener(
"error",
() => {
image.classList.add("has-error");
image.closest("[data-media-container]")?.classList.add("has-error");
},
{ once: true }
);
}
});

selectAll("iframe:not([loading])").forEach((iframe) => {
  if (iframe instanceof HTMLIFrameElement) {
    iframe.loading = "lazy";
  }
});

const deferredMedia = selectAll("[data-lazy-src], [data-lazy-background]");

if (deferredMedia.length === 0) {
  return;
}

const loadMedia = (element) => {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (element.dataset.lazySrc) {
    if (
      element instanceof HTMLImageElement ||
      element instanceof HTMLIFrameElement ||
      element instanceof HTMLVideoElement ||
      element instanceof HTMLSourceElement
    ) {
      element.src = element.dataset.lazySrc;
    }

    delete element.dataset.lazySrc;
  }

  if (element.dataset.lazySrcset) {
    if (
      element instanceof HTMLImageElement ||
      element instanceof HTMLSourceElement
    ) {
      element.srcset = element.dataset.lazySrcset;
    }

    delete element.dataset.lazySrcset;
  }

  if (element.dataset.lazyBackground) {
    const backgroundUrl = parseUrl(element.dataset.lazyBackground);

    if (backgroundUrl) {
      element.style.backgroundImage = `url("${backgroundUrl.href}")`;
    }

    delete element.dataset.lazyBackground;
  }

  if (element instanceof HTMLVideoElement) {
    element.load();
  }

  element.classList.add("is-lazy-loaded");
};

if (!("IntersectionObserver" in window)) {
  deferredMedia.forEach(loadMedia);
  return;
}

const observer = new IntersectionObserver(
  (entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      loadMedia(entry.target);
      instance.unobserve(entry.target);
    });
  },
  { rootMargin: "300px 0px" }
);

deferredMedia.forEach((element) => observer.observe(element));

}

/**

Pauses non-essential videos while they are outside the viewport.
*/
function initialiseVideoPerformance() {
const videos = selectAll("video[data-auto-pause]");
if (videos.length === 0 || !("IntersectionObserver" in window)) {
  return;
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const video = entry.target;

      if (!(video instanceof HTMLVideoElement)) {
        return;
      }

      if (!entry.isIntersecting && !video.paused) {
        video.dataset.wasPlaying = "true";
        video.pause();
      } else if (
        entry.isIntersecting &&
        video.dataset.wasPlaying === "true" &&
        !media.reducedMotion.matches
      ) {
        video.play().catch(() => {
          // Autoplay may be blocked by the browser.
        });

        delete video.dataset.wasPlaying;
      }
    });
  },
  { threshold: 0.15 }
);

videos.forEach((video) => observer.observe(video));

}

/**

Reveals marked elements as they enter the viewport.
*/
function initialiseScrollAnimations() {
const elements = selectAll("[data-reveal], .reveal-on-scroll");
if (elements.length === 0) {
  return;
}

if (media.reducedMotion.matches || !("IntersectionObserver" in window)) {
  elements.forEach((element) => element.classList.add("is-revealed"));
  return;
}

document.documentElement.classList.add("supports-scroll-reveal");

const observer = new IntersectionObserver(
  (entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      const element = entry.target;
      const delay = Number.parseInt(
        element.getAttribute("data-reveal-delay") || "0",
        10
      );

      window.setTimeout(() => {
        element.classList.add("is-revealed");
        element.dispatchEvent(createSiteEvent("revealed"));
      }, Math.max(0, Math.min(delay, 1000)));

      if (element.getAttribute("data-reveal-repeat") !== "true") {
        instance.unobserve(element);
      }
    });
  },
  {
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.1
  }
);

elements.forEach((element) => observer.observe(element));

}

/**

Initialises the shared back-to-top control.
*/
function initialiseBackToTop() {
const button = select("[data-back-to-top], .back-to-top");
if (!(button instanceof HTMLElement)) {
  return;
}

const threshold = Number.parseInt(
  button.dataset.showAfter || "600",
  10
);

const updateVisibility = () => {
  const isVisibleNow = window.scrollY >= threshold;

  button.classList.toggle("is-visible", isVisibleNow);
  button.setAttribute("aria-hidden", String(!isVisibleNow));

  if ("disabled" in button) {
    button.disabled = !isVisibleNow;
  }
};

button.addEventListener("click", (event) => {
  event.preventDefault();

  window.scrollTo({
    top: 0,
    behavior: media.reducedMotion.matches ? "auto" : "smooth"
  });

  const main = select("main");

  if (main instanceof HTMLElement) {
    window.setTimeout(() => {
      focusElement(main);
    }, media.reducedMotion.matches ? 0 : 350);
  }
});

const throttledUpdate = throttleFrame(updateVisibility);

updateVisibility();
window.addEventListener("scroll", throttledUpdate, { passive: true });

}

/**

Updates shared copyright-year placeholders.
*/
function initialiseCurrentYear() {
const currentYear = String(new Date().getFullYear());
selectAll("[data-current-year]").forEach((element) => {
  element.textContent = currentYear;
});

}

/**

Adds safe defaults to links that open a new browsing context.
*/
function initialiseExternalLinks() {
selectAll("a[target='_blank']").forEach((link) => {
if (!(link instanceof HTMLAnchorElement)) {
return;
}

const relValues = new Set(
(link.getAttribute("rel") || "")
.split(/\s+/)
.filter(Boolean)
);

relValues.add("noopener");
relValues.add("noreferrer");
link.setAttribute("rel", Array.from(relValues).join(" "));
});
}

/**

Improves form feedback without replacing server-side validation.
*/
function initialiseAccessibleForms() {
selectAll("form").forEach((form) => {
if (!(form instanceof HTMLFormElement)) {
return;
}

form.addEventListener(
"invalid",
(event) => {
const field = event.target;

 if (!(field instanceof HTMLElement)) {
   return;
 }

 field.setAttribute("aria-invalid", "true");

 const describedBy = field.getAttribute("aria-describedby");
 const errorId = field.getAttribute("data-error-id");

 if (errorId && !describedBy) {
   field.setAttribute("aria-describedby", errorId);
 }

},
true
);

form.addEventListener("input", (event) => {
const field = event.target;

if (
field instanceof HTMLInputElement ||
field instanceof HTMLSelectElement ||
field instanceof HTMLTextAreaElement
) {
if (field.validity.valid) {
field.removeAttribute("aria-invalid");
}
}
});

form.addEventListener("submit", () => {
const submitButtons = selectAll(
"button[type='submit'], input[type='submit']",
form
);

submitButtons.forEach((button) => {
if (button instanceof HTMLElement) {
button.setAttribute("aria-busy", "true");
}
});
});
});
}

/**

Marks keyboard navigation so focus styles can be tailored accurately.
*/
function initialiseInputModality() {
const useKeyboardMode = (event) => {
if (event.key === "Tab") {
document.documentElement.classList.add("is-keyboard-user");
}
};
const usePointerMode = () => {
  document.documentElement.classList.remove("is-keyboard-user");
};

document.addEventListener("keydown", useKeyboardMode);
document.addEventListener("pointerdown", usePointerMode, {
  passive: true
});

}

/**

Responds safely when the browser's motion preference changes.
*/
function initialiseMotionPreference() {
const updateMotionPreference = (event) => {
document.documentElement.classList.toggle(
"prefers-reduced-motion",
event.matches
);

if (event.matches) {
selectAll("[data-reveal], .reveal-on-scroll").forEach((element) => {
element.classList.add("is-revealed");
});

selectAll("video[autoplay]").forEach((video) => {
if (video instanceof HTMLVideoElement) {
video.pause();
}
});
}
};

updateMotionPreference(media.reducedMotion);
if (typeof media.reducedMotion.addEventListener === "function") {
  media.reducedMotion.addEventListener(
    "change",
    updateMotionPreference
  );
} else {
  media.reducedMotion.addListener(updateMotionPreference);
}

}

/**

Handles shared Escape-key behaviour for optional custom overlays.
*/
function initialiseGlobalEscapeHandling() {
document.addEventListener("keydown", (event) => {
if (
event.key !== "Escape" ||
!(state.activeOverlay instanceof HTMLElement)
) {
return;
}

const closeControl = select("[data-overlay-close]", state.activeOverlay);

if (closeControl instanceof HTMLElement) {
event.preventDefault();
closeControl.click();
}
});
}

/**

Registers global utilities for other first-party website scripts.
This intentionally exposes only generic helpers and no commerce logic.
*/
function exposeUtilities() {
const utilities = Object.freeze({
announce,
debounce,
getFocusableElements,
scrollToElement,
select,
selectAll,
throttleFrame
});
Object.defineProperty(window, "WiseKingSite", {
  configurable: false,
  enumerable: false,
  writable: false,
  value: utilities
});

}

/**

Initialises all shared website functionality.
*/
function initialiseSite() {
document.documentElement.classList.remove("no-js");
document.documentElement.classList.add("js");
initialiseLiveRegion();
initialiseInputModality();
initialiseMotionPreference();
initialiseSkipLink();
initialiseStickyHeader();
initialiseMobileMenu();
initialiseNavigationDropdowns();
initialiseSmoothScrolling();
initialiseCurrentNavigation();
initialiseDisclosures();
initialiseLazyMedia();
initialiseVideoPerformance();
initialiseScrollAnimations();
initialiseBackToTop();
initialiseCurrentYear();
initialiseExternalLinks();
initialiseAccessibleForms();
initialiseGlobalEscapeHandling();
exposeUtilities();

document.documentElement.classList.add("site-is-ready");
document.dispatchEvent(createSiteEvent("ready"));

}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", initialiseSite, {
once: true
});
} else {
initialiseSite();
}
})();
