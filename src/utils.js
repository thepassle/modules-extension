export function getFileSizeClass(sizeKB) {
  const size = parseFloat(sizeKB);

  if (size < 10) {
    return "file-size small";
  } else if (size <= 40) {
    return "file-size medium";
  } else {
    return "file-size large";
  }
}

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
