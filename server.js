require("dotenv").config();

const express = require("express");
const path = require("path");
const { getBubblReply, isHighRiskMessage, getGuardReply } = require("./ai.js");
const { isConfigured: isKeygenConfigured } = require("./minddo-key.js");

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedVoiceStyles = new Set(["friendly", "casual", "empathetic", "upbeat"]);
const allowedChatModes = new Set(["general", "opinion"]);
const allowedCorsOrigins = new Set([
  "https://jumpingjacks247.github.io",
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);
const privateDetailPattern = /(?:\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\d{1,5}\s+[A-Za-z]+\s+(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln)\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b\d{5}(?:-\d{4})?\b|\b(?:my|our)\s+(?:address|phone|email|school name|password)\b|\b(?:i|we)\s+live(?:\s+(?:at|in|on))?\b)/i;

app.use(express.json({ limit: "32kb" }));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (origin && allowedCorsOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
});
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, aiReady: isKeygenConfigured() });
});

app.post("/api/chat", async (request, response) => {
  const message = typeof request.body?.message === "string" ? request.body.message.trim() : "";
  const style = allowedVoiceStyles.has(request.body?.style) ? request.body.style : "friendly";
  const mode = allowedChatModes.has(request.body?.mode) ? request.body.mode : "general";

  if (!message) {
    response.status(400).json({ error: "Please write a message first." });
    return;
  }

  if (message.length > 1200) {
    response.status(400).json({ error: "Let's keep this first chat short and comfortable." });
    return;
  }

  if (privateDetailPattern.test(message)) {
    response.status(400).json({
      error: {
        message: "Please remove that private detail before sending.",
        fix: "Remove addresses, phone numbers, emails, school names, passwords, and other identifying details.",
      },
    });
    return;
  }

  const guardReply = getGuardReply(message);
  if (guardReply) {
    response.json({ guarded: true, reply: guardReply });
    return;
  }

  if (isHighRiskMessage(message)) {
    response.json({
      safety: true,
      reply: "I'm really glad you told me. Please tell a trusted adult right now. If you may be in immediate danger, call 911; in the U.S., call or text 988 for the Suicide & Crisis Lifeline.",
    });
    return;
  }

  try {
    const reply = await getBubblReply(message, style, mode);
    response.json({ reply });
  } catch (error) {
    console.error("DearBubbl AI request failed. Fix:", error?.fix || "Check the MindDo key service.");
    response.status(503).json({
      error: {
        message: error?.message || "Bubbl could not answer right now.",
        fix: error?.fix || "Check the MindDo key service.",
      },
    });
  }
});

app.get("*", (_request, response) => {
  response.sendFile(path.join(__dirname, "public", "index.html"));
});

if (require.main === module) {
  app.listen(port, "127.0.0.1", () => {
    console.log(`DearBubbl is running at http://127.0.0.1:${port}`);
  });
}

module.exports = app;
