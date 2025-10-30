const placeholderImage = "assets/placeholder.svg";
const appleLookupCache = new Map();
const googleLookupCache = new Map();
const defaultPlatforms = {
  mobile: "Mobile",
  web: "Web",
  game: "Game",
  "open-source": "Open Source",
  stickers: "Stickers",
};

const sectionDescriptions = {
  mobile: "Native and cross-platform applications crafted for iOS and Android.",
  web: "Responsive web projects, platforms, and marketing experiences.",
  game: "Gameplay experiments built with Unity and other engines.",
  "open-source": "Libraries and packages shared with the developer community.",
  stickers: "Sticker packs designed for iMessage and other messaging platforms.",
};

// Proxy endpoints to bypass Play Store CORS restrictions
const playStoreProxyEndpoints = [
  (packageId) => `https://r.jina.ai/https://play.google.com/store/apps/details?id=${packageId}&hl=en&gl=US`,
  (packageId) => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://play.google.com/store/apps/details?id=${packageId}&hl=en&gl=US`)}`,
];

const themeStorageKey = "preferred-theme";
const rootElement = document.documentElement;
let themeToggleButton;
let themeToggleLabel;
let themeToggleIcon;

initializeTheme();
updateCurrentYear();
bootstrapPortfolio();

function initializeTheme() {
  const storedTheme = getStoredTheme();
  const systemPrefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const attributeTheme = rootElement.getAttribute("data-theme");
  const initialTheme = storedTheme || attributeTheme || (systemPrefersDark ? "dark" : "light");

  applyTheme(initialTheme, { persist: Boolean(storedTheme) });
  setupThemeToggle();

  if (!storedTheme) {
    observeSystemTheme();
  }
}

function setupThemeToggle() {
  themeToggleButton = document.getElementById("theme-toggle");
  if (!themeToggleButton) {
    return;
  }

  themeToggleLabel = themeToggleButton.querySelector("[data-theme-label]");
  themeToggleIcon = themeToggleButton.querySelector("[data-theme-icon]");

  syncThemeToggleUI(getCurrentTheme());

  themeToggleButton.addEventListener("click", () => {
    const nextTheme = getCurrentTheme() === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    syncThemeToggleUI(nextTheme);
  });
}

function observeSystemTheme() {
  if (!window.matchMedia) {
    return;
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleChange = (event) => {
    if (getStoredTheme()) {
      return;
    }

    const preferred = event.matches ? "dark" : "light";
    applyTheme(preferred, { persist: false });
    syncThemeToggleUI(preferred);
  };

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handleChange);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handleChange);
  }
}

function applyTheme(theme, { persist = true } = {}) {
  rootElement.setAttribute("data-theme", theme);

  if (persist) {
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch (error) {
      // Ignore storage errors (e.g., privacy mode).
    }
  }
}

function getStoredTheme() {
  try {
    return localStorage.getItem(themeStorageKey);
  } catch (error) {
    return null;
  }
}

