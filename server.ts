import express from "express";
import { createServer as createViteServer } from "vite";
import app from "./api/index";
import path from "path";

async function startDevServer() {
  const PORT = 3000;

  // Vite middleware for development
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  
  app.use(vite.middlewares);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dev server running on http://localhost:${PORT}`);
  });
}

startDevServer();
