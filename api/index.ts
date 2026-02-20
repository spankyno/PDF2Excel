import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Vercel Hobby limit is 4.5MB. We set a safe limit here.
const MAX_FILE_SIZE = 4 * 1024 * 1024; 

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

app.use(cors());
// Vercel body limits
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

app.post("/api/convert", (req, res, next) => {
  console.log(`[${new Date().toISOString()}] Request received`);
  next();
}, (req, res, next) => {
  upload.single("pdf")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: "El archivo es demasiado grande. El límite es 4MB para el plan gratuito de Vercel." });
      }
      return res.status(400).json({ error: `Error de carga: ${err.message}` });
    } else if (err) {
      return res.status(500).json({ error: `Error interno: ${err.message}` });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se ha recibido ningún archivo PDF." });
    }

    console.log(`Processing: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Check if API KEY is present
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing");
      return res.status(500).json({ error: "Configuración incompleta: Falta la clave de API de Gemini." });
    }

    const base64Pdf = req.file.buffer.toString("base64");
    const modelName = "gemini-3-flash-preview";
    
    const prompt = `
      Extract all tables from the provided PDF. 
      Return the data as a JSON object with three keys:
      1. "best_effort": Most accurate representation.
      2. "raw_data": Literal extraction.
      3. "structured_view": Optimized for analysis.

      Each key should be an array of tables (array of arrays of strings).
      If no tables found, return empty arrays.
    `;

    console.log("Calling Gemini...");
    
    // Set a timeout for the Gemini call to avoid Vercel killing the function blindly
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s timeout for Gemini

    try {
      const result = await genAI.models.generateContent({
        model: modelName,
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Pdf
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              best_effort: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } },
              raw_data: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } },
              structured_view: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.STRING } } } }
            },
            required: ["best_effort", "raw_data", "structured_view"]
          }
        }
      });

      clearTimeout(timeoutId);
      console.log("Gemini success");

      const extraction = JSON.parse(result.text || "{}");
      const wb = XLSX.utils.book_new();

      const addSheet = (data: string[][][], sheetName: string) => {
        if (!data || data.length === 0) return;
        const combinedRows: any[] = [];
        data.forEach((table, index) => {
          if (index > 0) combinedRows.push([]);
          table.forEach(row => combinedRows.push(row));
        });
        const ws = XLSX.utils.aoa_to_sheet(combinedRows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      };

      addSheet(extraction.best_effort, "Mejor Resultado");
      addSheet(extraction.structured_view, "Vista Estructurada");
      addSheet(extraction.raw_data, "Datos Brutos");

      const excelBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="converted_${Date.now()}.xlsx"`);
      res.send(excelBuffer);
      console.log("Response sent");

    } catch (geminiErr: any) {
      clearTimeout(timeoutId);
      if (geminiErr.name === 'AbortError') {
        return res.status(504).json({ error: "La IA tardó demasiado en responder. Prueba con un PDF más pequeño." });
      }
      throw geminiErr;
    }

  } catch (error: any) {
    console.error("Fatal error:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