function getCurrentTheme() {
  return rootElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function syncThemeToggleUI(theme) {
  if (!themeToggleButton) {
    return;
  }

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const text = isDark ? "Dark mode" : "Light mode";
  const icon = isDark ? "🌙" : "☀️";

  themeToggleButton.setAttribute("aria-pressed", String(isDark));
  themeToggleButton.setAttribute("aria-label", label);
  themeToggleButton.setAttribute("title", label);

  if (themeToggleLabel) {
    themeToggleLabel.textContent = text;
  }

  if (themeToggleIcon) {
    themeToggleIcon.textContent = icon;
  }
}

function updateCurrentYear() {
  const yearTarget = document.getElementById("year");
  if (yearTarget) {
    yearTarget.textContent = new Date().getFullYear();
  }
}

async function bootstrapPortfolio() {
  const main = document.querySelector("main");

  try {
    const response = await fetch("projects.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load projects.json (${response.status})`);
    }

    const data = await response.json();
    renderPortfolioSections(data);
  } catch (error) {
    console.error(error);
    if (main) {
      const notice = document.createElement("p");
      notice.className = "error";
      notice.textContent =
        "Sorry, we couldn't load the project list right now. Please refresh the page.";
      main.prepend(notice);
    }
  }
}

function renderPortfolioSections(portfolioData) {
  const nav = document.querySelector("[data-nav]");
  const sectionsContainer = document.querySelector("[data-sections]");

  if (!nav || !sectionsContainer) {
    return;
  }

  nav.innerHTML = "";
  sectionsContainer.innerHTML = "";

  Object.entries(portfolioData).forEach(([rawKey, items]) => {
    const sectionKey = rawKey.trim();
    const projects = Array.isArray(items) ? items : [];
    const rawSlug = slugify(sectionKey);
    const slug = rawSlug || `section-${nav.childElementCount + 1}`;

    nav.appendChild(createNavLink(sectionKey, slug));

    const sectionEl = buildSectionElement(sectionKey, slug);
    sectionsContainer.appendChild(sectionEl);
    renderSection(sectionEl, sectionKey, projects);
  });
}

function createNavLink(sectionKey, slug) {
  const link = document.createElement("a");
  link.href = `#${slug}`;
  link.textContent = formatSectionTitle(sectionKey);
  return link;
}

function buildSectionElement(sectionKey, slug) {
  const section = document.createElement("section");
  section.className = "portfolio-section";
  section.id = slug;
  section.dataset.section = sectionKey;

  const headingWrapper = document.createElement("div");
  headingWrapper.className = "section-heading";

  const heading = document.createElement("h2");
  heading.textContent = formatSectionTitle(sectionKey);

  const helper = document.createElement("p");
  helper.textContent =
    sectionDescriptions[slug] || `Highlights from the ${formatSectionTitle(sectionKey)} collection.`;

  const cards = document.createElement("div");
  cards.className = "cards";
  cards.setAttribute("data-cards", "");

  headingWrapper.append(heading, helper);
  section.append(headingWrapper, cards);

  return section;
}

function formatSectionTitle(sectionKey) {
  return sectionKey
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function renderSection(sectionEl, sectionKey, projects) {
  const cardsContainer = sectionEl.querySelector("[data-cards]");
  if (!cardsContainer) {
    return;
  }

  cardsContainer.innerHTML = "";

  if (projects.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty";
    emptyState.textContent = "No projects listed yet. Check back soon!";
    cardsContainer.appendChild(emptyState);
    return;
  }

  projects.forEach((project) => {
    const card = createProjectCard(project, sectionKey);
    cardsContainer.appendChild(card);
  });
}

function createProjectCard(project, sectionKey) {
  const card = document.createElement("article");
  card.className = "card";

  const imageWrapper = document.createElement("div");
  imageWrapper.className = "card-image";

  const img = document.createElement("img");
  img.src = placeholderImage;
  img.alt = `${project.title} cover art`;
  img.loading = "lazy";
  imageWrapper.appendChild(img);

  resolveImageSource(project, sectionKey)
    .then((src) => {
      img.src = src;
    })
    .catch((error) => {
      console.warn(`Failed to load image for ${project.title}:`, error);
      img.src = placeholderImage;
    });

  const title = document.createElement("h3");
  title.textContent = project.title;

  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.append(
    createMetaTag("Platform", inferPlatform(project, sectionKey)),
    createMetaTag("Feature", project.feature || "N/A"),
    createMetaTag("Date", project.date || "—")
  );

  const description = document.createElement("p");
  description.className = "card-description";
  description.innerHTML = project.desc || "";

  const actions = document.createElement("div");
  actions.className = "card-actions";

  const link = document.createElement("a");
  link.href = project.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View project";

  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  link.appendChild(arrow);

  actions.appendChild(link);

  card.append(imageWrapper, title, meta, description, actions);

  return card;
}

function createMetaTag(label, value) {
  const span = document.createElement("span");
  span.dataset.label = label;
  span.textContent = `${label}: ${value}`;
  return span;
}

function inferPlatform(project, sectionKey) {
  if (project.platform) {
    return project.platform;
  }
  return (
    defaultPlatforms[sectionKey.toLowerCase()] ||
    formatSectionTitle(sectionKey) ||
    "Unknown"
  );
}

async function resolveImageSource(project, sectionKey) {
  const coverImage = (project.cover_image || "").trim();
  if (coverImage) {
    return coverImage;
  }

  if (sectionKey.toLowerCase() === "mobile" || isMobilePlatform(project)) {
    return resolveMobileImage(project);
  }

  return placeholderImage;
}

async function resolveMobileImage(project) {
  const fallback = (project.cover_image || "").trim() || placeholderImage;
  const platform = (project.platform || "").toLowerCase();
  const storeUrl = project.url || "";

  try {
    if (platform.includes("ios")) {
      return await fetchAppleArtwork(storeUrl);
    }

    if (platform.includes("android")) {
      return await fetchGoogleArtwork(storeUrl);
    }
  } catch (error) {
    console.warn(`Falling back to cover image for ${project.title}:`, error);
  }

  return fallback;
}

async function fetchAppleArtwork(appStoreUrl) {
  const appIdMatch = appStoreUrl.match(/id(\d+)/i);
  if (!appIdMatch) {
    throw new Error("No App Store id found");
  }

  const appId = appIdMatch[1];
  const countryCode = extractAppleCountry(appStoreUrl);
  const cacheKey = `${appId}_${countryCode}`;

  if (appleLookupCache.has(cacheKey)) {
    return appleLookupCache.get(cacheKey);
  }

  const promise = resolveAppleArtwork(appId, countryCode).catch(async (error) => {
    if (countryCode !== "US") {
      try {
        const fallbackKey = `${appId}_US`;
        if (!appleLookupCache.has(fallbackKey)) {
          const fallbackPromise = resolveAppleArtwork(appId, "US");
          appleLookupCache.set(fallbackKey, fallbackPromise);
          return await fallbackPromise;
        }
        return await appleLookupCache.get(fallbackKey);
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    appleLookupCache.delete(cacheKey);
    throw error;
  });

  appleLookupCache.set(cacheKey, promise);
  return promise;
}

async function fetchGoogleArtwork(playStoreUrl) {
  const packageId = extractPlayStoreId(playStoreUrl);
  if (!packageId) {
    throw new Error("No Play Store package id found");
  }

  if (googleLookupCache.has(packageId)) {
    return googleLookupCache.get(packageId);
  }

  const promise = resolveGoogleArtwork(packageId).catch((error) => {
    googleLookupCache.delete(packageId);
    throw error;
  });
  googleLookupCache.set(packageId, promise);
  return promise;
}

function extractPlayStoreId(url) {
  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("id");
    if (id) {
      return id;
    }
  } catch (error) {
    // If URL parsing fails, fall through and try manual extraction
  }

  const match = url.match(/id=([A-Za-z0-9._]+)/);
  return match ? match[1] : "";
}

async function resolveGoogleArtwork(packageId) {
  let lastError = null;

  const requestInit = {
    cache: "force-cache",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  };

  for (const endpoint of playStoreProxyEndpoints) {
    const lookupUrl = typeof endpoint === "function" ? endpoint(packageId) : endpoint;

    try {
      const response = await fetch(lookupUrl, requestInit);

      if (!response.ok) {
        throw new Error(`Proxy request failed (${response.status})`);
      }

      const html = await response.text();
      
      // Try multiple regex patterns to find the image
      const patterns = [
        /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i,
        /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i,
        /<meta\s+name=["']og:image["']\s+content=["']([^"']+)["']/i,
      ];

      let imageUrl = null;
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          imageUrl = match[1].replace(/&amp;/g, "&");
          break;
        }
      }

      if (imageUrl) {
        return imageUrl;
      }

      throw new Error("No og:image tag found in response");
    } catch (error) {
      console.warn(`Failed with endpoint ${lookupUrl}:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error("Unable to retrieve Google Play artwork");
}

function extractAppleCountry(url) {
  const match = url.match(/apps\.apple\.com\/(\w{2})\//i);
  if (match && match[1]) {
    return match[1].toUpperCase();
  }
  return "US";
}

async function resolveAppleArtwork(appId, country) {
  const lookupUrl = `https://itunes.apple.com/lookup?id=${appId}&country=${country}`;
  const response = await fetch(lookupUrl, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`Lookup failed with status ${response.status}`);
  }

  const payload = await response.json();
  const [result] = payload.results || [];
  if (!result) {
    throw new Error("No App Store data returned");
  }

  const artwork =
    result.artworkUrl512 ||
    result.artworkUrl100?.replace(/100x100bb/, "512x512bb") ||
    result.artworkUrl60;

  if (!artwork) {
    throw new Error("No artwork URL available");
  }

  return artwork;
}

function isMobilePlatform(project) {
  const platform = (project.platform || "").toLowerCase();
  return platform.includes("ios") || platform.includes("android");
}
