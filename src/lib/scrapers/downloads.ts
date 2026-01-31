import { load } from "cheerio";

import { apkMirrorFetchText } from "../http";
import type { AppType } from "../types";
import { withBaseUrl } from "../utils";

export function getFinalDownloadUrl(
  downloadPageUrl: string,
  type: AppType = "apk",
) {
  return apkMirrorFetchText(downloadPageUrl)
    .then(html => extractRedirectDownloadUrl(html, type))
    .then(withBaseUrl)
    .then(url => apkMirrorFetchText(url))
    .then(html => extractFinalDownloadUrl(html))
    .then(withBaseUrl);
}

export function extractRedirectDownloadUrl(
  downloadPageHtml: string,
  type: AppType = "apk",
) {
  const $ = load(downloadPageHtml);

  // Find all download buttons
  const downloadButtons = $("a.downloadButton");

  if (downloadButtons.length === 0) {
    throw new Error("Could not find any download buttons");
  }

  // If there's only one button, use it
  if (downloadButtons.length === 1) {
    const downloadUrl = downloadButtons.attr("href");
    if (!downloadUrl) {
      throw new Error("Could not find redirect download url");
    }
    return downloadUrl;
  }

  // Multiple buttons available - select based on type
  let downloadUrl: string | undefined;

  downloadButtons.each((_, el) => {
    const href = $(el).attr("href") || "";
    const text = $(el).text().toLowerCase();

    if (type === "apk") {
      // For APK, look for the button with forcebaseapk=true or "Download APK" without "Bundle"
      if (
        href.includes("forcebaseapk=true") ||
        (text.includes("apk") && !text.includes("bundle"))
      ) {
        downloadUrl = href;
        return false; // break
      }
    } else if (type === "bundle") {
      // For Bundle, look for the button without forcebaseapk or with "Bundle" in text
      if (
        text.includes("bundle") ||
        (!href.includes("forcebaseapk=true") && text.includes("apk"))
      ) {
        downloadUrl = href;
        return false; // break
      }
    }
  });

  // Fallback to first button if no match found
  if (!downloadUrl) {
    downloadUrl = downloadButtons.first().attr("href");
  }

  if (!downloadUrl) {
    throw new Error("Could not find redirect download url");
  }

  return downloadUrl;
}

export function extractFinalDownloadUrl(downloadPageHtml: string) {
  const $ = load(downloadPageHtml);
  const downloadUrl = $(`.card-with-tabs a[href]`).attr("href");
  if (!downloadUrl) {
    throw new Error("Could not find final download url");
  }
  return downloadUrl;
}
