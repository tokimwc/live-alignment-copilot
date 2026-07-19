import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import { createPlannerAdapter } from "@lac/planner";
import { renderJudgeDemoPage } from "@lac/web";

import { JudgeDemoController, type JudgeDemoState } from "./judge-demo.js";

const DEFAULT_PORT = 4173;
const MAX_REQUEST_BYTES = 32 * 1024;

interface DemoServerStartOptions {
  readonly port?: number;
  readonly host?: string;
}

export function createJudgeDemoHttpServer(controller: JudgeDemoController): Server {
  return createServer((request, response) => {
    void handleRequest(controller, request, response);
  });
}

export async function startJudgeDemoServer(
  options: DemoServerStartOptions = {},
): Promise<{ readonly server: Server; readonly url: string; readonly state: JudgeDemoState }> {
  const runtime = createPlannerAdapter({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_PLANNER_MODEL,
  });
  const controller = new JudgeDemoController({
    planner: runtime.planner,
    plannerMode: runtime.mode,
    model: runtime.model,
  });
  const server = createJudgeDemoHttpServer(controller);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? parsePort(process.env.LAC_DEMO_PORT);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  return {
    server,
    url: `http://${host}:${boundPort}`,
    state: controller.getState(),
  };
}

async function handleRequest(
  controller: JudgeDemoController,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  setSecurityHeaders(response);
  const url = new URL(request.url ?? "/", "http://127.0.0.1");

  try {
    if (request.method === "GET" && url.pathname === "/") {
      sendHtml(response, renderJudgeDemoPage());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/state") {
      sendJson(response, 200, controller.getState());
      return;
    }
    if (request.method === "GET" && url.pathname === "/favicon.ico") {
      response.writeHead(204).end();
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/plan") {
      const body = await readJsonObject(request);
      const transcriptText = body.transcriptText;
      if (typeof transcriptText !== "string") {
        throw new RequestError("transcriptText must be a string");
      }
      sendJson(response, 200, await controller.runPlanner(transcriptText));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/approve") {
      const commandId = await readCommandId(request);
      sendJson(response, 200, controller.approve(commandId));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/reject") {
      const commandId = await readCommandId(request);
      sendJson(response, 200, controller.reject(commandId));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/undo") {
      await readJsonObject(request);
      sendJson(response, 200, controller.undo());
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/reset") {
      await readJsonObject(request);
      sendJson(response, 200, controller.reset());
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch {
    sendJson(response, 400, { error: "Invalid demo request" });
  }
}

async function readCommandId(request: IncomingMessage): Promise<string> {
  const body = await readJsonObject(request);
  if (typeof body.commandId !== "string" || body.commandId.length > 80) {
    throw new RequestError("commandId must be a bounded string");
  }
  return body.commandId;
}

async function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      throw new RequestError("Request body is too large");
    }
    chunks.push(buffer);
  }

  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new RequestError("Request body must be JSON");
  }
  if (!isRecord(value)) {
    throw new RequestError("Request body must be an object");
  }
  return value;
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
  );
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
}

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value)}\n`);
}

function parsePort(input: string | undefined): number {
  if (!input) {
    return DEFAULT_PORT;
  }
  const value = Number.parseInt(input, 10);
  return Number.isInteger(value) && value >= 1024 && value <= 65_535 ? value : DEFAULT_PORT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class RequestError extends Error {
  override readonly name = "RequestError";
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  startJudgeDemoServer()
    .then(({ state, url }) => {
      console.log(`Live Alignment Copilot demo: ${url}`);
      console.log(`Planner: ${state.planner.label} (${state.planner.model})`);
      console.log("Press Ctrl+C to stop.");
    })
    .catch(() => {
      console.error("Unable to start the local demo server.");
      process.exitCode = 1;
    });
}
