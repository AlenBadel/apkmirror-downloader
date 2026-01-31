import { load } from "cheerio";

import { apkMirrorFetchText } from "../http";
import { withBaseUrl } from "../utils";

export function getFinalDownloadUrl(downloadPageUrl: string) {
  return apkMirrorFetchText(downloadPageUrl)
    .then(html => extractRedirectDownloadUrl(html))
    .then(withBaseUrl)
    .then(url => apkMirrorFetchText(url))
    .then(html => extractFinalDownloadUrl(html))
    .then(withBaseUrl);
}

export function extractRedirectDownloadUrl(downloadPageHtml: string) {
  const $ = load(downloadPageHtml);
  const downloadUrl = $(`a.downloadButton`).attr("href");
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
