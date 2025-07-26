/**
 * @param {number | string} sizeKB 
 * @returns {"small" | "medium" | "large"}
 */
export function getFileSizeClass(sizeKB) {
  const size = parseFloat(String(sizeKB));
  if (size < 10) {
    return "small";
  } else if (size <= 40) {
    return "medium";
  } else {
    return "large";
  }
}

/**
 * @param {string} fileContent 
 * @returns {string}
 */
export function calculateFileSizeInKB(fileContent) {
  const sizeInBytes = new TextEncoder().encode(fileContent).length;
  const sizeInKB = sizeInBytes / 1024;

  return sizeInKB > 0 ? Math.max(sizeInKB, 0.01).toFixed(2) : "0.00";
}

/**
 * 
 * @param {string} url 
 * @returns {string}
 */
export function getFileName(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split("/").pop() || "index.js";
    return fileName;
  } catch (e) {
    return url.split("/").pop() || "unknown.js";
  }
}

/**
 * 
 * @param {string} url 
 * @param {string} contentType 
 * @returns {boolean}
 */
export function isJavaScriptFile(url, contentType) {
  const jsExtensions = [
    ".js",
    ".mjs",
    ".cjs",
    ".jsx",
    ".ts",
    ".tsx",
    ".vue",
    ".svelte",
  ];

  const urlWithoutQuery = url.split("?")[0].toLowerCase();
  if (jsExtensions.some((ext) => urlWithoutQuery.endsWith(ext))) {
    return true;
  }

  if (
    contentType &&
    (contentType.includes("javascript") ||
      contentType.includes("ecmascript") ||
      contentType.includes("typescript") ||
      contentType.includes("jsx") ||
      contentType.includes("tsx"))
  ) {
    return true;
  }

  if (
    !urlWithoutQuery.includes(".") &&
    contentType &&
    (contentType.includes("javascript") || contentType.includes("module"))
  ) {
    return true;
  }

  return false;
}
