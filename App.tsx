
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { 
  QrCode as QrCodeIcon, 
  RotateCcw, 
  Printer, 
  Palette, 
  X,
  Maximize2,
  ClipboardList,
  Code2,
  Database,
  Search,
  Trash2,
  UploadCloud,
  AlertCircle,
  ImagePlus,
  Scan,
  Plus,
  CheckSquare,
  Square,
  FileText,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  AlertTriangle,
  Image as ImageIcon,
  Download,
  Filter,
  Layers,
  Save,
  Loader2,
  FileDown
} from 'lucide-react';
import { 
  InventoryData,
  TemplateConfig,
  ProductRecord
} from './types';

// --- CONSTANTES ---
const STORAGE_KEY = 'qr_studio_db_v3';
const CV_DIRECTO_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 150" width="500" height="150"><text x="50%" y="60%" font-family="Arial, sans-serif" font-weight="900" font-size="80" text-anchor="middle" fill="black">CVDIRECTO</text><rect x="50" y="100" width="400" height="10" fill="red"/></svg>`;

// --- COMPONENTES AUXILIARES ---

const QRRenderer: React.FC<{ value: string; size: number }> = ({ value, size }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'H'
      }, (error) => {
        if (error) console.error("QR generation failed", error);
      });
    }
  }, [value, size]);

  return <canvas ref={canvasRef} className="max-w-full h-auto rounded-sm shadow-sm" />;
};

const PrintableLabel: React.FC<{ product: ProductRecord; template: TemplateConfig }> = ({ product, template }) => {
  const qrValue = `SKU:${product.sku || 'N/A'}${template.qrSeparator}DESC:${product.description || ''}`;
  
  return (
    <div className="bg-white text-black flex flex-col border-[4px] border-black h-full w-full overflow-hidden font-sans box-border select-none">
      <div style={{ backgroundColor: template.headerBg, color: template.headerTextColor }} className="p-4 flex items-center gap-3 border-b-4 border-black shrink-0">
        {(template.logoUrl || CV_DIRECTO_LOGO_SVG) && <img src={template.logoUrl || CV_DIRECTO_LOGO_SVG} className="h-10 w-auto max-w-[80px] object-contain" alt="Logo" />}
        <div className="flex flex-col flex-1 min-w-0">
          <h2 className="text-xl font-black leading-tight uppercase truncate">{template.headerText}</h2>
          <p className="text-[8px] font-bold tracking-[0.2em] opacity-80 uppercase">Etiqueta Control Inventario</p>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-4 flex-1 overflow-hidden">
        <div className="border-b-2 border-black pb-4 shrink-0">
          <p className="text-[10px] font-bold text-gray-500 uppercase">IDENTIFICADOR SKU</p>
          <p className="text-3xl font-black leading-none break-words uppercase tracking-tighter">{product.sku}</p>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center py-2 min-h-0">
          <QRRenderer value={qrValue} size={template.qrSize} />
        </div>

        <div className="border-t-2 border-black pt-4 shrink-0">
          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">DESCRIPCIÓN</p>
          <p className="text-sm font-bold uppercase leading-tight line-clamp-4">
            {product.description || 'SIN DESCRIPCIÓN DISPONIBLE'}
          </p>
        </div>
      </div>
    </div>
  );
};

// --- APP PRINCIPAL ---

