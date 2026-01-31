// FlareSolverr-based HTTP client for bypassing Cloudflare protection
// FlareSolverr must be running at http://localhost:8191

const FLARESOLVERR_URL = process.env.FLARESOLVERR_URL || "http://localhost:8191/v1";
const MAX_TIMEOUT = 60000;

interface FlareSolverrResponse {
  status: string;
  message: string;
  solution: {
    url: string;
    status: number;
    headers: Record<string, string>;
    response: string;
    cookies: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
    }>;
    userAgent: string;
  };
  startTimestamp: number;
  endTimestamp: number;
  version: string;
}

// Session for reusing cookies
let sessionId: string | null = null;
let storedCookies: FlareSolverrResponse["solution"]["cookies"] = [];
let storedUserAgent: string = "";

async function createSession(): Promise<string> {
  const response = await fetch(FLARESOLVERR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cmd: "sessions.create",
    }),
  });

  const data = await response.json() as { session: string };
  return data.session;
}

async function getPageContent(url: string): Promise<string> {
  // Create session if we don't have one
  if (!sessionId) {
    try {
      sessionId = await createSession();
    } catch {
      // If session creation fails, continue without it
      console.log("Could not create FlareSolverr session, continuing without it");
    }
  }

  const payload: any = {
    cmd: "request.get",
    url: url,
    maxTimeout: MAX_TIMEOUT,
  };

  if (sessionId) {
    payload.session = sessionId;
  }

  const response = await fetch(FLARESOLVERR_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FlareSolverr request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as FlareSolverrResponse;

  if (data.status !== "ok") {
    throw new Error(`FlareSolverr failed: ${data.message}`);
  }

  // Store cookies and user agent for later use
  storedCookies = data.solution.cookies;
  storedUserAgent = data.solution.userAgent;

  return data.solution.response;
}

export async function apkMirrorFetch(url: string): Promise<Response> {
  const content = await getPageContent(url);
  return new Response(content, {
    headers: { "Content-Type": "text/html" },
  });
}

export async function apkMirrorFetchText(url: string): Promise<string> {
  return getPageContent(url);
}

// For downloading the actual APK file, we use the stored cookies
export async function downloadFile(
  url: string,
  dest: string
): Promise<{ finalUrl: string; size: number }> {
  // Convert cookies to cookie string
  const cookieString = storedCookies
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // Fetch the file directly using the cookies we have
  const response = await fetch(url, {
    headers: {
      Cookie: cookieString,
      "User-Agent": storedUserAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.apkmirror.com/",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  // Get the response as ArrayBuffer and write to file
  const arrayBuffer = await response.arrayBuffer();
  
  // Cross-runtime file writing (works with both Bun and Node.js)
  const { writeFile } = await import("fs/promises");
  await writeFile(dest, Buffer.from(arrayBuffer));

  return { finalUrl: response.url, size: arrayBuffer.byteLength };
}

// Cleanup function - destroy session
export async function closeBrowser(): Promise<void> {
  if (sessionId) {
    try {
      await fetch(FLARESOLVERR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cmd: "sessions.destroy",
          session: sessionId,
        }),
      });
    } catch {
      // Ignore cleanup errors
    }
    sessionId = null;
  }
  storedCookies = [];
  storedUserAgent = "";
}

// Ensure cleanup on exit
process.on("exit", () => {
  // Can't do async cleanup in sync exit handler
});

process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});

