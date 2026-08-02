/**
 * Wise King Enterprise — catalogue utilities and shop renderer
 * Product data is supplied exclusively by data/products.js.
 */
(function initialiseCatalogue(global, document) {
  "use strict";

  const source = global.WISE_KING_CATALOGUE || {};
  const products = Array.isArray(source.products) ? source.products : [];
  const categories = Array.isArray(source.categories) ? source.categories : [];

  function normalise(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function isActiveProduct(product) {
    return Boolean(
      product &&
      product.isPublic === true &&
      normalise(product.status) === "active"
    );
  }

  function getActiveProducts() {
    return products.filter(isActiveProduct);
  }

  function getProductBySlug(slug) {
    const requestedSlug = normalise(slug);

    if (!requestedSlug) {
      return null;
    }

    return products.find(function findProduct(product) {
      return normalise(product && product.slug) === requestedSlug;
    }) || null;
  }

  function getCategoryById(identifier) {
    const requestedIdentifier = normalise(identifier);

    if (!requestedIdentifier) {
      return null;
    }

    return categories.find(function findCategory(category) {
      return (
        normalise(category && category.id) === requestedIdentifier ||
        normalise(category && category.slug) === requestedIdentifier
      );
    }) || null;
  }

  function getCategoryFilter(product) {
    const category = getCategoryById(product && product.category);

    if (!category) {
      return normalise(product && product.category);
    }

    return normalise(category.shopLabel || category.slug || category.id);
  }

  function formatPrice(product) {
    const amount = Number(product && product.price);

    if (!Number.isFinite(amount)) {
      return "";
    }

    try {
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: product.currency || "AUD",
      }).format(amount);
    } catch (error) {
      return "$" + amount.toFixed(2);
    }
  }

  function getCardImage(product) {
    const media = product && product.media ? product.media : {};

    return {
      src: media.cardImage || product.image || "",
      alt: media.cardImageAlt || product.imageAlt || product.name || "",
    };
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);

    if (className) {
      element.className = className;
    }

    if (text !== undefined && text !== null && text !== "") {
      element.textContent = String(text);
    }

    return element;
  }

  function createProductCard(product, productPage) {
    const article = createElement("article", "product-card");
    const link = createElement("a", "product-card__link");
    const imageData = getCardImage(product);
    const imageWrapper = createElement("div", "product-card__media");
    const content = createElement("div", "product-card__content");
    const category = getCategoryById(product.category);
    const categoryName = category ? category.name : product.category;
    const price = formatPrice(product);

    article.dataset.category = getCategoryFilter(product);
    link.href =
      (productPage || "product-new.html") +
      "?product=" +
      encodeURIComponent(product.slug);
    link.setAttribute("aria-label", "View " + product.name);

    if (imageData.src) {
      const image = createElement("img", "product-card__image");

      image.src = imageData.src;
      image.alt = imageData.alt;
      image.loading = "lazy";
      image.decoding = "async";
      imageWrapper.appendChild(image);
    }

    if (categoryName) {
      content.appendChild(
        createElement("p", "product-card__category", categoryName)
      );
    }

    content.appendChild(
      createElement("h3", "product-card__title", product.name)
    );

    if (product.size) {
      content.appendChild(
        createElement("p", "product-card__size", product.size)
      );
    }

    if (price) {
      content.appendChild(
        createElement("p", "product-card__price", price)
      );
    }

    content.appendChild(
      createElement(
        "span",
        "button button--secondary product-card__button",
        "View product"
      )
    );

    link.append(imageWrapper, content);
    article.appendChild(link);

    return article;
  }

  function initialiseShopCatalogue() {
    const container = document.querySelector("[data-product-catalogue]");

    if (!container) {
      return;
    }

    const loading = document.querySelector("[data-catalogue-loading]");
    const empty = document.querySelector("[data-catalogue-empty]");
    const error = document.querySelector("[data-catalogue-error]");
    const count = document.querySelector("[data-product-count]");
    const filters = Array.from(
      document.querySelectorAll("[data-category-filter]")
    );
    const productPage =
      container.dataset.productPage ||
      document.documentElement.dataset.productPage ||
      "product-new.html";
    const activeProducts = getActiveProducts();
    let selectedCategory = "all";

    function setHidden(element, hidden) {
      if (element) {
        element.hidden = hidden;
      }
    }

    function render() {
      const visibleProducts = activeProducts.filter(
        function filterProduct(product) {
          return (
            selectedCategory === "all" ||
            getCategoryFilter(product) === selectedCategory
          );
        }
      );

      container.replaceChildren();

      visibleProducts.forEach(function appendProduct(product) {
        container.appendChild(createProductCard(product, productPage));
      });

      container.setAttribute("aria-busy", "false");
      setHidden(loading, true);
      setHidden(error, true);
      setHidden(empty, visibleProducts.length !== 0);

      if (empty) {
        empty.textContent =
          selectedCategory === "all"
            ? container.dataset.emptyMessage ||
              "No products are currently available."
            : container.dataset.emptyCategoryMessage ||
              "No products are currently available in this category.";
      }

      if (count) {
        count.textContent =
          visibleProducts.length === 1
            ? "1 product"
            : String(visibleProducts.length) + " products";
      }
    }

    filters.forEach(function prepareFilter(button) {
      const filterValue = normalise(
        button.dataset.categoryFilter || button.dataset.category
      );
      const hasProducts =
        filterValue === "all" ||
        activeProducts.some(function hasMatchingProduct(product) {
          return getCategoryFilter(product) === filterValue;
        });

      button.hidden = !hasProducts;

      button.addEventListener("click", function filterCatalogue() {
        selectedCategory = filterValue || "all";

        filters.forEach(function updateFilterState(filterButton) {
          const isSelected = filterButton === button;

          filterButton.classList.toggle("is-active", isSelected);
          filterButton.setAttribute("aria-pressed", String(isSelected));
        });

        render();
      });
    });

    try {
      render();
    } catch (errorValue) {
      container.setAttribute("aria-busy", "false");
      setHidden(loading, true);
      setHidden(empty, true);
      setHidden(error, false);

      if (count) {
        count.textContent = "Products unavailable";
      }
    }
  }

  global.WiseKingCatalogue = Object.freeze({
    products: products,
    categories: categories,
    isActiveProduct: isActiveProduct,
    getActiveProducts: getActiveProducts,
    getProductBySlug: getProductBySlug,
    getCategoryById: getCategoryById,
    formatPrice: formatPrice,
  });

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialiseShopCatalogue,
      { once: true }
    );
  } else {
    initialiseShopCatalogue();
  }
})(globalThis, document);