const App: React.FC = () => {
  // Estados de UI
  const [activeTab, setActiveTab] = useState<'content' | 'database' | 'design' | 'format'>('content');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [exportProgress, setExportProgress] = useState<{current: number, total: number} | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados de Datos
  const [products, setProducts] = useState<ProductRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<InventoryData>({ sku: '', description: '' });
  
  // Estados de Escáner
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerInterval = useRef<number | null>(null);
  const virtualLabelRef = useRef<HTMLDivElement>(null);

  // Plantilla
  const [template, setTemplate] = useState<TemplateConfig>({
    headerText: 'CVDIRECTO',
    headerBg: '#000000',
    headerTextColor: '#ffffff',
    accentColor: '#3b82f6',
    barcodeWidth: 160, 
    barcodeHeight: 160,
    qrSize: 180,
    showDate: true,
    borderWidth: 3,
    borderStyle: 'solid',
    fontFamily: 'font-sans',
    logoUrl: undefined,
    qrFormat: 'PIPE',
    barcodeMode: 'STRUCTURED', 
    qrSeparator: '|'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // --- EFECTOS ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
  }, [products]);

  // --- CÁLCULOS ---
  const filteredProducts = useMemo(() => 
    products.filter(p => 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.description.toLowerCase().includes(searchTerm.toLowerCase())
    ), 
    [products, searchTerm]
  );

  const selectedProducts = useMemo(() => 
    products.filter(p => selectedIds.has(p.id)), 
    [products, selectedIds]
  );

  // Lógica para determinar qué productos se imprimen con "Imprimir Rápido"
  const allProductsForPrinting = useMemo(() => {
    if (selectedIds.size > 0) return selectedProducts;
    if (inventory.sku) return [{ ...inventory, id: 'temp-quick-print' } as ProductRecord];
    return [];
  }, [selectedIds, selectedProducts, inventory]);

  const totalPages = Math.ceil(allProductsForPrinting.length / 4);
  const qrValue = useMemo(() => `SKU:${inventory.sku || 'N/A'}${template.qrSeparator}DESC:${inventory.description || ''}`, [inventory, template.qrSeparator]);

  // --- ACCIONES ---
  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
    }
  }, [selectedIds.size, filteredProducts]);

  const handleDeleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleClearDatabase = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const confirmClearDatabase = () => {
    setProducts([]);
    setSelectedIds(new Set());
    setShowClearConfirm(false);
  };

  const downloadCsvTemplate = useCallback(() => {
    const csvContent = "SKU,DESCRIPTION\nABC-1234,PRODUCTO DE EJEMPLO 1\nDEF-5678,PRODUCTO DE EJEMPLO 2";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'plantilla_inventario_qr.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleAddProduct = () => {
    if (!inventory.sku) return;
    const newProduct: ProductRecord = {
      ...inventory,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      sku: inventory.sku.toUpperCase()
    };
    setProducts(prev => [newProduct, ...prev]);
    setInventory({ sku: '', description: '' });
  };

  const handleQuickJpeg = async () => {
    if (!virtualLabelRef.current) {
        if (!inventory.sku) {
            alert("No hay datos en el formulario para generar imagen.");
            return;
        }
    }
    setExportProgress({ current: 1, total: 1 });
    try {
      const target = virtualLabelRef.current;
      if (!target) return;

      const dataUrl = await toJpeg(target, {
        quality: 0.95,
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `MARBETE_${(inventory.sku || 'UNNAMED').replace(/\s+/g, '_')}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Export error', error);
      alert('Error al generar JPG');
    } finally {
      setExportProgress(null);
    }
  };

  // Escáner
  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          scannerInterval.current = window.setInterval(async () => {
            if (videoRef.current) {
              try {
                const codes = await detector.detect(videoRef.current);
                if (codes.length > 0) {
                  const scannedData = codes[0].rawValue;
                  setInventory(prev => ({ ...prev, sku: scannedData.toUpperCase() }));
                  stopScanner();
                }
              } catch (e) { }
            }
          }, 300);
        }
      }
    } catch (err) {
      console.error(err);
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerInterval.current) clearInterval(scannerInterval.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsScanning(false);
  };

  // Exportación
  const handleExportJpeg = async () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;

    setExportProgress({ current: 0, total: totalPages });
    const originalDisplay = printArea.style.display;
    printArea.style.display = 'block';

    try {
      const pages = printArea.querySelectorAll('.print-page');
      for (let i = 0; i < pages.length; i++) {
        setExportProgress({ current: i + 1, total: totalPages });
        const dataUrl = await toJpeg(pages[i] as HTMLElement, { 
          quality: 0.95,
          pixelRatio: 2.5,
          backgroundColor: '#ffffff'
        });
        const link = document.createElement('a');
        link.download = `ETIQUETAS_${template.headerText.replace(/\s+/g, '_')}_PAG_${i + 1}.jpg`;
        link.href = dataUrl;
        link.click();
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (error) {
      console.error('Export failed', error);
      alert('Error en la generación. Reduzca el número de etiquetas e intente de nuevo.');
    } finally {
      printArea.style.display = originalDisplay;
      setExportProgress(null);
      setShowPreview(false);
    }
  };

  return (
    <div className={`min-h-screen text-zinc-100 flex flex-col ${template.fontFamily}`}>
      
      {/* CAPA DE IMPRESIÓN (HIDDEN BY DEFAULT) */}
      <div id="print-area" className="hidden">
        {Array.from({ length: totalPages }).map((_, pageIdx) => (
          <div key={pageIdx} className="print-page grid grid-cols-2">
            {allProductsForPrinting.slice(pageIdx * 4, pageIdx * 4 + 4).map((prod) => (
              <div key={prod.id} className="print-label-container">
                <PrintableLabel product={prod} template={template} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* OVERLAY ESCÁNER */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl">
          <div className="relative w-full max-w-lg aspect-video md:aspect-square bg-zinc-900 overflow-hidden rounded-[2.5rem] border-4 border-blue-500/50 shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-70" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 h-4/5 border-2 border-dashed border-white/20 rounded-3xl relative">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-blue-500 animate-[scan_2s_infinite]"></div>
              </div>
            </div>
            <div className="absolute bottom-6 inset-x-0 flex flex-col items-center">
              <p className="bg-black/60 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white/80 backdrop-blur-sm mb-4">Alinea el código QR</p>
            </div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 active:scale-95 transition-all">Cerrar Escáner</button>
        </div>
      )}

      {/* MODAL DE PROCESAMIENTO */}
      {exportProgress && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md">
          <div className="w-full max-w-xs space-y-6 text-center">
            <div className="relative flex justify-center">
              <Loader2 className="text-blue-500 animate-spin" size={48} />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">{Math.round((exportProgress.current / exportProgress.total) * 100)}%</span>
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tighter">Procesando</h3>
              <p className="text-xs text-zinc-500 font-medium uppercase mt-1">Generando archivo...</p>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300" 
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN VACIAR CATÁLOGO */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-red-500/20 p-10 rounded-[2.5rem] max-w-md w-full shadow-[0_0_100px_rgba(239,68,68,0.1)] text-center space-y-10 animate-in zoom-in-95 duration-200">
            <div className="w-24 h-24 bg-red-600/10 rounded-full flex items-center justify-center mx-auto ring-4 ring-red-500/5">
              <AlertTriangle className="text-red-500" size={48} />
            </div>
            <div>
              <h4 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">¿Vaciar Catálogo?</h4>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider leading-relaxed px-4">
                Esta acción eliminará <span className="text-red-500 font-black">{products.length}</span> registros de forma permanente de tu almacenamiento local.
              </p>
            </div>
            <div className="grid gap-4">
              <button 
                onClick={confirmClearDatabase} 
                className="bg-red-600 hover:bg-red-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:scale-[1.02] active:scale-95"
              >
                Sí, Vaciar Todo
              </button>
              <button 
                onClick={() => setShowClearConfirm(false)} 
                className="bg-zinc-800 text-zinc-400 py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISTA PREVIA */}
      {showPreview && (
        <div className="fixed inset-0 z-[150] bg-zinc-950/95 flex flex-col items-center justify-center p-4 md:p-8 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-full max-w-6xl h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6 px-4 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600/10 rounded-xl"><Printer className="text-blue-500" size={24} /></div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Vista Previa de Producción</h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">4 Etiquetas por Hoja Carta (215.9 x 279.4 mm)</p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)} className="bg-white/5 p-3 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-all"><X size={20} /></button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-auto p-4 custom-scrollbar">
              <div className="relative">
                  {/* Contenedor que simula la hoja real */}
                  <div className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.5)] w-[380px] h-[492px] md:w-[600px] md:h-[776px] grid grid-cols-2 p-4 origin-center">
                    {allProductsForPrinting.slice(previewPage * 4, previewPage * 4 + 4).map((prod) => (
                      <div key={prod.id} className="p-1 box-border">
                        <PrintableLabel product={prod} template={template} />
                      </div>
                    ))}
                  </div>
                  
                  {totalPages > 1 && (
                    <>
                      <button disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)}
                        className="absolute -left-16 top-1/2 -translate-y-1/2 bg-white/5 p-4 rounded-full text-white hover:bg-white/10 disabled:opacity-20 transition-all">
                        <ChevronLeft size={32} />
                      </button>
                      <button disabled={previewPage === totalPages - 1} onClick={() => setPreviewPage(p => p + 1)}
                        className="absolute -right-16 top-1/2 -translate-y-1/2 bg-white/5 p-4 rounded-full text-white hover:bg-white/10 disabled:opacity-20 transition-all">
                        <ChevronRight size={32} />
                      </button>
                    </>
                  )}
              </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-5 shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-[1px] w-12 bg-zinc-800"></div>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Página {previewPage + 1} de {totalPages}</p>
                <div className="h-[1px] w-12 bg-zinc-800"></div>
              </div>
              <div className="flex gap-4">
                <button onClick={handleExportJpeg} className="bg-blue-600 hover:bg-blue-500 text-white px-12 py-5 rounded-2xl font-black text-xs uppercase flex items-center gap-3 transition-all shadow-xl hover:translate-y-[-2px]">
                  Descargar JPG <Download size={18} />
                </button>
                <button onClick={() => setShowPreview(false)} className="bg-zinc-800 text-zinc-400 px-8 py-5 rounded-2xl font-black text-xs uppercase hover:bg-zinc-700 transition-all">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <div id="main-ui" className="flex-1 flex flex-col items-center p-4 md:p-10 lg:p-16 max-w-[1600px] mx-auto w-full gap-8">
        
        {/* HEADER */}
        <header className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.3)] rotate-3">
              <QrCodeIcon className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter">CV <span className="text-blue-600">DIRECTO</span></h1>
              <div className="flex flex-col gap-0.5 mt-1">
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-[0.4em]">GENERADOR DE MARBETES</p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">SISTEMA DE CONTROL INDUSTRIAL</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* DASHBOARD PRINCIPAL */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* PANEL IZQUIERDO: CONFIGURACIÓN */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-[2rem] overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col min-h-[600px]">
              {/* TABS NAVEGACIÓN */}
              <nav className="flex bg-black/40 border-b border-zinc-800/60 p-2 gap-1">
                {[
                  { id: 'content', label: 'Captura', icon: ClipboardList },
                  { id: 'database', label: 'Catálogo', icon: Database },
                  { id: 'design', label: 'Identidad', icon: Palette },
                  { id: 'format', label: 'Lógica', icon: Code2 },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-6 py-4 text-[11px] font-black uppercase rounded-2xl transition-all grow md:grow-0 ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <tab.icon size={16} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="p-8 md:p-10 flex-1">
                {/* TAB 1: CAPTURA */}
                {activeTab === 'content' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Identificador / SKU de Producción
                        </label>
                        <div className="flex gap-3">
                          <input type="text" value={inventory.sku} onChange={e => setInventory({...inventory, sku: e.target.value.toUpperCase()})}
                            className="flex-1 bg-zinc-950 border border-zinc-800/60 p-5 rounded-2xl font-mono text-base focus:ring-2 focus:ring-blue-500/40 outline-none transition-all placeholder:text-zinc-800" placeholder="EJ: ABC-1234-MOD" />
                          <button onClick={startScanner} className="bg-zinc-800 hover:bg-zinc-700 text-white p-5 rounded-2xl transition-all shadow-lg active:scale-95 group" title="Escanear Código">
                            <Scan size={24} className="group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div> Descripción Técnica del Activo
                        </label>
                        <textarea rows={5} value={inventory.description} onChange={e => setInventory({...inventory, description: e.target.value})}
                          className="w-full bg-zinc-950 border border-zinc-800/60 p-5 rounded-2xl text-sm outline-none resize-none focus:ring-2 focus:ring-blue-500/40 transition-all placeholder:text-zinc-800" placeholder="Detalla especificaciones, materiales o destino..." />
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <button 
                        onClick={handleAddProduct}
                        disabled={!inventory.sku}
                        className={`flex-1 py-6 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 transition-all shadow-xl ${!inventory.sku ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:translate-y-[-2px]'}`}
                      >
                        <Plus size={20} /> Registrar en Catálogo
                      </button>
                      <button 
                        onClick={() => { setInventory({sku:'', description:''}); setSelectedIds(new Set()); }}
                        className="p-6 bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl transition-all active:scale-95"
                        title="Limpiar Formulario"
                      >
                        <RotateCcw size={20} />
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 2: CATÁLOGO */}
                {activeTab === 'database' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 flex flex-col gap-6 h-full">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                        <input type="text" placeholder="BUSCAR POR SKU O DESCRIPCIÓN..." className="w-full bg-zinc-950 border border-zinc-800/60 py-4 pl-12 pr-4 rounded-2xl text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={downloadCsvTemplate} className="px-5 py-4 bg-zinc-950 border border-zinc-800/60 rounded-2xl text-emerald-500 hover:bg-emerald-500/10 transition-all flex items-center gap-2 text-[10px] font-black uppercase" title="Descargar Plantilla">
                          <FileSpreadsheet size={16} /> Plantilla
                        </button>
                        <button onClick={() => csvInputRef.current?.click()} className="px-5 py-4 bg-zinc-950 border border-zinc-800/60 rounded-2xl text-zinc-400 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase">
                          <UploadCloud size={16} /> Importar
                        </button>
                        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const text = event.target?.result as string;
                            const rows = text.split('\n');
                            const newProducts: ProductRecord[] = [];
                            for (let i = 1; i < rows.length; i++) {
                              const row = rows[i].trim();
                              if (!row) continue;
                              const cols = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
                              if (cols.length >= 2) {
                                newProducts.push({ 
                                  id: (Date.now() + i + Math.random()).toString(), 
                                  sku: cols[0].toUpperCase(), 
                                  description: cols[1] 
                                });
                              }
                            }
                            if (newProducts.length > 0) setProducts(prev => [...newProducts, ...prev]);
                          };
                          reader.readAsText(file);
                        }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-4">
                        <button onClick={handleSelectAll} className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500 hover:text-blue-500 transition-all">
                          {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                          {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                        </button>
                        <span className="text-[10px] font-black text-zinc-700">|</span>
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{selectedIds.size} Marcados</span>
                      </div>
                      {products.length > 0 && (
                        <button onClick={handleClearDatabase} className="text-[10px] font-black uppercase text-red-500/50 hover:text-red-500 flex items-center gap-2 transition-all">
                          <Trash2 size={14} /> Vaciar Catálogo
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-4 min-h-0">
                      {filteredProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-zinc-950/20 rounded-[2rem] border border-dashed border-zinc-800">
                          <Database size={48} className="text-zinc-800 mb-4" />
                          <p className="text-zinc-600 font-black uppercase text-xs">Sin registros disponibles</p>
                          <p className="text-zinc-800 font-bold text-[10px] mt-2 uppercase">Comienza capturando un nuevo SKU</p>
                        </div>
                      ) : (
                        filteredProducts.map(prod => {
                          const isSelected = selectedIds.has(prod.id);
                          return (
                            <div key={prod.id} className={`group border-2 rounded-2xl p-4 flex items-center gap-5 transition-all cursor-pointer ${isSelected ? 'bg-blue-600/5 border-blue-600/40' : 'bg-zinc-950/40 border-zinc-800/40 hover:border-zinc-700'}`} onClick={() => handleToggleSelection(prod.id)}>
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-700'}`}>
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </div>
                              <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); setInventory(prod); setActiveTab('content'); }}>
                                <p className={`text-xs font-black uppercase tracking-tight truncate ${isSelected ? 'text-blue-400' : 'text-white'}`}>{prod.sku}</p>
                                <p className="text-[10px] font-bold text-zinc-600 truncate uppercase mt-0.5">{prod.description || 'SIN DESCRIPCIÓN'}</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteProduct(prod.id); }} className="p-2 text-zinc-800 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: DISEÑO */}
                {activeTab === 'design' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Texto de Identidad (Header)</label>
                        <input type="text" value={template.headerText} onChange={e => setTemplate({...template, headerText: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800/60 p-5 rounded-2xl text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Esquema Cromático</label>
                        <div className="flex items-center gap-4">
                          <input type="color" value={template.headerBg} onChange={e => setTemplate({...template, headerBg: e.target.value})} className="w-16 h-16 bg-transparent rounded-2xl overflow-hidden cursor-pointer border-4 border-zinc-800" />
                          <div className="flex-1">
                            <p className="text-xs font-black uppercase text-white tracking-tighter">{template.headerBg}</p>
                            <p className="text-[9px] font-bold uppercase text-zinc-600">Color de fondo del cabezal</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ajuste de Óptica (Escala QR)</label>
                        <span className="text-[11px] font-mono font-black text-blue-500 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20">{template.qrSize}px</span>
                      </div>
                      <input type="range" min="100" max="250" step="10" value={template.qrSize} onChange={e => setTemplate({...template, qrSize: parseInt(e.target.value)})} className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-blue-600" />
                      <div className="flex justify-between text-[8px] font-black text-zinc-700 uppercase">
                        <span>Compacto</span>
                        <span>Lector Distante</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Activo Visual (Logotipo)</label>
                      <button onClick={() => fileInputRef.current?.click()} className="w-full h-24 bg-zinc-950 border-2 border-dashed border-zinc-800 hover:border-blue-500/50 hover:bg-blue-600/5 rounded-[2rem] flex flex-col items-center justify-center gap-2 text-xs font-black text-zinc-600 hover:text-blue-500 transition-all">
                        <ImagePlus size={24} /> 
                        <span className="uppercase tracking-widest text-[9px]">Actualizar marca gráfica</span>
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setTemplate(prev => ({ ...prev, logoUrl: reader.result as string }));
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </div>
                  </div>
                )}

                {/* TAB 4: FORMATO */}
                {activeTab === 'format' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-10">
                    <div className="bg-blue-600/10 border border-blue-500/30 p-8 rounded-[2rem] space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600/20 rounded-xl"><AlertCircle className="text-blue-500" size={24} /></div>
                        <h4 className="text-sm font-black uppercase text-white tracking-tighter">Esquema de Codificación</h4>
                      </div>
                      <p className="text-[11px] text-blue-100/60 leading-relaxed font-bold uppercase">
                        Define el carácter que dividirá el SKU de la Descripción dentro de la cadena de datos del código QR. Útil para integraciones con ERP/WMS.
                      </p>
                      <div className="pt-4 flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase text-zinc-500">Ejemplo:</span>
                        <code className="bg-black/40 px-3 py-2 rounded-lg text-blue-400 font-mono text-xs">SKU:123<span className="text-white font-bold">{template.qrSeparator}</span>DESC:ITEM</code>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      {['|', '_', '-', '/', '#', ':'].map(sep => (
                        <button key={sep} onClick={() => setTemplate({ ...template, qrSeparator: sep })}
                          className={`p-6 rounded-[1.5rem] border-2 text-2xl font-black transition-all ${template.qrSeparator === sep ? 'bg-blue-600 border-blue-400 text-white shadow-0_10px_30px_rgba(59,130,246,0.3)' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:border-zinc-700'}`}>{sep}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* STATUS BAR INFERIOR */}
              <div className="bg-black/60 px-8 py-4 border-t border-zinc-800/60 flex items-center justify-between">
                <div className="flex items-center gap-6">
                   <div className="flex items-center gap-2">
                     <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_100px_rgba(59,130,246,0.5)]"></div>
                     <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest">CV DIRECTO OS</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <Save size={10} className="text-zinc-700" />
                     <span className="text-[9px] font-black uppercase text-zinc-700 tracking-widest">Auto-guardado activo</span>
                   </div>
                </div>
                <p className="text-[9px] font-mono text-zinc-800 uppercase tracking-widest">v4.0.0-CV-STABLE</p>
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: VISTA PREVIA EN VIVO */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-10 flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6 px-4">
                <div className="flex items-center gap-3">
                   <div className="relative">
                     <div className="absolute inset-0 bg-blue-500 blur-md opacity-30 animate-pulse"></div>
                     <div className="relative w-2 h-2 bg-blue-500 rounded-full"></div>
                   </div>
                   <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Monitor de Previsualización</span>
                </div>
                <div className="flex gap-2">
                   <button onClick={handleQuickJpeg} className="text-zinc-600 hover:text-emerald-500 p-2 hover:bg-emerald-500/5 rounded-lg transition-all" title="Descargar JPG">
                    <Download size={18} />
                  </button>
                  <button onClick={() => setIsFullscreen(true)} className="text-zinc-600 hover:text-white p-2 hover:bg-white/5 rounded-lg transition-all" title="Expandir">
                    <Maximize2 size={18} />
                  </button>
                </div>
              </div>

              {/* MARBETE VIRTUAL */}
              <div ref={virtualLabelRef} style={{ border: `4px solid black`, width: '360px', height: '540px' }} className="bg-white text-black flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden font-sans group animate-in zoom-in-95 duration-500">
                <div style={{ backgroundColor: template.headerBg, color: template.headerTextColor }} className="p-5 flex items-center gap-4 border-b-4 border-black shrink-0">
                  {(template.logoUrl || CV_DIRECTO_LOGO_SVG) && <img src={template.logoUrl || CV_DIRECTO_LOGO_SVG} className="h-10 w-auto max-w-[70px] object-contain" alt="Logo" />}
                  <div className="flex flex-col flex-1 min-w-0">
                    <h2 className="text-xl font-black leading-tight uppercase truncate">{template.headerText}</h2>
                    <p className="text-[7px] font-bold tracking-[0.3em] opacity-80 uppercase">Previsualización Real</p>
                  </div>
                </div>
                <div className="p-8 flex flex-col gap-6 flex-1 overflow-hidden">
                  <div className="border-b-2 border-black pb-4 shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">SKU / ID ACTIVO</p>
                    <p className="text-2xl font-black break-words uppercase tracking-tighter leading-none mt-1">{inventory.sku || 'N/A'}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center py-4 min-h-0">
                    <QRRenderer value={qrValue} size={template.qrSize + 20} />
                    <p className="text-[8px] font-bold text-zinc-300 mt-4 uppercase tracking-[0.3em]">Scannable High-Definition</p>
                  </div>
                  <div className="border-t-2 border-black pt-5 mb-2 shrink-0">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">DETALLE DESCRIPTIVO</p>
                    <p className="text-[13px] font-bold uppercase line-clamp-4 leading-tight">{inventory.description || 'ASIGNA UNA DESCRIPCIÓN PARA VISUALIZAR EL DISEÑO FINAL'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE ACCIÓN GLOBAL FLOTANTE */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900 border-2 border-blue-500/30 px-10 py-6 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,0.8)] flex flex-col md:flex-row items-center gap-10 animate-in slide-in-from-bottom-10 backdrop-blur-xl">
            <div className="flex items-center gap-8">
              <div className="flex flex-col">
                <span className="text-blue-500 font-black text-[14px] uppercase tracking-tighter">{selectedIds.size} Marbetes en Cola</span>
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.3em] mt-1">Listo para procesamiento</span>
              </div>
              <div className="h-10 w-[1px] bg-zinc-800 hidden md:block"></div>
              <div className="flex flex-col">
                <span className="text-white font-black text-xs uppercase">{totalPages} Hojas</span>
                <span className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Formato 215.9mm</span>
              </div>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={() => { setPreviewPage(0); setShowPreview(true); }} 
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-[1.25rem] font-black text-xs uppercase tracking-widest flex items-center justify-center gap-4 transition-all shadow-[0_10px_25px_rgba(59,130,246,0.3)] hover:scale-105 active:scale-95"
              >
                <Printer size={20} /> Ejecutar Producción
              </button>
              <button 
                onClick={() => setSelectedIds(new Set())} 
                className="p-4 bg-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-700 rounded-2xl transition-all"
                title="Deseleccionar"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* VISTA EXPANDIDA DEL QR (MODAL) */}
        {isFullscreen && (
          <div className="fixed inset-0 z-[250] bg-black/98 flex items-center justify-center p-8 backdrop-blur-3xl animate-in fade-in duration-300">
            <button onClick={() => setIsFullscreen(false)} className="absolute top-10 right-10 text-zinc-500 bg-white/5 p-5 rounded-full hover:bg-white/10 hover:text-white transition-all"><X size={32} /></button>
            <div className="bg-white p-20 rounded-[3rem] shadow-[0_0_150px_rgba(255,255,255,0.1)] flex flex-col items-center gap-10 scale-110">
               <div className="bg-white border-8 border-white p-4 shadow-inner">
                  <QRRenderer value={qrValue} size={400} />
               </div>
               <div className="text-center">
                 <p className="text-zinc-400 font-black text-xs uppercase tracking-[0.5em] mb-3">Valor Codificado</p>
                 <p className="text-black font-mono font-bold text-lg max-w-md break-all leading-tight">{qrValue}</p>
               </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 10%; }
          50% { top: 90%; }
        }
        
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        
        #print-area { display: none; }

        @media print {
          #main-ui { display: none !important; }
          #print-area { display: block !important; }
          body { background: white !important; margin: 0 !important; padding: 0 !important; }
          @page { size: letter; margin: 0; }
          
          .print-page {
            width: 215.9mm;
            height: 279.4mm;
            page-break-after: always;
            box-sizing: border-box;
            background: white;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(2, 1fr);
          }
          .print-label-container {
            width: 107.95mm;
            height: 139.7mm;
            padding: 8mm;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            border: 0.1mm dashed #eee;
          }
        }
      `}</style>
    </div>
  );
};

export default App;
