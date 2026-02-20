import express from "express";
import multer from "multer";
import { GoogleGenAI, Type } from "@google/genai";
import * as XLSX from "xlsx";
import cors from "cors";

const app = express();

// Vercel Hobby limit is 4.5MB.
const MAX_FILE_SIZE = 4 * 1024 * 1024; 

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.post("/api/convert", (req, res, next) => {
  upload.single("pdf")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: "El archivo es demasiado grande (máx 4MB)." });
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Falta la clave de API de Gemini en el servidor." });
    }

    const genAI = new GoogleGenAI({ apiKey });
    const base64Pdf = req.file.buffer.toString("base64");
    
    const prompt = `
      Extract all tables from the provided PDF. 
      Return the data as a JSON object with three keys:
      1. "best_effort": Most accurate representation.
      2. "raw_data": Literal extraction.
      3. "structured_view": Optimized for analysis.
      Each key should be an array of tables (array of arrays of strings).
    `;

    const result = await genAI.models.generateContent({
      model: "gemini-3-flash-preview",
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

    const extraction = JSON.parse(result.text || "{}");
    const wb = XLSX.utils.book_new();

    const addSheet = (data: any[][][], sheetName: string) => {
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

  } catch (error: any) {
    console.error("Fatal error:", error);
    res.status(500).json({ error: error.message || "Error interno del servidor" });
  }
});

export default app;
