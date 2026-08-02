/**
 * Wise King Enterprise — reusable product page renderer
 *
 * Requires:
 * - data/products.js
 * - js/catalogue.js
 * - product-new.html
 *
 * This file contains no checkout or cart logic.
 */
(function initialiseProductPage(global, document) {
  "use strict";

  const catalogueData = global.WISE_KING_CATALOGUE || {};
  const catalogueApi = global.WiseKingCatalogue || {};
  const products = Array.isArray(catalogueData.products)
    ? catalogueData.products
    : [];
  const categories = Array.isArray(catalogueData.categories)
    ? catalogueData.categories
    : [];

  const loading = document.querySelector("[data-product-loading]");
  const productView = document.querySelector("[data-product-view]");
  const unavailable = document.querySelector("[data-product-unavailable]");
  const unavailableMessage = document.querySelector(
    "[data-product-unavailable-message]"
  );

  function select(selector, context) {
    return (context || document).querySelector(selector);
  }

  function selectAll(selector, context) {
    return Array.from(
      (context || document).querySelectorAll(selector)
    );
  }

  function hasValue(value) {
    return (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== catalogueData.needsConfirmation &&
      value !== "Needs Confirmation"
    );
  }

  function toArray(value) {
    if (Array.isArray(value)) {
      return value.filter(Boolean);
    }

    return hasValue(value) ? [value] : [];
  }

  function setText(selector, value, context) {
    const element = select(selector, context);

    if (!element) {
      return;
    }

    element.textContent = hasValue(value) ? String(value) : "";
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

  function isPublicProduct(product) {
    return Boolean(
      product &&
      product.isPublic === true &&
      String(product.status || "").toLowerCase() === "active"
    );
  }

  function getRequestedSlug() {
    const params = new URLSearchParams(global.location.search);
    return (params.get("product") || "").trim().toLowerCase();
  }

  function getProductBySlug(slug) {
    if (!slug) {
      return null;
    }

    if (typeof catalogueApi.getProductBySlug === "function") {
      const apiProduct = catalogueApi.getProductBySlug(slug);

      if (apiProduct) {
        return apiProduct;
      }
    }

    return (
      products.find(function findProduct(product) {
        return (
          product &&
          String(product.slug || "").trim().toLowerCase() === slug
        );
      }) || null
    );
  }

  function getCategory(product) {
    if (!product) {
      return null;
    }

    if (typeof catalogueApi.getCategoryById === "function") {
      const apiCategory = catalogueApi.getCategoryById(product.category);

      if (apiCategory) {
        return apiCategory;
      }
    }

    return (
      categories.find(function findCategory(category) {
        return (
          category &&
          (category.id === product.category ||
            category.slug === product.category)
        );
      }) || null
    );
  }

  function formatPrice(product) {
    if (!product || !Number.isFinite(Number(product.price))) {
      return "";
    }

    try {
      return new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: product.currency || "AUD",
      }).format(Number(product.price));
    } catch (error) {
      return "$" + Number(product.price).toFixed(2);
    }
  }

  function normaliseImage(image, fallbackAlt) {
    if (typeof image === "string") {
      return {
        src: image,
        alt: fallbackAlt || "",
      };
    }

    if (!image || typeof image !== "object") {
      return null;
    }

    return {
      src: image.src || image.url || image.image || "",
      alt: image.alt || image.altText || fallbackAlt || "",
    };
  }

  function getProductImages(product) {
    const media = product.media || {};
    const images = [];
    const primary = normaliseImage(
      media.primaryImage || media.cardImage || product.image,
      media.cardImageAlt || product.imageAlt || product.name
    );

    if (primary && hasValue(primary.src)) {
      images.push(primary);
    }

    toArray(media.galleryImages || product.images).forEach(function addImage(
      image
    ) {
      const normalised = normaliseImage(image, product.name);

      if (
        normalised &&
        hasValue(normalised.src) &&
        !images.some(function isDuplicate(existing) {
          return existing.src === normalised.src;
        })
      ) {
        images.push(normalised);
      }
    });

    return images;
  }

  function renderUnavailable(message) {
    hide(loading);
    hide(productView);
    show(unavailable);

    if (unavailableMessage && hasValue(message)) {
      unavailableMessage.textContent = message;
    }

    document.title = "Product unavailable | Wise King Enterprise";

    const robots = select("[data-product-robots]");

    if (robots) {
      robots.setAttribute("content", "noindex,follow");
    }

    const canonical = select("[data-product-canonical]");

    if (canonical) {
      canonical.setAttribute(
        "href",
        new URL("product-new.html", global.location.href).href
      );
    }
  }

  function renderGallery(product) {
    const images = getProductImages(product);
    const primaryImage = select("[data-product-primary-image]");
    const thumbnails = select("[data-product-thumbnails]");
    const gallery = select("[data-product-gallery]");

    if (!primaryImage || !gallery) {
      return;
    }

    if (!images.length) {
      hide(gallery);
      return;
    }

    function displayImage(image) {
      primaryImage.src = image.src;
      primaryImage.alt = image.alt || product.name;
    }

    displayImage(images[0]);
    show(gallery);

    if (!thumbnails || images.length < 2) {
      hide(thumbnails);
      return;
    }

    thumbnails.replaceChildren();

    images.forEach(function createThumbnail(image, index) {
      const button = document.createElement("button");
      const thumbnail = document.createElement("img");

      button.type = "button";
      button.className = "product-gallery__thumbnail";
      button.setAttribute(
        "aria-label",
        "View image " + String(index + 1) + " of " + product.name
      );
      button.setAttribute("aria-pressed", index === 0 ? "true" : "false");

      thumbnail.src = image.src;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      thumbnail.decoding = "async";

      button.appendChild(thumbnail);
      button.addEventListener("click", function changePrimaryImage() {
        displayImage(image);

        selectAll("button", thumbnails).forEach(function updateButton(item) {
          item.setAttribute(
            "aria-pressed",
            item === button ? "true" : "false"
          );
        });
      });

      thumbnails.appendChild(button);
    });

    show(thumbnails);
  }

  function renderFact(rowSelector, valueSelector, value) {
    const row = select(rowSelector);

    if (!row || !hasValue(value)) {
      hide(row);
      return;
    }

    setText(valueSelector, value);
    show(row);
  }

  function getServingText(product) {
    if (hasValue(product.servingSuggestion)) {
      return product.servingSuggestion;
    }

    const serving = product.serving || product.servingInfo;

    if (typeof serving === "string") {
      return serving;
    }

    if (!serving || typeof serving !== "object") {
      return "";
    }

    return (
      serving.suggestion ||
      serving.description ||
      serving.size ||
      serving.powderPerServe ||
      ""
    );
  }

  function appendParagraphs(container, content) {
    if (!container) {
      return;
    }

    container.replaceChildren();

    toArray(content).forEach(function appendContent(item) {
      const paragraph = document.createElement("p");

      if (typeof item === "object") {
        paragraph.textContent =
          item.text || item.description || item.content || "";
      } else {
        paragraph.textContent = String(item);
      }

      if (paragraph.textContent) {
        container.appendChild(paragraph);
      }
    });
  }

  function renderStory(product) {
    const section = select("[data-product-story-section]");
    const container = select("[data-product-story]");
    const story =
      product.story ||
      product.longDescription ||
      product.description ||
      product.overview;

    if (!section || !container || !toArray(story).length) {
      hide(section);
      return;
    }

    if (hasValue(product.storyHeading)) {
      setText("[data-product-story-heading]", product.storyHeading);
    }

    appendParagraphs(container, story);
    show(section);
  }

  function renderVideo(product) {
    const section = select("[data-product-video-section]");
    const videoElement = select("[data-product-video]");
    const captionElement = select("[data-product-video-caption]");
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

    if (!section || !videoElement || !hasValue(source)) {
      hide(section);
      return;
    }

    videoElement.src = source;

    if (hasValue(video.poster)) {
      videoElement.poster = video.poster;
    }

    if (hasValue(video.heading)) {
      setText("[data-product-video-heading]", video.heading);
    }

    if (captionElement && hasValue(video.caption)) {
      captionElement.textContent = video.caption;
      show(captionElement);
    } else {
      hide(captionElement);
    }

    show(section);
  }

  function renderIngredients(product) {
    const section = select("[data-product-ingredients-section]");
    const declaration = select("[data-product-ingredient-declaration]");
    const grid = select("[data-product-ingredients]");
    const ingredients = toArray(
      product.ingredients || product.ingredientDetails
    );
    const declarationText =
      product.ingredientDeclaration ||
      product.ingredientsText ||
      (typeof product.ingredients === "string" ? product.ingredients : "");

    if (
      !section ||
      (!hasValue(declarationText) && ingredients.length === 0)
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

      ingredients.forEach(function createIngredientCard(ingredient) {
        const card = document.createElement("article");
        const name = document.createElement("h3");
        const description = document.createElement("p");
        const ingredientName =
          typeof ingredient === "string"
            ? ingredient
            : ingredient.name || ingredient.title || "";
        const ingredientDescription =
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
                ingredient.imageAlt || ingredientName
              )
            : null;

        card.className = "ingredient-card";

        if (image && hasValue(image.src)) {
          const imageElement = document.createElement("img");

          imageElement.src = image.src;
          imageElement.alt = image.alt;
          imageElement.loading = "lazy";
          imageElement.decoding = "async";
          card.appendChild(imageElement);
        }

        name.textContent = ingredientName;
        card.appendChild(name);

        if (hasValue(ingredientDescription)) {
          description.textContent = ingredientDescription;
          card.appendChild(description);
        }

        grid.appendChild(card);
      });
    }

    show(section);
  }

  function renderPreparation(product) {
    const section = select("[data-product-preparation-section]");
    const container = select("[data-product-preparation]");
    const methods = toArray(
      product.preparation || product.preparationMethods
    );

    if (!section || !container || methods.length === 0) {
      hide(section);
      return;
    }

    container.replaceChildren();

    methods.forEach(function createMethod(method, methodIndex) {
      const article = document.createElement("article");
      const heading = document.createElement("h3");
      const steps =
        typeof method === "object"
          ? toArray(method.steps || method.instructions)
          : [];
      const title =
        typeof method === "object"
          ? method.title || method.name || "Preparation"
          : "Preparation";
      const description =
        typeof method === "string"
          ? method
          : method.description || method.summary || "";

      article.className = "preparation-method";
      heading.textContent =
        methods.length > 1 ? title : title || "How to prepare";
      article.appendChild(heading);

      if (hasValue(description)) {
        const paragraph = document.createElement("p");

        paragraph.textContent = description;
        article.appendChild(paragraph);
      }

      if (steps.length) {
        const list = document.createElement("ol");

        steps.forEach(function appendStep(step) {
          const item = document.createElement("li");

          item.textContent =
            typeof step === "object"
              ? step.text || step.instruction || step.description || ""
              : String(step);

          if (item.textContent) {
            list.appendChild(item);
          }
        });

        if (list.children.length) {
          article.appendChild(list);
        }
      }

      if (
        typeof method === "object" &&
        hasValue(method.note || method.servingSuggestion)
      ) {
        const note = document.createElement("p");

        note.className = "preparation-method__note";
        note.textContent = method.note || method.servingSuggestion;
        article.appendChild(note);
      }

      article.dataset.methodIndex = String(methodIndex);
      container.appendChild(article);
    });

    show(section);
  }

  function normaliseNutritionRows(nutrition) {
    if (!nutrition || typeof nutrition !== "object") {
      return [];
    }

    if (Array.isArray(nutrition.rows)) {
      return nutrition.rows;
    }

    if (Array.isArray(nutrition.values)) {
      return nutrition.values;
    }

    if (nutrition.nutrients && typeof nutrition.nutrients === "object") {
      return Object.keys(nutrition.nutrients).map(function mapNutrient(key) {
        const value = nutrition.nutrients[key];

        if (typeof value === "object") {
          return Object.assign({ name: key }, value);
        }

        return {
          name: key,
          perServe: value,
        };
      });
    }

    return [];
  }

  function renderNutrition(product) {
    const section = select("[data-product-nutrition-section]");
    const container = select("[data-product-nutrition-table]");
    const note = select("[data-product-nutrition-note]");
    const documentLink = select("[data-product-nutrition-document]");
    const nutrition =
      product.nutrition || product.nutritionInformation || null;
    const rows = normaliseNutritionRows(nutrition);
    const documentUrl =
      nutrition &&
      (nutrition.document ||
        nutrition.documentUrl ||
        nutrition.pdf ||
        nutrition.source);
    const nutritionNote =
      nutrition && (nutrition.note || nutrition.preparationBasis);

    if (
      !section ||
      !container ||
      (!nutrition && !hasValue(documentUrl))
    ) {
      hide(section);
      return;
    }

    container.replaceChildren();

    if (rows.length) {
      const table = document.createElement("table");
      const caption = document.createElement("caption");
      const thead = document.createElement("thead");
      const tbody = document.createElement("tbody");
      const headingRow = document.createElement("tr");
      const columns = [
        { key: "name", label: "Average quantity" },
        { key: "perServe", label: "Per serving" },
        { key: "per100g", label: "Per 100g" },
      ];

      caption.textContent = "Nutrition information for " + product.name;

      columns.forEach(function createHeading(column) {
        const heading = document.createElement("th");

        heading.scope = "col";
        heading.textContent = column.label;
        headingRow.appendChild(heading);
      });

      thead.appendChild(headingRow);

      rows.forEach(function createNutritionRow(row) {
        const tableRow = document.createElement("tr");

        columns.forEach(function createCell(column, index) {
          const cell = document.createElement(index === 0 ? "th" : "td");
          const value =
            typeof row === "object"
              ? row[column.key] ||
                (column.key === "per100g" ? row.per100 : "")
              : "";

          if (index === 0) {
            cell.scope = "row";
          }

          cell.textContent = hasValue(value) ? String(value) : "—";
          tableRow.appendChild(cell);
        });

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

    if (documentLink && hasValue(documentUrl)) {
      documentLink.href = documentUrl;
      show(documentLink);
    } else {
      hide(documentLink);
    }

    show(section);
  }

  function renderInformation(product) {
    const section = select("[data-product-information-section]");
    const list = select("[data-product-information]");
    const entries = [];

    [
      ["Storage", product.storage],
      ["Allergen information", product.allergens || product.allergenStatement],
      ["Dietary information", product.dietary || product.dietaryInformation],
      ["Country of origin", product.countryOfOrigin || product.origin],
      ["Shelf life", product.shelfLife],
      ["Advisory information", product.advisory || product.advisoryInformation],
    ].forEach(function collectEntry(entry) {
      if (hasValue(entry[1])) {
        entries.push(entry);
      }
    });

    toArray(product.information || product.productGuidance).forEach(
      function addCustomEntry(entry) {
        if (entry && typeof entry === "object") {
          const label = entry.label || entry.title || entry.term;
          const value =
            entry.value || entry.description || entry.text || entry.detail;

          if (hasValue(label) && hasValue(value)) {
            entries.push([label, value]);
          }
        }
      }
    );

    if (!section || !list || entries.length === 0) {
      hide(section);
      return;
    }

    list.replaceChildren();

    entries.forEach(function createInformationEntry(entry) {
      const wrapper = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");

      term.textContent = entry[0];
      description.textContent = Array.isArray(entry[1])
        ? entry[1].join(", ")
        : String(entry[1]);

      wrapper.append(term, description);
      list.appendChild(wrapper);
    });

    show(section);
  }

  function renderFaqs(product) {
    const section = select("[data-product-faqs-section]");
    const container = select("[data-product-faqs]");
    const faqs = toArray(product.faqs);

    if (!section || !container || faqs.length === 0) {
      hide(section);
      return;
    }

    container.replaceChildren();

    faqs.forEach(function createFaq(faq, index) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      const answer = document.createElement("div");
      const question =
        typeof faq === "object"
          ? faq.question || faq.title || ""
          : "";
      const answerContent =
        typeof faq === "object"
          ? faq.answer || faq.response || faq.content || ""
          : "";

      if (!hasValue(question) || !hasValue(answerContent)) {
        return;
      }

      details.className = "accordion__item";
      details.dataset.faqIndex = String(index);
      summary.className = "accordion__summary";
      answer.className = "accordion__content";
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
    const explicitSlugs = toArray(
      product.relatedProducts || product.relatedProductSlugs
    );

    if (explicitSlugs.length) {
      return explicitSlugs
        .map(function resolveSlug(item) {
          const slug =
            typeof item === "object" ? item.slug || item.id : item;

          return getProductBySlug(String(slug || "").toLowerCase());
        })
        .filter(function keepPublic(related) {
          return (
            isPublicProduct(related) &&
            related.slug !== product.slug
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
    const section = select("[data-related-products-section]");
    const container = select("[data-related-products]");
    const relatedProducts = getRelatedProducts(product);

    if (!section || !container || relatedProducts.length === 0) {
      hide(section);
      return;
    }

    container.replaceChildren();

    relatedProducts.forEach(function createProductCard(related) {
      const article = document.createElement("article");
      const link = document.createElement("a");
      const heading = document.createElement("h3");
      const price = document.createElement("p");
      const image = getProductImages(related)[0];
      const targetPage =
        container.dataset.productPage || "product-new.html";

      article.className = "product-card";
      link.className = "product-card__link";
      link.href =
        targetPage + "?product=" + encodeURIComponent(related.slug);

      if (image) {
        const imageElement = document.createElement("img");

        imageElement.className = "product-card__image";
        imageElement.src = image.src;
        imageElement.alt = image.alt || related.name;
        imageElement.loading = "lazy";
        imageElement.decoding = "async";
        link.appendChild(imageElement);
      }

      heading.className = "product-card__title";
      heading.textContent = related.name;
      link.appendChild(heading);

      if (hasValue(related.size)) {
        const size = document.createElement("p");

        size.className = "product-card__size";
        size.textContent = related.size;
        link.appendChild(size);
      }

      if (hasValue(formatPrice(related))) {
        price.className = "product-card__price";
        price.textContent = formatPrice(related);
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
    const canonicalUrl = new URL(global.location.href);

    canonicalUrl.search = "";
    canonicalUrl.searchParams.set("product", product.slug);
    canonicalUrl.hash = "";

    document.title = product.name + " | Wise King Enterprise";

    const metaDescription = select('meta[name="description"]');
    const robots = select("[data-product-robots]");
    const canonical = select("[data-product-canonical]");
    const ogTitle = select("[data-product-og-title]");
    const ogDescription = select("[data-product-og-description]");
    const ogImage = select("[data-product-og-image]");

    if (metaDescription) {
      metaDescription.setAttribute("content", description);
    }

    if (robots) {
      robots.setAttribute("content", "index,follow");
    }

    if (canonical) {
      canonical.setAttribute("href", canonicalUrl.href);
    }

    if (ogTitle) {
      ogTitle.setAttribute(
        "content",
        product.name + " | Wise King Enterprise"
      );
    }

    if (ogDescription) {
      ogDescription.setAttribute("content", description);
    }

    if (ogImage && image) {
      ogImage.setAttribute(
        "content",
        new URL(image.src, global.location.href).href
      );
    }
  }

  function renderProduct(product) {
    const category = getCategory(product);
    const price = formatPrice(product);
    const tagline = product.tagline || product.subtitle;
    const shortDescription =
      product.shortDescription || product.description;
    const priceNote = product.priceNote;
    const enquiryLink = select("[data-product-enquiry-link]");

    setText("[data-product-name]", product.name);
    setText("[data-product-breadcrumb]", product.name);
    setText(
      "[data-product-category]",
      category ? category.name : product.category
    );

    const taglineElement = select("[data-product-tagline]");

    if (taglineElement && hasValue(tagline)) {
      taglineElement.textContent = tagline;
      show(taglineElement);
    } else {
      hide(taglineElement);
    }

    const descriptionElement = select(
      "[data-product-short-description]"
    );

    if (descriptionElement && hasValue(shortDescription)) {
      descriptionElement.textContent = shortDescription;
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

    const priceRow = select("[data-product-price-row]");

    if (priceRow && hasValue(price)) {
      setText("[data-product-price]", price);
      show(priceRow);
    } else {
      hide(priceRow);
    }

    const priceNoteElement = select("[data-product-price-note]");

    if (priceNoteElement && hasValue(priceNote)) {
      priceNoteElement.textContent = priceNote;
      show(priceNoteElement);
    } else {
      hide(priceNoteElement);
    }

    setText(
      "[data-product-availability]",
      product.isPurchasable === false
        ? "Available for enquiry"
        : "Available"
    );

    if (enquiryLink) {
      const message =
        "Hi Piyush, I would like to enquire about " +
        product.name +
        ".";
      enquiryLink.href =
        "https://wa.me/61470442705?text=" +
        encodeURIComponent(message);
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
    show(productView);
    productView.setAttribute("aria-busy", "false");
  }

  function start() {
    const slug = getRequestedSlug();

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

  start();
})(globalThis, document);
