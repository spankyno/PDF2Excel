/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
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
  Github,
  Copy,
  Check,
  Sun,
  Moon,
  LogIn,
  LogOut,
  User,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from './lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';
import Cookies from 'js-cookie';

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); 
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showCookieConsent, setShowCookieConsent] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const email = "blog.cottage627@passinbox.com";

  useEffect(() => {
    // Check cookie consent
    const consent = Cookies.get('cookie_consent');
    if (!consent) {
      setShowCookieConsent(true);
    }

    // Check dark mode preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const checkUsageLimit = () => {
    if (user) return true; // Registered users have no limit

    const uploadsStr = Cookies.get('pdf_uploads');
    const now = Date.now();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    let uploads: number[] = [];
    if (uploadsStr) {
      try {
        uploads = JSON.parse(uploadsStr);
      } catch (e) {
        uploads = [];
      }
    }

    // Filter uploads from the last 30 days
    const recentUploads = uploads.filter(t => now - t < thirtyDaysInMs);

    if (recentUploads.length >= 3) {
      return false;
    }

    return true;
  };

  const recordUpload = () => {
    if (user) return;

    const uploadsStr = Cookies.get('pdf_uploads');
    const now = Date.now();
    let uploads: number[] = [];
    
    if (uploadsStr) {
      try {
        uploads = JSON.parse(uploadsStr);
      } catch (e) {
        uploads = [];
      }
    }

    uploads.push(now);
    // Keep only last 10 to avoid huge cookies, though we only care about 3
    const recentUploads = uploads.slice(-10);
    Cookies.set('pdf_uploads', JSON.stringify(recentUploads), { expires: 30 });
  };

  const acceptCookies = () => {
    Cookies.set('cookie_consent', 'true', { expires: 365 });
    setShowCookieConsent(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        alert('Revisa tu correo para confirmar el registro.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
      setShowAuthModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

    if (!checkUsageLimit()) {
      setError('Has alcanzado el límite de 3 archivos en 30 días para usuarios no registrados. Por favor, regístrate para continuar sin límites.');
      setStatus('error');
      return;
    }

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
      recordUpload();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error inesperado.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#0F172A] text-[#111827] dark:text-gray-100 font-sans flex flex-col transition-colors duration-300">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1E293B] sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-1.5 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">PDF2Excel</span>
          </div>
          
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <a href="https://aitorblog.infinityfreeapp.com" target="_blank" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Blog</a>
              <a href="https://aitorhub.vercel.app/" target="_blank" className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1">
                Más apps <PlusCircle className="w-3 h-3" />
              </a>
              <button 
                onClick={copyToClipboard}
                className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title={email}
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Mail className="w-4 h-4" />}
                {copied && <span className="text-[10px] text-emerald-500">Copiado</span>}
              </button>
            </nav>

            <div className="flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-4">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                aria-label="Toggle dark mode"
              >
                {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block text-right">
                    <p className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[100px]">{user.email}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:text-red-500 dark:hover:text-red-400 transition-all"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Acceder</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-5xl mx-auto px-4 py-12 w-full">
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl sm:text-5xl font-extrabold mb-4 tracking-tight text-gray-900 dark:text-white"
          >
            Convierte tablas PDF a <span className="text-emerald-600 dark:text-emerald-400">Excel</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto"
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
              ${status === 'processing' ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/10' : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1E293B] hover:border-emerald-500 dark:hover:border-emerald-400 hover:bg-emerald-50/10'}
              ${file ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50/10' : ''}
              ${isDragging ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-100 dark:bg-emerald-900/20 ring-4 ring-emerald-100 dark:ring-emerald-900/20 scale-[1.02]' : ''}
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
                ${file ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'}
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
                  <p className="font-semibold text-lg text-gray-900 dark:text-white">{file.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold text-lg text-gray-900 dark:text-white">Arrastra tu PDF aquí</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">o haz clic para seleccionar un archivo</p>
                </div>
              )}

              {!file && (
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 px-6 py-2.5 bg-gray-900 dark:bg-emerald-600 text-white rounded-full font-medium hover:bg-gray-800 dark:hover:bg-emerald-700 transition-colors"
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
                  className="flex items-center gap-3 text-emerald-700 dark:text-emerald-400 font-medium"
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
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="font-medium">¡Conversión completada con éxito!</p>
                  </div>
                  <a
                    href={downloadUrl}
                    download={`${file?.name.replace('.pdf', '') || 'converted'}.xlsx`}
                    className="w-full py-4 bg-gray-900 dark:bg-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-gray-800 dark:hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
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
                    className="w-full text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 font-medium"
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
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex items-center gap-3 text-red-800 dark:text-red-300">
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 shrink-0" />
                    <p className="font-medium">{error}</p>
                  </div>
                  <button 
                    onClick={() => setStatus('idle')}
                    className="w-full py-3 border border-gray-300 dark:border-gray-700 rounded-2xl font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
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
          <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2 dark:text-white">IA Multimodal</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Utilizamos Gemini 1.5 para "ver" las tablas, permitiendo extraer datos incluso de PDFs con formatos complejos o celdas combinadas.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2 dark:text-white">Múltiples Vistas</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Cada Excel incluye varias hojas con diferentes técnicas de extracción: Mejor Resultado, Vista Estructurada y Datos Brutos.
            </p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-lg mb-2 dark:text-white">Procesado Rápido</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
              Sin esperas innecesarias. El motor de IA procesa documentos de varias páginas en segundos, listo para descargar.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-[#1E293B] border-t border-gray-200 dark:border-gray-800 pt-8 pb-8 transition-colors duration-300">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center">
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Aitor Sánchez Gutiérrez © 2026 - Reservados todos los derechos
            </p>
          </div>
        </div>
      </footer>
      {/* Auth Modal */}
      <AnimatePresence>
        {showAuthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1E293B] w-full max-w-md rounded-3xl p-8 shadow-2xl border border-gray-200 dark:border-gray-800"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold dark:text-white">
                  {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
                </h2>
                <button 
                  onClick={() => setShowAuthModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <PlusCircle className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white"
                    placeholder="tu@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                  <input 
                    type="password" 
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : isSignUp ? 'Registrarse' : 'Entrar'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cookie Consent Banner */}
      <AnimatePresence>
        {showCookieConsent && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 p-4"
          >
            <div className="max-w-4xl mx-auto bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>
                  Utilizamos cookies para mejorar tu experiencia y gestionar los límites de uso. 
                  Al continuar navegando, aceptas nuestra política de cookies.
                </p>
              </div>
              <button 
                onClick={acceptCookies}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all whitespace-nowrap"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
