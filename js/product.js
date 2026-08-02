/**

Wise King Enterprise — reusable product page renderer
Product data is supplied exclusively by data/products.js.
*/
(function initialiseProductPage(global, document) {
"use strict";

const catalogue = global.WiseKingCatalogue || null;
const source =
global.WISE_KING_CATALOGUE || global.WiseKingProducts || {};

const products = Array.isArray(source)
? source
: Array.isArray(source.products)
? source.products
: catalogue && Array.isArray(catalogue.products)
? catalogue.products
: [];

const categories = Array.isArray(source.categories)
? source.categories
: catalogue && Array.isArray(catalogue.categories)
? catalogue.categories
: [];

function select(selector, context) {
return (context || document).querySelector(selector);
}

function normalise(value) {
return String(value == null ? "" : value).trim().toLowerCase();
}

function hasValue(value) {
return (
value !== undefined &&
value !== null &&
String(value).trim() !== ""
);
}

function toArray(value) {
if (Array.isArray(value)) {
return value;
}

return value === undefined || value === null || value === ""
  ? []
  : [value];

}

function show(element) {
if (element) {
element.hidden = false;
}
}

function hide(element) {
if (element) {
element.hidden = true;
}
}

function setText(selector, value) {
const element = select(selector);

if (element) {
  element.textContent = hasValue(value) ? String(value) : "";
}

}

function isPublicProduct(product) {
if (!product) {
return false;
}

if (
  catalogue &&
  typeof catalogue.isActiveProduct === "function"
) {
  return catalogue.isActiveProduct(product);
}

return (
  product.isPublic === true &&
  normalise(product.status) === "active"
);

}

function getProductBySlug(slug) {
const requestedSlug = normalise(slug);

if (!requestedSlug) {
  return null;
}

if (
  catalogue &&
  typeof catalogue.getProductBySlug === "function"
) {
  return catalogue.getProductBySlug(requestedSlug);
}

return (
  products.find(function findProduct(product) {
    return (
      normalise(product && (product.slug || product.id)) ===
      requestedSlug
    );
  }) || null
);

}

function getCategory(product) {
if (
catalogue &&
typeof catalogue.getCategoryById === "function"
) {
return catalogue.getCategoryById(product.category);
}

const identifier = normalise(product.category);

return (
  categories.find(function findCategory(category) {
    return (
      normalise(category && category.id) === identifier ||
      normalise(category && category.slug) === identifier
    );
  }) || null
);

}

function formatPrice(product) {
if (
catalogue &&
typeof catalogue.formatPrice === "function"
) {
return catalogue.formatPrice(product);
}

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

function normaliseImage(image, fallbackAlt) {
if (typeof image === "string") {
return hasValue(image)
? {
src: image,
alt: fallbackAlt || "",
}
: null;
}

if (!image || typeof image !== "object") {
  return null;
}

const src = image.src || image.url || image.image || "";

return hasValue(src)
  ? {
      src: src,
      alt:
        image.alt ||
        image.imageAlt ||
        fallbackAlt ||
        "",
    }
  : null;

}

function getProductImages(product) {
const media = product.media || {};
const images = [];

const cardImage = normaliseImage(
  media.cardImage || product.image,
  media.cardImageAlt ||
    product.imageAlt ||
    product.name
);

if (cardImage) {
  images.push(cardImage);
}

toArray(
  media.galleryImages ||
    product.galleryImages ||
    product.images
).forEach(function addImage(image) {
  const normalised = normaliseImage(image, product.name);

  if (
    normalised &&
    !images.some(function isDuplicate(existing) {
      return existing.src === normalised.src;
    })
  ) {
    images.push(normalised);
  }
});

return images;

}

function appendParagraphs(container, content) {
container.replaceChildren();

toArray(content).forEach(function appendParagraph(item) {
  const text =
    typeof item === "object"
      ? item.text ||
        item.content ||
        item.description ||
        ""
      : item;

  if (hasValue(text)) {
    const paragraph = document.createElement("p");
    paragraph.textContent = String(text);
    container.appendChild(paragraph);
  }
});

}

function renderFact(rowSelector, valueSelector, value) {
const row = select(rowSelector);
const element = select(valueSelector);

if (row && element && hasValue(value)) {
  element.textContent = Array.isArray(value)
    ? value.join(", ")
    : String(value);

  show(row);
} else {
  hide(row);
}

}

function getServingText(product) {
return (
product.servingSuggestion ||
product.serving ||
product.servingSize ||
product.servings ||
""
);
}

function renderGallery(product) {
const gallery = select("[data-product-gallery]");
const primary = select("[data-product-primary-image]");
const thumbnails = select("[data-product-thumbnails]");
const images = getProductImages(product);

if (!gallery || !primary || images.length === 0) {
  hide(gallery);
  return;
}

function displayImage(image) {
  primary.src = image.src;
  primary.alt = image.alt || product.name;
}

displayImage(images[0]);

if (thumbnails) {
  thumbnails.replaceChildren();

  if (images.length > 1) {
    images.forEach(function createThumbnail(
      image,
      index
    ) {
      const button = document.createElement("button");
      const thumbnail = document.createElement("img");

      button.type = "button";
      button.className =
        "product-gallery__thumbnail";
      button.setAttribute(
        "aria-label",
        "Show image " + String(index + 1)
      );
      button.setAttribute(
        "aria-pressed",
        String(index === 0)
      );

      thumbnail.src = image.src;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      thumbnail.decoding = "async";

      button.appendChild(thumbnail);

      button.addEventListener(
        "click",
        function selectImage() {
          displayImage(image);

          Array.from(thumbnails.children).forEach(
            function updateState(item) {
              item.setAttribute(
                "aria-pressed",
                String(item === button)
              );
            }
          );
        }
      );

      thumbnails.appendChild(button);
    });

    show(thumbnails);
  } else {
    hide(thumbnails);
  }
}

show(gallery);

}

function renderStory(product) {
const section = select(
"[data-product-story-section]"
);
const container = select("[data-product-story]");

const story =
  product.story ||
  product.longDescription ||
  product.description ||
  "";

if (!section || !container || !hasValue(story)) {
  hide(section);
  return;
}

if (hasValue(product.storyHeading)) {
  setText(
    "[data-product-story-heading]",
    product.storyHeading
  );
}

appendParagraphs(container, story);
show(section);

}

function renderVideo(product) {
const section = select(
"[data-product-video-section]"
);
const element = select("[data-product-video]");
const caption = select(
"[data-product-video-caption]"
);

const media = product.media || {};

const video =
  typeof media.video === "object"
    ? media.video
    : {
        src: media.video || product.video || "",
        poster: media.videoPoster || "",
        caption: media.videoCaption || "",
      };

const source = video.src || video.url || "";

if (!section || !element || !hasValue(source)) {
  hide(section);
  return;
}

element.src = source;

if (hasValue(video.poster)) {
  element.poster = video.poster;
}

if (hasValue(video.heading)) {
  setText(
    "[data-product-video-heading]",
    video.heading
  );
}

if (caption && hasValue(video.caption)) {
  caption.textContent = video.caption;
  show(caption);
} else {
  hide(caption);
}

show(section);

}

function renderIngredients(product) {
const section = select(
"[data-product-ingredients-section]"
);
const declaration = select(
"[data-product-ingredient-declaration]"
);
const grid = select("[data-product-ingredients]");

const ingredients = Array.isArray(product.ingredients)
  ? product.ingredients
  : toArray(product.ingredientDetails);

const declarationText =
  product.ingredientDeclaration ||
  product.ingredientsText ||
  (typeof product.ingredients === "string"
    ? product.ingredients
    : "");

if (
  !section ||
  (!hasValue(declarationText) &&
    ingredients.length === 0)
) {
  hide(section);
  return;
}

if (declaration && hasValue(declarationText)) {
  declaration.textContent = declarationText;
  show(declaration);
} else {
  hide(declaration);
}

if (grid) {
  grid.replaceChildren();

  ingredients.forEach(
    function createIngredientCard(ingredient) {
      const name =
        typeof ingredient === "object"
          ? ingredient.name ||
            ingredient.title ||
            ""
          : String(ingredient);

      if (!hasValue(name)) {
        return;
      }

      const card =
        document.createElement("article");
      const heading =
        document.createElement("h3");

      const description =
        typeof ingredient === "object"
          ? ingredient.description ||
            ingredient.summary ||
            ingredient.story ||
            ""
          : "";

      const image =
        typeof ingredient === "object"
          ? normaliseImage(
              ingredient.image,
              ingredient.imageAlt || name
            )
          : null;

      card.className = "ingredient-card";

      if (image) {
        const imageElement =
          document.createElement("img");

        imageElement.src = image.src;
        imageElement.alt = image.alt;
        imageElement.loading = "lazy";
        imageElement.decoding = "async";

        card.appendChild(imageElement);
      }

      heading.textContent = name;
      card.appendChild(heading);

      if (hasValue(description)) {
        const paragraph =
          document.createElement("p");

        paragraph.textContent = description;
        card.appendChild(paragraph);
      }

      grid.appendChild(card);
    }
  );
}

show(section);

}

function renderPreparation(product) {
const section = select(
"[data-product-preparation-section]"
);
const container = select(
"[data-product-preparation]"
);

const methods = toArray(
  product.preparation ||
    product.preparationMethods
);

if (
  !section ||
  !container ||
  methods.length === 0
) {
  hide(section);
  return;
}

container.replaceChildren();

methods.forEach(function createMethod(method) {
  const article =
    document.createElement("article");
  const heading = document.createElement("h3");

  const title =
    typeof method === "object"
      ? method.title ||
        method.name ||
        "How to prepare"
      : "How to prepare";

  const description =
    typeof method === "string"
      ? method
      : method.description ||
        method.summary ||
        "";

  const steps =
    typeof method === "object"
      ? toArray(
          method.steps || method.instructions
        )
      : [];

  article.className = "preparation-method";
  heading.textContent = title;
  article.appendChild(heading);

  if (hasValue(description)) {
    const paragraph =
      document.createElement("p");

    paragraph.textContent = description;
    article.appendChild(paragraph);
  }

  if (steps.length) {
    const list = document.createElement("ol");

    steps.forEach(function appendStep(step) {
      const text =
        typeof step === "object"
          ? step.text ||
            step.instruction ||
            step.description ||
            ""
          : step;

      if (hasValue(text)) {
        const item =
          document.createElement("li");

        item.textContent = String(text);
        list.appendChild(item);
      }
    });

    if (list.children.length) {
      article.appendChild(list);
    }
  }

  if (
    typeof method === "object" &&
    hasValue(
      method.note ||
        method.servingSuggestion
    )
  ) {
    const note = document.createElement("p");

    note.className =
      "preparation-method__note";

    note.textContent =
      method.note ||
      method.servingSuggestion;

    article.appendChild(note);
  }

  container.appendChild(article);
});

show(section);

}

function normaliseNutritionRows(nutrition) {
if (
!nutrition ||
typeof nutrition !== "object"
) {
return [];
}

if (Array.isArray(nutrition.rows)) {
  return nutrition.rows;
}

if (Array.isArray(nutrition.values)) {
  return nutrition.values;
}

if (
  nutrition.nutrients &&
  typeof nutrition.nutrients === "object"
) {
  return Object.keys(
    nutrition.nutrients
  ).map(function mapNutrient(name) {
    const value = nutrition.nutrients[name];

    return typeof value === "object"
      ? Object.assign({ name: name }, value)
      : {
          name: name,
          perServe: value,
        };
  });
}

return [];

}

function renderNutrition(product) {
const section = select(
"[data-product-nutrition-section]"
);
const container = select(
"[data-product-nutrition-table]"
);
const note = select(
"[data-product-nutrition-note]"
);
const documentLink = select(
"[data-product-nutrition-document]"
);

const nutrition =
  product.nutrition ||
  product.nutritionInformation ||
  null;

if (!section || !container || !nutrition) {
  hide(section);
  return;
}

const rows =
  normaliseNutritionRows(nutrition);

const documentUrl =
  nutrition.document ||
  nutrition.documentUrl ||
  nutrition.pdf ||
  nutrition.source ||
  "";

const nutritionNote =
  nutrition.note ||
  nutrition.preparationBasis ||
  "";

container.replaceChildren();

if (rows.length) {
  const table =
    document.createElement("table");
  const caption =
    document.createElement("caption");
  const thead =
    document.createElement("thead");
  const tbody =
    document.createElement("tbody");
  const headingRow =
    document.createElement("tr");

  const columns = [
    {
      key: "name",
      label: "Average quantity",
    },
    {
      key: "perServe",
      label: "Per serving",
    },
    {
      key: "per100g",
      label: "Per 100g",
    },
  ];

  caption.textContent =
    "Nutrition information for " +
    product.name;

  columns.forEach(
    function createHeading(column) {
      const heading =
        document.createElement("th");

      heading.scope = "col";
      heading.textContent = column.label;
      headingRow.appendChild(heading);
    }
  );

  thead.appendChild(headingRow);

  rows.forEach(function createRow(row) {
    const tableRow =
      document.createElement("tr");

    columns.forEach(
      function createCell(column, index) {
        const cell = document.createElement(
          index === 0 ? "th" : "td"
        );

        const value =
          row && typeof row === "object"
            ? row[column.key] ||
              (column.key === "per100g"
                ? row.per100
                : "")
            : "";

        if (index === 0) {
          cell.scope = "row";
        }

        cell.textContent = hasValue(value)
          ? String(value)
          : "—";

        tableRow.appendChild(cell);
      }
    );

    tbody.appendChild(tableRow);
  });

  table.append(caption, thead, tbody);
  container.appendChild(table);
}

if (note && hasValue(nutritionNote)) {
  note.textContent = nutritionNote;
  show(note);
} else {
  hide(note);
}

if (
  documentLink &&
  hasValue(documentUrl)
) {
  documentLink.href = documentUrl;
  show(documentLink);
} else {
  hide(documentLink);
}

if (
  rows.length ||
  hasValue(nutritionNote) ||
  hasValue(documentUrl)
) {
  show(section);
} else {
  hide(section);
}

}

function renderInformation(product) {
const section = select(
"[data-product-information-section]"
);
const list = select(
"[data-product-information]"
);
const entries = [];

[
  ["Storage", product.storage],
  [
    "Allergen information",
    product.allergens ||
      product.allergenStatement,
  ],
  [
    "Dietary information",
    product.dietary ||
      product.dietaryInformation,
  ],
  [
    "Country of origin",
    product.countryOfOrigin ||
      product.origin,
  ],
  ["Shelf life", product.shelfLife],
  [
    "Advisory information",
    product.advisory ||
      product.advisoryInformation,
  ],
].forEach(function collectEntry(entry) {
  if (hasValue(entry[1])) {
    entries.push(entry);
  }
});

toArray(
  product.information ||
    product.productGuidance
).forEach(function addCustomEntry(entry) {
  if (
    entry &&
    typeof entry === "object"
  ) {
    const label =
      entry.label ||
      entry.title ||
      entry.term;

    const value =
      entry.value ||
      entry.description ||
      entry.text ||
      entry.detail;

    if (
      hasValue(label) &&
      hasValue(value)
    ) {
      entries.push([label, value]);
    }
  }
});

if (
  !section ||
  !list ||
  entries.length === 0
) {
  hide(section);
  return;
}

list.replaceChildren();

entries.forEach(function createEntry(entry) {
  const wrapper =
    document.createElement("div");
  const term = document.createElement("dt");
  const description =
    document.createElement("dd");

  term.textContent = entry[0];

  description.textContent =
    Array.isArray(entry[1])
      ? entry[1].join(", ")
      : String(entry[1]);

  wrapper.append(term, description);
  list.appendChild(wrapper);
});

show(section);

}

function renderFaqs(product) {
const section = select(
"[data-product-faqs-section]"
);
const container = select(
"[data-product-faqs]"
);
const faqs = toArray(product.faqs);

if (
  !section ||
  !container ||
  faqs.length === 0
) {
  hide(section);
  return;
}

container.replaceChildren();

faqs.forEach(function createFaq(faq) {
  if (
    !faq ||
    typeof faq !== "object"
  ) {
    return;
  }

  const question =
    faq.question || faq.title || "";

  const answerContent =
    faq.answer ||
    faq.response ||
    faq.content ||
    "";

  if (
    !hasValue(question) ||
    !hasValue(answerContent)
  ) {
    return;
  }

  const details =
    document.createElement("details");
  const summary =
    document.createElement("summary");
  const answer =
    document.createElement("div");

  details.className = "accordion__item";
  summary.className =
    "accordion__summary";
  answer.className =
    "accordion__content";

  summary.textContent = question;

  appendParagraphs(answer, answerContent);
  details.append(summary, answer);
  container.appendChild(details);
});

if (container.children.length) {
  show(section);
} else {
  hide(section);
}

}

function getRelatedProducts(product) {
const explicit = toArray(
product.relatedProducts ||
product.relatedProductSlugs
);

if (explicit.length) {
  return explicit
    .map(function resolveRelated(item) {
      const slug =
        typeof item === "object"
          ? item.slug || item.id
          : item;

      return getProductBySlug(slug);
    })
    .filter(function keepRelated(item) {
      return (
        isPublicProduct(item) &&
        item.slug !== product.slug
      );
    })
    .slice(0, 4);
}

return products
  .filter(function matchRelated(candidate) {
    return (
      isPublicProduct(candidate) &&
      candidate.slug !== product.slug &&
      candidate.category === product.category
    );
  })
  .slice(0, 4);

}

function renderRelatedProducts(product) {
const section = select(
"[data-related-products-section]"
);
const container = select(
"[data-related-products]"
);
const related = getRelatedProducts(product);

if (
  !section ||
  !container ||
  related.length === 0
) {
  hide(section);
  return;
}

container.replaceChildren();

related.forEach(function createCard(item) {
  const article =
    document.createElement("article");
  const link = document.createElement("a");
  const heading =
    document.createElement("h3");

  const image = getProductImages(item)[0];
  const targetPage =
    container.dataset.productPage ||
    "product-new.html";

  article.className = "product-card";
  link.className = "product-card__link";

  link.href =
    targetPage +
    "?product=" +
    encodeURIComponent(item.slug);

  if (image) {
    const imageElement =
      document.createElement("img");

    imageElement.className =
      "product-card__image";
    imageElement.src = image.src;
    imageElement.alt =
      image.alt || item.name;
    imageElement.loading = "lazy";
    imageElement.decoding = "async";

    link.appendChild(imageElement);
  }

  heading.className =
    "product-card__title";
  heading.textContent = item.name;

  link.appendChild(heading);

  if (hasValue(item.size)) {
    const size =
      document.createElement("p");

    size.className =
      "product-card__size";
    size.textContent = item.size;

    link.appendChild(size);
  }

  const priceText = formatPrice(item);

  if (hasValue(priceText)) {
    const price =
      document.createElement("p");

    price.className =
      "product-card__price";
    price.textContent = priceText;

    link.appendChild(price);
  }

  article.appendChild(link);
  container.appendChild(article);
});

show(section);

}

function updateMetadata(product) {
const description =
product.metaDescription ||
product.shortDescription ||
product.description ||
"Explore " +
product.name +
" from Wise King Enterprise, handcrafted in Geelong, Australia.";

const image = getProductImages(product)[0];
const canonicalUrl = new URL(
  global.location.href
);

canonicalUrl.search = "";
canonicalUrl.searchParams.set(
  "product",
  product.slug
);
canonicalUrl.hash = "";

document.title =
  product.name +
  " | Wise King Enterprise";

const metaDescription = select(
  'meta[name="description"]'
);
const robots = select(
  "[data-product-robots]"
);
const canonical = select(
  "[data-product-canonical]"
);
const ogTitle = select(
  "[data-product-og-title]"
);
const ogDescription = select(
  "[data-product-og-description]"
);
const ogImage = select(
  "[data-product-og-image]"
);

if (metaDescription) {
  metaDescription.content = description;
}

if (robots) {
  robots.content = "index,follow";
}

if (canonical) {
  canonical.href = canonicalUrl.href;
}

if (ogTitle) {
  ogTitle.content =
    product.name +
    " | Wise King Enterprise";
}

if (ogDescription) {
  ogDescription.content = description;
}

if (ogImage && image) {
  ogImage.content = new URL(
    image.src,
    global.location.href
  ).href;
}

}

function renderUnavailable(message) {
const loading = select(
"[data-product-loading]"
);
const view = select(
"[data-product-view]"
);
const unavailable = select(
"[data-product-unavailable]"
);
const messageElement = select(
"[data-product-unavailable-message]"
);

hide(loading);
hide(view);

if (
  messageElement &&
  hasValue(message)
) {
  messageElement.textContent = message;
}

show(unavailable);

}

function renderProduct(product) {
const loading = select(
"[data-product-loading]"
);
const view = select(
"[data-product-view]"
);
const unavailable = select(
"[data-product-unavailable]"
);

const category = getCategory(product);
const price = formatPrice(product);

const tagline =
  product.tagline ||
  product.subtitle ||
  "";

const shortDescription =
  product.shortDescription ||
  product.description ||
  "";

setText(
  "[data-product-name]",
  product.name
);

setText(
  "[data-product-breadcrumb]",
  product.name
);

setText(
  "[data-product-category]",
  category
    ? category.name
    : product.category
);

const taglineElement = select(
  "[data-product-tagline]"
);

const descriptionElement = select(
  "[data-product-short-description]"
);

if (
  taglineElement &&
  hasValue(tagline)
) {
  taglineElement.textContent = tagline;
  show(taglineElement);
} else {
  hide(taglineElement);
}

if (
  descriptionElement &&
  hasValue(shortDescription)
) {
  descriptionElement.textContent =
    shortDescription;

  show(descriptionElement);
} else {
  hide(descriptionElement);
}

renderFact(
  "[data-product-size-row]",
  "[data-product-size]",
  product.size
);

renderFact(
  "[data-product-packaging-row]",
  "[data-product-packaging]",
  product.packaging
);

renderFact(
  "[data-product-serving-row]",
  "[data-product-serving]",
  getServingText(product)
);

renderFact(
  "[data-product-sku-row]",
  "[data-product-sku]",
  product.sku
);

const priceRow = select(
  "[data-product-price-row]"
);

const priceNote = select(
  "[data-product-price-note]"
);

if (priceRow && hasValue(price)) {
  setText(
    "[data-product-price]",
    price
  );

  show(priceRow);
} else {
  hide(priceRow);
}

if (
  priceNote &&
  hasValue(product.priceNote)
) {
  priceNote.textContent =
    product.priceNote;

  show(priceNote);
} else {
  hide(priceNote);
}

setText(
  "[data-product-availability]",
  product.isPurchasable === false
    ? "Available for enquiry"
    : "Available"
);

const enquiryLink = select(
  "[data-product-enquiry-link]"
);

if (enquiryLink) {
  enquiryLink.href =
    "https://wa.me/61470442705?text=" +
    encodeURIComponent(
      "Hi Piyush, I would like to enquire about " +
        product.name +
        "."
    );
}

renderGallery(product);
renderStory(product);
renderVideo(product);
renderIngredients(product);
renderPreparation(product);
renderNutrition(product);
renderInformation(product);
renderFaqs(product);
renderRelatedProducts(product);
updateMetadata(product);

hide(loading);
hide(unavailable);
show(view);

if (view) {
  view.setAttribute(
    "aria-busy",
    "false"
  );
}

}

function start() {
const params = new URLSearchParams(
global.location.search
);

const slug = normalise(
  params.get("product")
);

if (!slug) {
  renderUnavailable(
    "No product was selected. Please return to the shop to explore the current Wise King collection."
  );

  return;
}

const product = getProductBySlug(slug);

if (!isPublicProduct(product)) {
  renderUnavailable(
    "This product may be awaiting final approval or may no longer be publicly available. Please return to the shop to explore the current collection."
  );

  return;
}

try {
  renderProduct(product);
} catch (error) {
  renderUnavailable(
    "We could not display this product at the moment. Please return to the shop or try again shortly."
  );
}

}

if (document.readyState === "loading") {
document.addEventListener(
"DOMContentLoaded",
start,
{
once: true,
}
);
} else {
start();
}
})(globalThis, document);
