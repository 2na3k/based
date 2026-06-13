import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { NextResponse } from "next/server";
import { prisma, rowToDocument } from "../../../_lib/storage";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface ReaderResponse {
  byline: string | null;
  content: string;
  excerpt: string | null;
  length: number;
  siteName: string | null;
  title: string;
  url: string;
}

function textResponse(message: string, status: number) {
  return new Response(message, { status });
}

function absoluteUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function absoluteSrcset(value: string, baseUrl: string) {
  return value
    .split(",")
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      const [url, ...descriptors] = parts;
      if (!url) return "";
      return [absoluteUrl(url, baseUrl), ...descriptors].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function normalizeReaderContent(content: string, baseUrl: string) {
  const { document } = parseHTML(`<main>${content}</main>`);
  const root = document.querySelector("main");
  if (!root) return content;

  root.querySelectorAll("a[href]").forEach((element) => {
    const href = element.getAttribute("href");
    if (href) element.setAttribute("href", absoluteUrl(href, baseUrl));
    element.setAttribute("target", "_blank");
    element.setAttribute("rel", "noreferrer");
  });

  root.querySelectorAll("img[src], video[src], audio[src], source[src]").forEach((element) => {
    const src = element.getAttribute("src");
    if (src) element.setAttribute("src", absoluteUrl(src, baseUrl));
  });

  root.querySelectorAll("img[srcset], source[srcset]").forEach((element) => {
    const srcset = element.getAttribute("srcset");
    if (srcset) element.setAttribute("srcset", absoluteSrcset(srcset, baseUrl));
  });

  root.querySelectorAll("video[poster]").forEach((element) => {
    const poster = element.getAttribute("poster");
    if (poster) element.setAttribute("poster", absoluteUrl(poster, baseUrl));
  });

  root.querySelectorAll("img").forEach((element) => {
    element.setAttribute("loading", "lazy");
    element.setAttribute("decoding", "async");
  });

  return root.innerHTML;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return textResponse("Invalid document id", 400);
  }

  const client = await prisma();
  const row = await client.document.findUnique({ where: { id: documentId } });
  if (!row) {
    return textResponse("Document not found", 404);
  }

  const document = rowToDocument(row);
  if (document.type !== "web") {
    return textResponse("Reader mode is only available for web sources", 415);
  }

  let response: Response;
  try {
    response = await fetch(document.source, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "BasedReader/1.0",
      },
      redirect: "follow",
    });
  } catch {
    return textResponse("Could not fetch this web source.", 502);
  }

  if (!response.ok) {
    return textResponse(`Could not fetch this web source (${response.status}).`, 502);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
    return textResponse("Reader mode is only available for HTML pages.", 415);
  }

  const html = await response.text();
  const readerUrl = response.url || document.source;
  const { document: parsedDocument } = parseHTML(html);
  const base = parsedDocument.createElement("base");
  base.href = readerUrl;
  parsedDocument.head.prepend(base);
  const article = new Readability(parsedDocument).parse();
  if (!article?.content || !article.textContent?.trim()) {
    return textResponse("Could not extract a readable article from this page.", 422);
  }

  const payload: ReaderResponse = {
    byline: article.byline ?? null,
    content: normalizeReaderContent(article.content, readerUrl),
    excerpt: article.excerpt ?? null,
    length: article.length ?? article.textContent.length,
    siteName: article.siteName ?? null,
    title: article.title || document.title,
    url: readerUrl,
  };

  return NextResponse.json(payload);
}
