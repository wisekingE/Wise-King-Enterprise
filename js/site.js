/**
 * Wise King Enterprise — shared site behaviour
 * This file contains no checkout, cart, Shopify or Square logic.
 */
(function initialiseSite(global, document) {
  "use strict";

  const root = document.documentElement;

  root.classList.remove("no-js");
  root.classList.add("js");

  function select(selector, context) {
    return (context || document).querySelector(selector);
  }

  function selectAll(selector, context) {
    return Array.from(
      (context || document).querySelectorAll(selector)
    );
  }

  function initialiseCurrentYear() {
    const year = String(new Date().getFullYear());

    selectAll("[data-current-year]").forEach(function updateYear(element) {
      element.textContent = year;
    });
  }

  function initialiseMobileMenu() {
    const toggle = select("[data-menu-toggle]");
    const menu = select("[data-mobile-menu]");

    if (!toggle || !menu) {
      return;
    }

    function isOpen() {
      return toggle.getAttribute("aria-expanded") === "true";
    }

    function setMenuState(open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute(
        "aria-label",
        open ? "Close navigation menu" : "Open navigation menu"
      );
      menu.setAttribute("aria-hidden", String(!open));
      menu.classList.toggle("is-open", open);
      menu.classList.toggle("open", open);
      document.body.classList.toggle("menu-open", open);
    }

    toggle.addEventListener("click", function toggleMenu() {
      setMenuState(!isOpen());
    });

    menu.addEventListener("click", function closeAfterNavigation(event) {
      if (event.target.closest("a")) {
        setMenuState(false);
      }
    });

    document.addEventListener("keydown", function closeWithEscape(event) {
      if (event.key === "Escape" && isOpen()) {
        setMenuState(false);
        toggle.focus();
      }
    });

    document.addEventListener("click", function closeOutsideMenu(event) {
      if (
        isOpen() &&
        !menu.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        setMenuState(false);
      }
    });

    const desktopQuery = global.matchMedia("(min-width: 1021px)");

    function closeAtDesktop(event) {
      if (event.matches) {
        setMenuState(false);
      }
    }

    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", closeAtDesktop);
    } else if (typeof desktopQuery.addListener === "function") {
      desktopQuery.addListener(closeAtDesktop);
    }
  }

  function initialiseBackToTop() {
    const button = select("[data-back-to-top]");

    if (!button) {
      return;
    }

    const showAfter = Number(button.dataset.showAfter) || 600;
    let scheduled = false;

    function updateButton() {
      const visible = global.scrollY >= showAfter;

      button.classList.toggle("is-visible", visible);
      button.setAttribute("aria-hidden", String(!visible));
      button.disabled = !visible;
      scheduled = false;
    }

    function scheduleUpdate() {
      if (!scheduled) {
        scheduled = true;
        global.requestAnimationFrame(updateButton);
      }
    }

    button.addEventListener("click", function returnToTop() {
      global.scrollTo({
        top: 0,
        behavior: global.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
          ? "auto"
          : "smooth",
      });
    });

    global.addEventListener("scroll", scheduleUpdate, {
      passive: true,
    });

    updateButton();
  }

  function initialiseFocusLinks() {
    selectAll('a[href^="#"]').forEach(function prepareAnchor(link) {
      link.addEventListener("click", function focusAnchor() {
        const identifier = link.getAttribute("href");

        if (!identifier || identifier === "#") {
          return;
        }

        const target = select(identifier);

        if (!target) {
          return;
        }

        global.setTimeout(function moveFocus() {
          if (!target.hasAttribute("tabindex")) {
            target.setAttribute("tabindex", "-1");
          }

          target.focus({
            preventScroll: true,
          });
        }, 0);
      });
    });
  }

  function initialiseRevealElements() {
    const elements = selectAll("[data-reveal]");

    if (!elements.length) {
      return;
    }

    if (
      !("IntersectionObserver" in global) ||
      global.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches
    ) {
      elements.forEach(function reveal(element) {
        element.classList.add("is-revealed");
      });

      return;
    }

    const observer = new IntersectionObserver(
      function revealEntries(entries) {
        entries.forEach(function revealEntry(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    elements.forEach(function observe(element) {
      observer.observe(element);
    });
  }

  function start() {
    initialiseCurrentYear();
    initialiseMobileMenu();
    initialiseBackToTop();
    initialiseFocusLinks();
    initialiseRevealElements();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {
      once: true,
    });
  } else {
    start();
  }
})(globalThis, document);
