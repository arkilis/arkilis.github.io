const placeholderImage = "assets/placeholder.svg";
const appleLookupCache = new Map();
const googleLookupCache = new Map();
const defaultPlatforms = {
  mobile: "Mobile",
  web: "Web",
  game: "Game",
  "open-source": "Open Source",
};

updateCurrentYear();
bootstrapPortfolio();

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
    const sections = document.querySelectorAll(".portfolio-section");

    sections.forEach((section) => {
      const key = section.dataset.section;
      const projects = Array.isArray(data[key]) ? data[key] : [];
      renderSection(section, key, projects);
    });
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
    .catch(() => {
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
  return defaultPlatforms[sectionKey] || "Unknown";
}

async function resolveImageSource(project, sectionKey) {
  if (sectionKey === "mobile") {
    return resolveMobileImage(project);
  }

  const coverImage = (project.cover_image || "").trim();
  if (coverImage) {
    return coverImage;
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
  if (appleLookupCache.has(appId)) {
    return appleLookupCache.get(appId);
  }

  const lookupUrl = `https://itunes.apple.com/lookup?id=${appId}`;
  const promise = fetch(lookupUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Lookup failed with status ${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
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
    });

  appleLookupCache.set(appId, promise);
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

  const lookupUrl = `https://play.google.com/store/apps/details?id=${packageId}&hl=en&gl=US`;
  const promise = fetch(lookupUrl)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Play Store request failed (${response.status})`);
      }
      return response.text();
    })
    .then((html) => {
      const match = html.match(/<meta\s+property="og:image"\s+content="(.*?)"/i);
      if (!match || !match[1]) {
        throw new Error("No og:image tag found");
      }
      return match[1];
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
