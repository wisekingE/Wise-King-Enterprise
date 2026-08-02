/**

Wise King Enterprise — Product Catalogue
File: js/catalogue.js
Renders public product and category displays from data/products.js.
Product data remains the single source of truth. This file contains
no cart, Shopify or checkout logic.
*/

(() => {
"use strict";

const NAMESPACE = "wiseKing";
const DEFAULT_PRODUCT_PAGE = "product-new.html";
const PRODUCT_SOURCE_EVENT = '${NAMESPACE}:products-ready';

const SELECTORS = Object.freeze({
featuredContainer:
"[data-featured-products], [data-products-featured], .featured-products__grid",
catalogueContainer:
"[data-product-catalogue], [data-product-grid], .shop-products__grid",
categoryFilter:
"[data-category-filter], [data-product-category], .shop-category-filter",
categoryFiltersContainer:
"[data-category-filters], .shop-category-filters",
categoryCount: "[data-category-count], [data-product-count]",
emptyState: "[data-catalogue-empty], [data-products-empty]",
loadingState: "[data-catalogue-loading], [data-products-loading]",
errorState: "[data-catalogue-error], [data-products-error]"
});

const state = {
allProducts: [],
publicProducts: [],
activeCategory: "all",
initialised: false
};

/**

Safely returns the first matching element.
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

Safely returns all matching elements.
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

Creates a catalogue CustomEvent.
@param {string} name
@param {Record<string, unknown>} [detail={}]
@returns {CustomEvent}
*/
function createCatalogueEvent(name, detail = {}) {
return new CustomEvent(${NAMESPACE}:catalogue-${name}, {
bubbles: true,
detail
});
}

/**

Converts a value into a trimmed string.
@param {unknown} value
@param {string} [fallback=""]
@returns {string}
*/
function toText(value, fallback = "") {
return typeof value === "string" && value.trim()
? value.trim()
: fallback;
}

/**

Returns the first defined value from a list.
@param {...unknown} values
@returns {unknown}
*/
function firstDefined(...values) {
return values.find((value) => value !== undefined && value !== null);
}

/**

Interprets common data values as booleans.
@param {unknown} value
@param {boolean} fallback
@returns {boolean}
*/
function toBoolean(value, fallback) {
if (typeof value === "boolean") {
return value;
}
if (typeof value === "number") {
  return value !== 0;
}

if (typeof value === "string") {
  const normalised = value.trim().toLowerCase();

  if (["true", "yes", "1", "active", "public", "available"].includes(normalised)) {
    return true;
  }

  if (
    ["false", "no", "0", "inactive", "hidden", "archived", "unavailable"].includes(
      normalised
    )
  ) {
    return false;
  }
}

return fallback;

}

/**

Converts a category or status value into a comparable key.
@param {unknown} value
@returns {string}
*/
function normaliseKey(value) {
return toText(value)
.toLowerCase()
.replace(/&/g, "and")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "");
}

/**

Creates a slug when a valid product slug has not been supplied.
@param {unknown} value
@returns {string}
*/
function createSlug(value) {
return normaliseKey(value);
}

/**

Returns a safe URL for an image or link.
@param {unknown} value
@returns {string}
*/
function safeUrl(value) {
const url = toText(value);
if (!url) {
  return "";
}

try {
  const parsed = new URL(url, window.location.href);

  if (!["http:", "https:", "file:"].includes(parsed.protocol)) {
    return "";
  }

  return url;
} catch {
  return "";
}

}

/**

Extracts an array from a supported product-data container.
@param {unknown} source
@returns {unknown[]}
*/
function extractProductArray(source) {
if (Array.isArray(source)) {
return source;
}
if (!source || typeof source !== "object") {
  return [];
}

const possibleCollections = [
  source.products,
  source.catalogue,
  source.catalog,
  source.items,
  source.data
];

const collection = possibleCollections.find(Array.isArray);
return collection || [];

}

/**

Reads the catalogue exposed by data/products.js.
Supported global containers allow the central data file to evolve without
requiring page-specific product definitions.
@returns {unknown[]}
*/
function readProductSource() {
const sources = [
window.WiseKingProducts,
window.wiseKingProducts,
window.WISE_KING_PRODUCTS,
window.WiseKingProductData,
window.PRODUCTS,
window.products
];
for (const source of sources) {
  const products = extractProductArray(source);

  if (products.length > 0) {
    return products;
  }
}

return [];

}

/**

Determines whether a product may appear in public website areas.
A product must be active, public and available. Explicit hidden, archived,
draft, private or unavailable values always take precedence.
@param {Record<string, unknown>} product
@returns {boolean}
*/
function isPublicProduct(product) {
if (!product || typeof product !== "object") {
return false;
}
const status = normaliseKey(
  firstDefined(product.status, product.state, product.lifecycle)
);

const availabilityStatus = normaliseKey(
  firstDefined(
    product.availabilityStatus,
    product.availability,
    product.stockStatus
  )
);

const excludedStatuses = new Set([
  "hidden",
  "archived",
  "archive",
  "draft",
  "private",
  "inactive",
  "disabled",
  "deleted",
  "unavailable",
  "out-of-stock",
  "sold-out",
  "coming-soon"
]);

if (
  excludedStatuses.has(status) ||
  excludedStatuses.has(availabilityStatus)
) {
  return false;
}

const isActive = toBoolean(
  firstDefined(product.active, product.isActive, product.enabled),
  status ? status === "active" || status === "published" : true
);

const isPublic = toBoolean(
  firstDefined(
    product.public,
    product.isPublic,
    product.published,
    product.visible
  ),
  true
);

const isHidden = toBoolean(
  firstDefined(product.hidden, product.isHidden),
  false
);

const isArchived = toBoolean(
  firstDefined(product.archived, product.isArchived),
  false
);

const isAvailable = toBoolean(
  firstDefined(
    product.available,
    product.isAvailable,
    product.inStock,
    product.forSale
  ),
  true
);

return (
  isActive &&
  isPublic &&
  isAvailable &&
  !isHidden &&
  !isArchived
);

}

/**

Extracts the primary product category.
@param {Record<string, unknown>} product
@returns {string}
*/
function getProductCategory(product) {
const rawCategory = firstDefined(
product.category,
product.shopCategory,
product.useCategory,
product.collection,
product.group
);
if (Array.isArray(rawCategory)) {
  return toText(rawCategory[0]);
}

if (rawCategory && typeof rawCategory === "object") {
  return toText(
    firstDefined(rawCategory.name, rawCategory.label, rawCategory.slug)
  );
}

return toText(rawCategory);

}

/**

Returns all category keys assigned to a product.
@param {Record<string, unknown>} product
@returns {string[]}
*/
function getProductCategoryKeys(product) {
const rawCategories = firstDefined(
product.categories,
product.category,
product.shopCategory,
product.useCategory,
product.collection,
product.group
);
const values = Array.isArray(rawCategories)
  ? rawCategories
  : [rawCategories];

return values
  .flatMap((value) => {
    if (value && typeof value === "object") {
      return [
        firstDefined(value.slug, value.name, value.label, value.id)
      ];
    }

    return [value];
  })
  .map(normaliseKey)
  .filter(Boolean);

}

/**

Resolves the main product image from common data structures.
@param {Record<string, unknown>} product
@returns {{src: string, alt: string}}
*/
function getProductImage(product) {
const imageCollection = Array.isArray(product.images)
? product.images
: [];
const primaryImage =
  imageCollection.find(
    (image) =>
      image &&
      typeof image === "object" &&
      toBoolean(firstDefined(image.primary, image.isPrimary), false)
  ) || imageCollection[0];

let src = "";
let alt = "";

if (typeof primaryImage === "string") {
  src = primaryImage;
} else if (primaryImage && typeof primaryImage === "object") {
  src = toText(
    firstDefined(
      primaryImage.src,
      primaryImage.url,
      primaryImage.path,
      primaryImage.image
    )
  );
  alt = toText(primaryImage.alt);
}

src = toText(
  firstDefined(
    src,
    product.image,
    product.imageUrl,
    product.imageSrc,
    product.thumbnail,
    product.featuredImage
  )
);

return {
  src: safeUrl(src),
  alt: alt || toText(product.imageAlt) || toText(product.name, "Product")
};

}

/**

Reads the product price without assuming one fixed source schema.
@param {Record<string, unknown>} product
@returns {{amount: number|null, currency: string, display: string}}
*/
function getProductPrice(product) {
const priceValue = firstDefined(
product.price,
product.retailPrice,
product.salePrice,
product.currentPrice
);
let amount = null;
let currency = toText(product.currency, "AUD").toUpperCase();
let display = "";

if (typeof priceValue === "number" && Number.isFinite(priceValue)) {
  amount = priceValue;
} else if (typeof priceValue === "string") {
  display = priceValue.trim();

  const numericValue = Number.parseFloat(
    display.replace(/[^0-9.-]/g, "")
  );

  if (Number.isFinite(numericValue)) {
    amount = numericValue;
  }
} else if (priceValue && typeof priceValue === "object") {
  const nestedAmount = firstDefined(
    priceValue.amount,
    priceValue.value,
    priceValue.price
  );

  if (typeof nestedAmount === "number" && Number.isFinite(nestedAmount)) {
    amount = nestedAmount;
  } else if (typeof nestedAmount === "string") {
    const numericValue = Number.parseFloat(
      nestedAmount.replace(/[^0-9.-]/g, "")
    );

    if (Number.isFinite(numericValue)) {
      amount = numericValue;
    }
  }

  currency = toText(priceValue.currency, currency).toUpperCase();
  display = toText(
    firstDefined(priceValue.display, priceValue.formatted)
  );
}

return { amount, currency, display };

}

/**

Formats a product price for display.
@param {{amount: number|null, currency: string, display: string}} price
@returns {string}
*/
function formatPrice(price) {
if (price.display) {
return price.display;
}
if (!Number.isFinite(price.amount)) {
  return "";
}

try {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: price.currency || "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price.amount);
} catch {
  return `$${price.amount.toFixed(2)}`;
}

}

/**

Creates a product-detail URL using its slug.
The page can override the destination with data-product-page.
@param {string} slug
@param {HTMLElement|null} [container=null]
@returns {string}
*/
function createProductLink(slug, container = null) {
const productPage =
toText(container?.dataset.productPage) ||
toText(document.documentElement.dataset.productPage) ||
DEFAULT_PRODUCT_PAGE;
const url = new URL(productPage, window.location.href);
url.searchParams.set("product", slug);

return `${url.pathname}${url.search}${url.hash}`;

}

/**

Normalises a product into a stable public-facing shape.
The returned data attributes and detail object are ready for future cart
integration, but this file performs no cart operations.
@param {Record<string, unknown>} product
@param {number} sourceIndex
@returns {Record<string, unknown>|null}
*/
function normaliseProduct(product, sourceIndex) {
if (!product || typeof product !== "object") {
return null;
}
const name = toText(
  firstDefined(product.name, product.title, product.productName)
);

const slug = createSlug(
  firstDefined(product.slug, product.handle, product.urlSlug, name)
);

if (!name || !slug) {
  return null;
}

const price = getProductPrice(product);
const image = getProductImage(product);
const category = getProductCategory(product);
const categoryKeys = getProductCategoryKeys(product);
const id = toText(
  firstDefined(product.id, product.productId, product.sku, slug)
);

return Object.freeze({
  id,
  sku: toText(product.sku),
  name,
  slug,
  category,
  categoryKeys,
  description: toText(
    firstDefined(
      product.shortDescription,
      product.cardDescription,
      product.description,
      product.summary
    )
  ),
  size: toText(
    firstDefined(product.size, product.packSize, product.weight)
  ),
  badge: toText(firstDefined(product.badge, product.label)),
  image,
  price,
  formattedPrice: formatPrice(price),
  featured: toBoolean(
    firstDefined(product.featured, product.isFeatured),
    false
  ),
  featuredOrder: Number.isFinite(Number(product.featuredOrder))
    ? Number(product.featuredOrder)
    : sourceIndex,
  sortOrder: Number.isFinite(Number(product.sortOrder))
    ? Number(product.sortOrder)
    : sourceIndex,
  source: product
});

}

/**

Creates an HTML element with optional class and text.
@param {string} tagName
@param {string} [className=""]
@param {string} [textContent=""]
@returns {HTMLElement}
*/
function createElement(tagName, className = "", textContent = "") {
const element = document.createElement(tagName);
if (className) {
  element.className = className;
}

if (textContent) {
  element.textContent = textContent;
}

return element;

}

/**

Creates one reusable product card.
@param {Record<string, unknown>} product
@param {HTMLElement|null} [container=null]
@returns {HTMLElement}
*/
function createProductCard(product, container = null) {
const article = createElement("article", "product-card");
const link = createElement("a", "product-card__link");
const media = createElement("div", "product-card__media");
const content = createElement("div", "product-card__content");
const title = createElement("h3", "product-card__title", product.name);
const productUrl = createProductLink(product.slug, container);
article.dataset.productId = product.id;
article.dataset.productSlug = product.slug;
article.dataset.productName = product.name;
article.dataset.productCategory = product.categoryKeys.join(" ");
article.dataset.productAvailable = "true";

if (product.sku) {
  article.dataset.productSku = product.sku;
}

if (Number.isFinite(product.price.amount)) {
  article.dataset.productPrice = String(product.price.amount);
  article.dataset.productCurrency = product.price.currency;
}

link.href = productUrl;
link.setAttribute("aria-label", `View ${product.name}`);

if (product.image.src) {
  const image = document.createElement("img");
  image.className = "product-card__image";
  image.src = product.image.src;
  image.alt = product.image.alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.width = 600;
  image.height = 600;
  media.append(image);
} else {
  const placeholder = createElement(
    "div",
    "product-card__image-placeholder"
  );
  placeholder.setAttribute("aria-hidden", "true");
  media.append(placeholder);
  article.classList.add("product-card--no-image");
}

if (product.badge) {
  media.append(
    createElement("span", "product-card__badge", product.badge)
  );
}

content.append(title);

if (product.category) {
  content.append(
    createElement(
      "p",
      "product-card__category",
      product.category
    )
  );
}

if (product.description) {
  content.append(
    createElement(
      "p",
      "product-card__description",
      product.description
    )
  );
}

const meta = createElement("div", "product-card__meta");

if (product.size) {
  meta.append(
    createElement("span", "product-card__size", product.size)
  );
}

if (product.formattedPrice) {
  meta.append(
    createElement(
      "span",
      "product-card__price",
      product.formattedPrice
    )
  );
}

if (meta.childElementCount > 0) {
  content.append(meta);
}

content.append(
  createElement("span", "product-card__action", "View product")
);

link.append(media, content);
article.append(link);

article.dispatchEvent(
  createCatalogueEvent("card-created", {
    product: getCommerceProductData(product)
  })
);

return article;

}

/**

Returns a limited, stable product object for future commerce scripts.
@param {Record<string, unknown>} product
@returns {Readonly<Record<string, unknown>>}
*/
function getCommerceProductData(product) {
return Object.freeze({
id: product.id,
sku: product.sku,
name: product.name,
slug: product.slug,
category: product.category,
categories: [...product.categoryKeys],
size: product.size,
price: product.price.amount,
currency: product.price.currency,
formattedPrice: product.formattedPrice,
image: product.image.src,
available: true
});
}

/**

Replaces a product container's contents with product cards.
@param {HTMLElement} container
@param {Record<string, unknown>[]} products
@param {string} emptyMessage
*/
function renderProductCollection(container, products, emptyMessage) {
const fragment = document.createDocumentFragment();
products.forEach((product) => {
  fragment.append(createProductCard(product, container));
});

container.replaceChildren(fragment);
container.hidden = products.length === 0;
container.setAttribute("aria-busy", "false");

updateEmptyState(container, products.length === 0, emptyMessage);

}

/**

Shows or hides the nearest suitable empty-state message.
@param {HTMLElement} container
@param {boolean} isEmpty
@param {string} message
*/
function updateEmptyState(container, isEmpty, message) {
const scope =
container.closest(
"[data-catalogue-section], [data-products-section], section"
) || container.parentElement;
let emptyState = scope
  ? select(SELECTORS.emptyState, scope)
  : null;

if (!(emptyState instanceof HTMLElement) && isEmpty) {
  emptyState = createElement("p", "catalogue-empty");
  emptyState.dataset.catalogueEmpty = "";
  emptyState.setAttribute("role", "status");
  container.insertAdjacentElement("afterend", emptyState);
}

if (!(emptyState instanceof HTMLElement)) {
  return;
}

emptyState.textContent = message;
emptyState.hidden = !isEmpty;

}

/**

Renders products marked as featured in data/products.js.
*/
function renderFeaturedProducts() {
const containers = selectAll(SELECTORS.featuredContainer);
containers.forEach((container) => {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const limitValue = Number.parseInt(
    container.dataset.featuredLimit || container.dataset.limit || "4",
    10
  );

  const limit = Number.isFinite(limitValue) && limitValue > 0
    ? limitValue
    : 4;

  const featured = state.publicProducts
    .filter((product) => product.featured)
    .sort(
      (first, second) =>
        first.featuredOrder - second.featuredOrder
    )
    .slice(0, limit);

  renderProductCollection(
    container,
    featured,
    toText(
      container.dataset.emptyMessage,
      "Featured products will be available soon."
    )
  );
});

}

/**

Returns products belonging to a selected category.
@param {string} category
@returns {Record<string, unknown>[]}
*/
function filterProductsByCategory(category) {
const categoryKey = normaliseKey(category);
if (!categoryKey || categoryKey === "all") {
  return [...state.publicProducts];
}

return state.publicProducts.filter((product) =>
  product.categoryKeys.includes(categoryKey)
);

}

/**

Updates the catalogue result count.
@param {number} count
@param {HTMLElement|null} [scope=null]
*/
function updateProductCount(count, scope = null) {
const context = scope || document;
selectAll(SELECTORS.categoryCount, context).forEach((element) => {
  const singular = toText(element.dataset.singular, "product");
  const plural = toText(element.dataset.plural, "products");
  element.textContent = `${count} ${count === 1 ? singular : plural}`;
});

}

/**

Updates visual and accessible filter states.
@param {string} category
*/
function updateFilterControls(category) {
const activeKey = normaliseKey(category) || "all";
selectAll(SELECTORS.categoryFilter).forEach((control) => {
  const controlCategory = normaliseKey(
    firstDefined(
      control.dataset.category,
      control.dataset.categoryFilter,
      control.value
    )
  ) || "all";

  const isActive = controlCategory === activeKey;
  control.classList.toggle("is-active", isActive);

  if (
    control instanceof HTMLInputElement &&
    ["radio", "checkbox"].includes(control.type)
  ) {
    control.checked = isActive;
  } else {
    control.setAttribute("aria-pressed", String(isActive));
  }

  if (isActive) {
    control.setAttribute("aria-current", "true");
  } else {
    control.removeAttribute("aria-current");
  }
});

}

/**

Renders the main shop catalogue for the selected category.
@param {string} [category="all"]
*/
function renderCatalogue(category = "all") {
const categoryKey = normaliseKey(category) || "all";
const products = filterProductsByCategory(categoryKey).sort(
(first, second) => first.sortOrder - second.sortOrder
);
state.activeCategory = categoryKey;
updateFilterControls(categoryKey);

const containers = selectAll(SELECTORS.catalogueContainer);

containers.forEach((container) => {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const section =
    container.closest(
      "[data-catalogue-section], [data-products-section], .shop-page"
    ) || container.parentElement;

  renderProductCollection(
    container,
    products,
    categoryKey === "all"
      ? toText(
          container.dataset.emptyMessage,
          "No products are currently available."
        )
      : toText(
          container.dataset.emptyCategoryMessage,
          "No products are currently available in this category."
        )
  );

  updateProductCount(products.length, section);
});

document.dispatchEvent(
  createCatalogueEvent("filtered", {
    category: categoryKey,
    count: products.length,
    products: products.map(getCommerceProductData)
  })
);

}

/**

Returns the categories that currently contain public products.
@returns {{key: string, label: string, count: number}[]}
*/
function getAvailableCategories() {
const categories = new Map();
state.publicProducts.forEach((product) => {
  product.categoryKeys.forEach((key, index) => {
    if (!key) {
      return;
    }

    const existing = categories.get(key);
    const label =
      index === 0 && product.category
        ? product.category
        : key
            .split("-")
            .map(
              (word) =>
                word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join(" ");

    if (existing) {
      existing.count += 1;
    } else {
      categories.set(key, { key, label, count: 1 });
    }
  });
});

return Array.from(categories.values());

}

/**

Hides filter controls for categories with no public products.
Existing controls are preserved so future products automatically make
their categories visible again.
*/
function updateCategoryAvailability() {
const availableKeys = new Set(
getAvailableCategories().map((category) => category.key)
);
selectAll(SELECTORS.categoryFilter).forEach((control) => {
  const categoryKey = normaliseKey(
    firstDefined(
      control.dataset.category,
      control.dataset.categoryFilter,
      control.value
    )
  ) || "all";

  const isAvailable =
    categoryKey === "all" || availableKeys.has(categoryKey);

  const wrapper = control.closest("[data-category-option]") || control;
  wrapper.hidden = !isAvailable;
  control.toggleAttribute("disabled", !isAvailable);
  control.setAttribute("aria-hidden", String(!isAvailable));
});

}

/**

Binds category filter controls once.
*/
function initialiseCategoryFilters() {
selectAll(SELECTORS.categoryFilter).forEach((control) => {
if (
!(control instanceof HTMLElement) ||
control.dataset.catalogueBound === "true"
) {
return;
}

control.dataset.catalogueBound = "true";

const applyControlFilter = () => {
const category = toText(
firstDefined(
control.dataset.category,
control.dataset.categoryFilter,
control instanceof HTMLInputElement ||
control instanceof HTMLSelectElement
? control.value
: ""
),
"all"
);

renderCatalogue(category);
};

if (control instanceof HTMLSelectElement) {
control.addEventListener("change", applyControlFilter);
} else if (
control instanceof HTMLInputElement &&
["radio", "checkbox"].includes(control.type)
) {
control.addEventListener("change", () => {
if (control.checked) {
applyControlFilter();
}
});
} else {
control.addEventListener("click", (event) => {
event.preventDefault();
applyControlFilter();
});
}
});
}

/**

Shows or hides shared loading and error states.
@param {"loading"|"ready"|"error"} status
*/
function setCatalogueStatus(status) {
selectAll(SELECTORS.loadingState).forEach((element) => {
element.hidden = status !== "loading";
});
selectAll(SELECTORS.errorState).forEach((element) => {
  element.hidden = status !== "error";
});

[
  ...selectAll(SELECTORS.featuredContainer),
  ...selectAll(SELECTORS.catalogueContainer)
].forEach((container) => {
  container.setAttribute(
    "aria-busy",
    String(status === "loading")
  );
});

document.documentElement.classList.toggle(
  "catalogue-is-loading",
  status === "loading"
);
document.documentElement.classList.toggle(
  "catalogue-is-ready",
  status === "ready"
);
document.documentElement.classList.toggle(
  "catalogue-has-error",
  status === "error"
);

}

/**

Loads, validates and prepares the central catalogue.
@returns {boolean}
*/
function loadProducts() {
const sourceProducts = readProductSource();
if (!Array.isArray(sourceProducts) || sourceProducts.length === 0) {
  return false;
}

state.allProducts = [...sourceProducts];

state.publicProducts = sourceProducts
  .filter(isPublicProduct)
  .map(normaliseProduct)
  .filter(Boolean);

return true;

}

/**

Renders every product-driven public area.
*/
function renderAll() {
updateCategoryAvailability();
initialiseCategoryFilters();
renderFeaturedProducts();
renderCatalogue(state.activeCategory);
setCatalogueStatus("ready");
document.dispatchEvent(
  createCatalogueEvent("ready", {
    count: state.publicProducts.length,
    categories: getAvailableCategories(),
    products: state.publicProducts.map(getCommerceProductData)
  })
);

}

/**

Initialises the catalogue once data/products.js is available.
*/
function initialiseCatalogue() {
if (state.initialised) {
return;
}
setCatalogueStatus("loading");
if (!loadProducts()) {
  window.requestAnimationFrame(() => {
    if (state.initialised) {
      return;
    }

    if (loadProducts()) {
      state.initialised = true;
      renderAll();
    } else {
      setCatalogueStatus("error");

      document.dispatchEvent(
        createCatalogueEvent("error", {
          message:
            "Product data could not be loaded from data/products.js."
        })
      );
    }
  });

  return;
}

state.initialised = true;
renderAll();

}

/**

Refreshes public catalogue displays after the central data changes.
*/
function refreshCatalogue() {
state.initialised = false;
state.allProducts = [];
state.publicProducts = [];
initialiseCatalogue();
}

/**

Exposes a small read-only API for product pages and future cart scripts.
*/
function exposeCatalogueApi() {
const api = Object.freeze({
refresh: refreshCatalogue,

getProducts() {
return state.publicProducts.map(getCommerceProductData);
},

getProductBySlug(slug) {
const requestedSlug = createSlug(slug);
const product = state.publicProducts.find(
(item) => item.slug === requestedSlug
);

return product ? getCommerceProductData(product) : null;
},

getProductsByCategory(category) {
return filterProductsByCategory(category).map(
getCommerceProductData
);
},

getCategories() {
return getAvailableCategories().map((category) => ({
...category
}));
},

createProductLink(slug) {
return createProductLink(createSlug(slug));
}
});

if (!Object.prototype.hasOwnProperty.call(window, "WiseKingCatalogue")) {
  Object.defineProperty(window, "WiseKingCatalogue", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: api
  });
}

}

/**

Starts catalogue functionality after the document is ready.
*/
function start() {
exposeCatalogueApi();
initialiseCatalogue();
document.addEventListener(PRODUCT_SOURCE_EVENT, refreshCatalogue);
document.addEventListener("products:ready", refreshCatalogue);

}

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
start();
}
})();
