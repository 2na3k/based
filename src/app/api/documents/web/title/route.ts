import { NextResponse } from "next/server";
import { titleFromLink, titleFromUrl } from "../../../../../lib/documents";

export const runtime = "nodejs";

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return decodeHtmlEntities((match[1] ?? "").replace(/\s+/g, " ").trim());
}

export async function GET(request: Request) {
  const urlValue = new URL(request.url).searchParams.get("url");
  if (!urlValue || !URL.canParse(urlValue)) {
    return new Response("Enter a valid URL", { status: 400 });
  }

  const sourceUrl = new URL(urlValue);
  if (sourceUrl.protocol !== "http:" && sourceUrl.protocol !== "https:") {
    return new Response("Only HTTP and HTTPS links are supported", { status: 400 });
  }

  let title = "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(sourceUrl.toString(), {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "based-title-detector/1.0",
      },
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (response.ok && contentType.includes("text/html")) {
      title = extractTitle(await response.text());
    }
  } catch {
    title = "";
  } finally {
    clearTimeout(timeout);
  }

  return NextResponse.json({
    source: titleFromUrl(sourceUrl.toString()),
    title,
    suggestedTitle: titleFromLink(sourceUrl.toString(), title),
  });
}
