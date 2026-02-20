/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  FileUp, 
  FileSpreadsheet, 
  Loader2, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Mail,
  ExternalLink,
  Github
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Por favor, selecciona un archivo PDF válido.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setDownloadUrl(null);
      setStatus('idle');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Por favor, selecciona un archivo PDF válido.');
        return;
      }
      setFile(selectedFile);
      setError(null);
      setDownloadUrl(null);
      setStatus('idle');
    }
  };

  const handleConvert = async () => {
    if (!file) return;

    setStatus('processing');
    setError(null);

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMessage = 'Error en la conversión';
        try {
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          if (text.includes('The page could not be found')) {
            errorMessage = 'El servidor no pudo encontrar la ruta de conversión. Verifica la configuración de Vercel.';
          } else if (response.status === 504) {
            errorMessage = 'Tiempo de espera agotado (Vercel Timeout). El plan gratuito de Vercel limita las funciones a 10s.';
          } else {
            errorMessage = `Error ${response.status}: ${text.substring(0, 100)}`;
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error inesperado.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] font-sans flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">PDF2Excel</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-500">
            <a href="https://aitorblog.infinityfreeapp.com" target="_blank" className="hover:text-emerald-600 transition-colors">Blog</a>
            <a href="mailto:blog.cottage627@passinbox.com" className="hover:text-emerald-600 transition-colors">Contacto</a>
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight text-gray-900"
          >
            Convierte tablas PDF a <span className="text-emerald-600">Excel</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 max-w-2xl mx-auto"
          >
            Extrae datos tabulares de tus documentos PDF con precisión quirúrgica utilizando inteligencia artificial avanzada.
          </motion.p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* Upload Area */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`
              relative border-2 border-dashed rounded-3xl p-12 text-center transition-all duration-300
              ${status === 'processing' ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-300 bg-white hover:border-emerald-500 hover:bg-emerald-50/10'}
              ${file ? 'border-emerald-500 bg-emerald-50/10' : ''}
              ${isDragging ? 'border-emerald-600 bg-emerald-100 ring-4 ring-emerald-100 scale-[1.02]' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              className="hidden"
            />

            <div className="flex flex-col items-center gap-4">
              <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center transition-colors
                ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}
              `}>
                {status === 'processing' ? (
                  <Loader2 className="w-10 h-10 animate-spin" />
                ) : file ? (
                  <FileText className="w-10 h-10" />
                ) : (
                  <FileUp className="w-10 h-10" />
                )}
              </div>

              {file ? (
                <div className="space-y-1">
                  <p className="font-semibold text-lg text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold text-lg text-gray-900">Arrastra tu PDF aquí</p>
                  <p className="text-sm text-gray-500">o haz clic para seleccionar un archivo</p>
                </div>
              )}

              {!file && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-6 py-2.5 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
                >
                  Seleccionar archivo
                </button>
              )}
            </div>
          </motion.div>

          {/* Actions */}
          <div className="mt-8 flex flex-col items-center gap-4">
            <AnimatePresence mode="wait">
              {status === 'idle' && file && (
                <motion.button
                  key="convert-btn"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  onClick={handleConvert}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                >
                  Convertir a Excel
                </motion.button>
              )}

              {status === 'processing' && (
                <motion.div
                  key="processing-status"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 text-emerald-700 font-medium"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analizando tablas con IA...
                </motion.div>
              )}

              {status === 'success' && downloadUrl && (
                <motion.div
                  key="success-status"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full space-y-4"
                >
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-800">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <p className="font-medium">¡Conversión completada con éxito!</p>
                  </div>
                  <a
                    href={downloadUrl}
                    download={`${file?.name.replace('.pdf', '') || 'converted'}.xlsx`}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Descargar Excel
                  </a>
                  <button 
                    onClick={() => {
                      setFile(null);
                      setStatus('idle');
                      setDownloadUrl(null);
                    }}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 font-medium"
                  >
                    Convertir otro archivo
                  </button>
                </motion.div>
              )}

              {status === 'error' && (
                <motion.div
                  key="error-status"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-4"
                >
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3 text-red-800">
                    <AlertCircle className="w-6 h-6 text-red-600 shrink-0" />
                    <p className="font-medium">{error}</p>
                  </div>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="w-full py-3 border border-gray-300 rounded-2xl font-semibold hover:bg-gray-50 transition-all"
                  >
                    Reintentar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2">IA Multimodal</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Utilizamos Gemini 1.5 para "ver" las tablas, permitiendo extraer datos incluso de PDFs con formatos complejos o celdas combinadas.
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2">Múltiples Vistas</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Cada Excel incluye varias hojas con diferentes técnicas de extracción: Mejor Resultado, Vista Estructurada y Datos Brutos.
            </p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2">Procesado Rápido</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Sin esperas innecesarias. El motor de IA procesa documentos de varias páginas en segundos, listo para descargar.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 pt-12 pb-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-emerald-600 p-1 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-lg">PDF2Excel</span>
              </div>
              <p className="text-gray-500 text-sm max-w-xs">
                Herramienta profesional para la extracción de datos de documentos PDF. Desarrollado con las últimas tecnologías de IA.
              </p>
            </div>
            <div className="flex flex-col md:items-end gap-4">
              <div className="flex items-center gap-4">
                <a href="https://aitorblog.infinityfreeapp.com" target="_blank" className="p-2 bg-gray-50 rounded-full text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                  <ExternalLink className="w-5 h-5" />
                </a>
                <a href="mailto:blog.cottage627@passinbox.com" className="p-2 bg-gray-50 rounded-full text-gray-600 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                  <Mail className="w-5 h-5" />
                </a>
              </div>
              <p className="text-sm text-gray-500">
                Contacto: <a href="mailto:blog.cottage627@passinbox.com" className="text-emerald-600 hover:underline">blog.cottage627@passinbox.com</a>
              </p>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-400">
              Aitor Sánchez Gutiérrez © 2026 - Reservados todos los derechos
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
