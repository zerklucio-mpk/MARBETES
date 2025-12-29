
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
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
  Scan,
  Plus,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Download,
  Layers,
  Loader2,
  ImagePlus
} from 'lucide-react';
import { 
  InventoryData,
  TemplateConfig,
  ProductRecord
} from './types';

// --- CONSTANTES ---
const STORAGE_KEY = 'qr_studio_db_v3';

// --- COMPONENTES OPTIMIZADOS (MEMOIZADOS) ---

const QRRenderer = memo(({ value, size }: { value: string; size: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      // Usamos ErrorCorrectionLevel 'L' para un patrón menos denso y lectura más rápida
      // Margin 4 es el estándar para facilitar el enfoque del sensor
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 4, 
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'L'
      }, (error) => {
        if (error) console.error("QR generation failed", error);
      });
    }
  }, [value, size]);

  return <canvas ref={canvasRef} className="max-w-full h-auto rounded-none shadow-sm" />;
});

const PrintableLabel = memo(({ product, template }: { product: ProductRecord; template: TemplateConfig }) => {
  const qrValue = useMemo(() => 
    `SKU:${product.sku || 'N/A'}${template.qrSeparator}DESC:${product.description || ''}`,
    [product.sku, product.description, template.qrSeparator]
  );
  
  return (
    <div className="bg-white text-black flex flex-col border-[4px] border-black h-full w-full overflow-hidden font-sans box-border select-none">
      {/* Header optimizado para lectura rápida */}
      <div style={{ backgroundColor: template.headerBg, color: template.headerTextColor }} className="p-3 flex items-center gap-4 border-b-[4px] border-black shrink-0 min-h-[55px]">
        {template.logoUrl && <img src={template.logoUrl} className="h-8 w-auto max-w-[70px] object-contain" alt="Logo" />}
        <div className="flex flex-col flex-1 min-w-0">
          <h2 className="text-lg font-black leading-tight uppercase truncate tracking-tight">{template.headerText}</h2>
          <p className="text-[7px] font-bold tracking-[0.1em] opacity-90 uppercase">Control de Activos</p>
        </div>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
        {/* SKU con máximo contraste y tamaño */}
        <div className="bg-zinc-100 p-2 rounded-sm border-l-4 border-black shrink-0">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-0.5">IDENTIFICADOR SKU</p>
          <p className="text-2xl font-black leading-none break-all uppercase tracking-tighter text-black">{product.sku}</p>
        </div>

        {/* QR con zona de silencio optimizada */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-2 overflow-hidden bg-white">
          <QRRenderer value={qrValue} size={template.qrSize} />
        </div>

        {/* Descripción clara */}
        <div className="border-t-2 border-zinc-200 pt-2 shrink-0">
          <p className="text-[9px] font-black text-zinc-500 uppercase mb-1 tracking-widest">DETALLES</p>
          <p className="text-[11px] font-bold uppercase leading-snug line-clamp-3 text-zinc-800">
            {product.description || 'SIN DATOS'}
          </p>
        </div>
      </div>
    </div>
  );
});

const CatalogItem = memo(({ prod, isSelected, onToggle, onSelect, onDelete }: { 
  prod: ProductRecord; 
  isSelected: boolean; 
  onToggle: (id: string) => void;
  onSelect: (prod: ProductRecord) => void;
  onDelete: (id: string) => void;
}) => {
  return (
    <div 
      className={`group border-2 rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer ${isSelected ? 'bg-blue-600/10 border-blue-600/50' : 'bg-zinc-950/40 border-zinc-800/40 hover:border-zinc-700'}`} 
      onClick={() => onToggle(prod.id)}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-zinc-800 text-zinc-600'}`}>
        {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
      </div>
      <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onSelect(prod); }}>
        <p className={`text-sm font-black uppercase tracking-tight truncate ${isSelected ? 'text-blue-400' : 'text-zinc-100'}`}>{prod.sku}</p>
        <p className="text-[10px] font-bold text-zinc-500 truncate uppercase mt-0.5">{prod.description || 'SIN DESCRIPCIÓN'}</p>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(prod.id); }} 
        className="p-2.5 text-zinc-800 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg"
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
});

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
    qrSize: 180, // Aumentado para mejor lectura
    showDate: true,
    borderWidth: 4,
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

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectProduct = useCallback((prod: ProductRecord) => {
    setInventory({ sku: prod.sku, description: prod.description });
    setActiveTab('content');
  }, []);

  const handleDeleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setProducts(currentProducts => {
      const filtered = currentProducts.filter(p => 
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      setSelectedIds(prev => {
        if (prev.size === filtered.length) return new Set();
        return new Set(filtered.map(p => p.id));
      });
      return currentProducts;
    });
  }, [searchTerm]);

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

  const itemsPerPage = 4; 
  const allProductsForPrinting = useMemo(() => {
    if (selectedIds.size > 0) return selectedProducts;
    if (inventory.sku) return [{ ...inventory, id: 'temp-quick-print' } as ProductRecord];
    return [];
  }, [selectedIds, selectedProducts, inventory.sku, inventory.description]);

  const totalPages = Math.ceil(allProductsForPrinting.length / itemsPerPage);
  
  const qrValue = useMemo(() => 
    `SKU:${inventory.sku || 'N/A'}${template.qrSeparator}DESC:${inventory.description || ''}`, 
    [inventory.sku, inventory.description, template.qrSeparator]
  );

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
    if (!virtualLabelRef.current) return;
    setExportProgress({ current: 1, total: 1 });
    try {
      const dataUrl = await toJpeg(virtualLabelRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      link.download = `MARBETE_${(inventory.sku || 'ID').replace(/\s+/g, '_')}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      alert('Error al generar imagen.');
    } finally {
      setExportProgress(null);
    }
  };

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
          pixelRatio: 2,
          backgroundColor: '#ffffff'
        });
        const link = document.createElement('a');
        link.download = `HOJA_CARTA_PAG_${i + 1}.jpg`;
        link.href = dataUrl;
        link.click();
        await new Promise(r => setTimeout(r, 200));
      }
    } catch (error) {
      alert('Error en la generación.');
    } finally {
      printArea.style.display = originalDisplay;
      setExportProgress(null);
      setShowPreview(false);
    }
  };

  return (
    <div className={`min-h-screen text-zinc-100 flex flex-col ${template.fontFamily}`}>
      
      {/* CAPA DE IMPRESIÓN REAL */}
      {(showPreview || exportProgress) && (
        <div id="print-area" className="hidden">
          {Array.from({ length: totalPages }).map((_, pageIdx) => (
            <div key={pageIdx} className="print-page">
              {allProductsForPrinting.slice(pageIdx * itemsPerPage, pageIdx * itemsPerPage + itemsPerPage).map((prod) => (
                <div key={prod.id} className="print-label-cell">
                  <PrintableLabel product={prod} template={template} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* OVERLAY ESCÁNER */}
      {isScanning && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl">
          <div className="relative w-full max-w-lg aspect-square bg-zinc-900 overflow-hidden rounded-[2.5rem] border-4 border-blue-500/50 shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-70" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 h-4/5 border-2 border-dashed border-white/20 rounded-3xl relative">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-blue-500 animate-[scan_2s_infinite]"></div>
              </div>
            </div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Cerrar Escáner</button>
        </div>
      )}

      {/* MODAL DE PROCESAMIENTO */}
      {exportProgress && (
        <div className="fixed inset-0 z-[300] bg-black/90 flex flex-col items-center justify-center p-6 backdrop-blur-md">
          <div className="w-full max-w-xs space-y-6 text-center">
            <Loader2 className="text-blue-500 animate-spin mx-auto" size={48} />
            <h3 className="text-lg font-black uppercase tracking-tighter text-white">Generando...</h3>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}></div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISTA PREVIA */}
      {showPreview && (
        <div className="fixed inset-0 z-[150] bg-zinc-950/98 flex flex-col items-center justify-center p-4 md:p-6 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="w-full h-full flex flex-col overflow-hidden max-w-6xl">
            <div className="flex justify-between items-center mb-6 px-4 shrink-0">
              <div className="flex items-center gap-4">
                <Printer className="text-blue-500" size={24} />
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Vista Previa Hoja Carta</h3>
              </div>
              <button onClick={() => setShowPreview(false)} className="bg-white/5 p-3 rounded-full text-zinc-400 hover:text-white transition-all"><X size={20} /></button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-hidden bg-zinc-900/40 rounded-[2.5rem] border border-white/5 relative p-4 group">
               <div className="w-full h-full flex items-center justify-center">
                 <div className="preview-sheet-scaler">
                   <div className="preview-letter-sheet-real bg-white grid grid-cols-2 grid-rows-2 p-[10mm] gap-[10mm] shadow-2xl">
                     {allProductsForPrinting.slice(previewPage * itemsPerPage, previewPage * itemsPerPage + itemsPerPage).map((prod) => (
                       <div key={prod.id} className="w-full h-full flex items-center justify-center">
                         <PrintableLabel product={prod} template={template} />
                       </div>
                     ))}
                     {Array.from({ length: Math.max(0, 4 - allProductsForPrinting.slice(previewPage * itemsPerPage, previewPage * itemsPerPage + itemsPerPage).length) }).map((_, i) => (
                       <div key={`empty-${i}`} className="w-full h-full border-2 border-dashed border-gray-100 rounded-lg flex items-center justify-center bg-gray-50/20">
                         <span className="text-[8px] font-black text-gray-200 uppercase tracking-widest">Vacío</span>
                       </div>
                     ))}
                   </div>
                 </div>

                 {totalPages > 1 && (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                      <button disabled={previewPage === 0} onClick={() => setPreviewPage(p => p - 1)} className="pointer-events-auto bg-black/60 p-4 rounded-full text-white hover:bg-blue-600 disabled:opacity-5"><ChevronLeft size={32} /></button>
                      <button disabled={previewPage === totalPages - 1} onClick={() => setPreviewPage(p => p + 1)} className="pointer-events-auto bg-black/60 p-4 rounded-full text-white hover:bg-blue-600 disabled:opacity-5"><ChevronRight size={32} /></button>
                    </div>
                  )}
               </div>
            </div>

            <div className="mt-8 flex flex-col items-center gap-6 shrink-0">
              <p className="text-[11px] font-black text-zinc-500 uppercase">Página {previewPage + 1} de {totalPages}</p>
              <div className="flex gap-4 w-full">
                <button onClick={handleExportJpeg} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-4 transition-all">
                  <Download size={20} /> Descargar Hoja Carta (.JPG)
                </button>
                <button onClick={() => setShowPreview(false)} className="bg-zinc-800 text-zinc-400 px-10 py-6 rounded-2xl font-black text-xs uppercase">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL UI */}
      <div id="main-ui" className="flex-1 flex flex-col items-center p-4 md:p-10 lg:p-16 max-w-[1600px] mx-auto w-full gap-8">
        
        <header className="w-full flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_10px_40px_rgba(59,130,246,0.3)] rotate-2">
              <QrCodeIcon className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter">CV <span className="text-blue-600">DIRECTO</span></h1>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">SISTEMA DE CONTROL INDUSTRIAL</p>
            </div>
          </div>
          
          {products.length > 0 && (
            <div className="bg-zinc-900/50 px-6 py-3 rounded-2xl border border-zinc-800 flex items-center gap-4">
              <div className="text-right">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Catálogo</p>
                <p className="text-lg font-black text-white leading-none">{products.length}</p>
              </div>
              <Database className="text-blue-500" size={20} />
            </div>
          )}
        </header>

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col min-h-[650px]">
              <nav className="flex bg-black/40 border-b border-zinc-800/60 p-2 gap-1">
                {[
                  { id: 'content', label: 'Captura', icon: ClipboardList },
                  { id: 'database', label: 'Catálogo', icon: Database },
                  { id: 'design', label: 'Identidad', icon: Palette },
                  { id: 'format', label: 'Lógica', icon: Code2 },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-6 py-4 text-[11px] font-black uppercase rounded-2xl grow md:grow-0 transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <tab.icon size={16} />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="p-8 md:p-10 flex-1">
                {activeTab === 'content' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-10">
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">SKU del Activo</label>
                        <div className="flex gap-4">
                          <input type="text" value={inventory.sku} onChange={e => setInventory({...inventory, sku: e.target.value.toUpperCase()})}
                            className="flex-1 bg-zinc-950 border border-zinc-800/60 p-6 rounded-2xl font-mono text-lg focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder:text-zinc-800" placeholder="SKU..." />
                          <button onClick={startScanner} className="bg-zinc-800 hover:bg-zinc-700 text-white p-6 rounded-2xl transition-all shadow-xl active:scale-95"><Scan size={28} /></button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Descripción</label>
                        <textarea rows={6} value={inventory.description} onChange={e => setInventory({...inventory, description: e.target.value})}
                          className="w-full bg-zinc-950 border border-zinc-800/60 p-6 rounded-2xl text-sm outline-none resize-none focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-zinc-800" placeholder="Descripción..." />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={handleAddProduct} disabled={!inventory.sku} className={`flex-1 py-7 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-4 shadow-xl transition-all active:scale-[0.98] ${!inventory.sku ? 'bg-zinc-800 text-zinc-600' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'}`}>
                        <Plus size={24} /> Registrar en Catálogo
                      </button>
                      <button onClick={() => { setInventory({sku:'', description:''}); setSelectedIds(new Set()); }} className="p-7 bg-zinc-800 text-zinc-400 rounded-2xl hover:bg-zinc-700 transition-all active:scale-95"><RotateCcw size={24} /></button>
                    </div>
                  </div>
                )}

                {activeTab === 'database' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 flex flex-col gap-6 h-full">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600" />
                        <input type="text" placeholder="BUSCAR POR SKU O DESCRIPCIÓN..." className="w-full bg-zinc-950 border border-zinc-800/60 py-5 pl-14 pr-4 rounded-2xl text-[11px] font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={downloadCsvTemplate} className="px-6 py-5 bg-zinc-950 border border-zinc-800/60 rounded-2xl text-emerald-500 text-[10px] font-black uppercase hover:bg-emerald-500/10 transition-all"><FileSpreadsheet size={18} /></button>
                        <button onClick={() => csvInputRef.current?.click()} className="px-6 py-5 bg-zinc-950 border border-zinc-800/60 rounded-2xl text-zinc-400 text-[10px] font-black uppercase hover:bg-white/5 transition-all"><UploadCloud size={18} /></button>
                        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const rows = (ev.target?.result as string).split('\n');
                            const news: ProductRecord[] = [];
                            for (let i = 1; i < rows.length; i++) {
                              const cols = rows[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
                              if (cols.length >= 2) news.push({ id: Math.random().toString(), sku: cols[0].toUpperCase(), description: cols[1] });
                            }
                            setProducts(prev => [...news, ...prev]);
                          };
                          reader.readAsText(file);
                        }} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                      <button onClick={handleSelectAll} className="flex items-center gap-3 text-[11px] font-black uppercase text-zinc-500 hover:text-blue-500 transition-colors">
                        {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}
                        Seleccionar Todo ({selectedIds.size})
                      </button>
                      <button onClick={handleClearDatabase} className="text-[10px] font-black uppercase text-red-500/40 hover:text-red-500 transition-colors">Vaciar Catálogo</button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-4 min-h-0">
                      {filteredProducts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-800 py-20">
                          <Database size={64} className="mb-4 opacity-20" />
                          <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-30">Sin resultados</p>
                        </div>
                      ) : (
                        filteredProducts.map(prod => (
                          <CatalogItem 
                            key={prod.id} 
                            prod={prod} 
                            isSelected={selectedIds.has(prod.id)}
                            onToggle={handleToggleSelection}
                            onSelect={handleSelectProduct}
                            onDelete={handleDeleteProduct}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
                
                {activeTab === 'design' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-12">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Texto de Marca</label>
                          <input type="text" value={template.headerText} onChange={e => setTemplate({...template, headerText: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800/60 p-5 rounded-2xl text-sm font-black uppercase outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                        </div>
                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Color de Cabecera</label>
                          <div className="flex items-center gap-4">
                            <input type="color" value={template.headerBg} onChange={e => setTemplate({...template, headerBg: e.target.value})} className="w-16 h-16 bg-transparent rounded-2xl cursor-pointer border-4 border-zinc-800 hover:border-zinc-700 transition-all" />
                            <span className="text-xs font-mono text-zinc-500">{template.headerBg.toUpperCase()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Logo de Empresa</label>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full h-32 bg-zinc-950 border-2 border-dashed border-zinc-800 hover:border-blue-500/50 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-xs font-black text-zinc-600 transition-all group">
                          <ImagePlus size={32} className="group-hover:scale-110 transition-transform" /> 
                          {template.logoUrl ? 'Cambiar Imagen' : 'Subir marca gráfica'}
                        </button>
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setTemplate(prev => ({ ...prev, logoUrl: reader.result as string }));
                            reader.readAsDataURL(file);
                          }
                        }} />
                        {template.logoUrl && (
                          <button onClick={() => setTemplate(p => ({...p, logoUrl: undefined}))} className="text-[10px] font-black uppercase text-red-500/50 hover:text-red-500">Eliminar Logo</button>
                        )}
                      </div>
                  </div>
                )}

                {activeTab === 'format' && (
                  <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-12">
                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Separador de Datos QR</label>
                      <div className="grid grid-cols-6 gap-4">
                        {['|', '_', '-', '/', '#', ':'].map(sep => (
                          <button key={sep} onClick={() => setTemplate({ ...template, qrSeparator: sep })}
                            className={`p-7 rounded-2xl border-2 text-3xl font-black transition-all ${template.qrSeparator === sep ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30' : 'bg-zinc-950 border-zinc-800 text-zinc-700 hover:border-zinc-700'}`}>{sep}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="sticky top-10 flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6 px-4">
                <span className="text-[11px] font-black text-zinc-500 uppercase tracking-widest">Monitor de Impresión</span>
                <div className="flex gap-2">
                   <button onClick={handleQuickJpeg} className="text-zinc-600 hover:text-emerald-500 p-2.5 transition-all" title="Descargar como JPG"><Download size={20} /></button>
                   <button onClick={() => setIsFullscreen(true)} className="text-zinc-600 hover:text-white p-2.5 transition-all" title="Pantalla completa"><Maximize2 size={20} /></button>
                </div>
              </div>

              {/* Marbete en monitor optimizado */}
              <div ref={virtualLabelRef} className="bg-white text-black flex flex-col shadow-[0_50px_100px_rgba(0,0,0,0.5)] overflow-hidden font-sans border-[6px] border-black w-[380px] h-[580px]">
                <div style={{ backgroundColor: template.headerBg, color: template.headerTextColor }} className="p-6 flex items-center gap-5 border-b-[6px] border-black shrink-0 min-h-[80px]">
                  {template.logoUrl && <img src={template.logoUrl} className="h-12 w-auto max-w-[90px] object-contain" alt="Logo" />}
                  <div className="flex flex-col flex-1 min-w-0">
                    <h2 className="text-2xl font-black leading-tight uppercase truncate tracking-tight">{template.headerText}</h2>
                    <p className="text-[9px] font-bold opacity-90 uppercase tracking-[0.2em]">Identificación de Activos</p>
                  </div>
                </div>
                <div className="p-8 flex flex-col gap-8 flex-1 overflow-hidden bg-white">
                  <div className="bg-zinc-100 p-4 border-l-8 border-black shadow-sm">
                    <p className="text-[12px] font-black text-zinc-500 uppercase tracking-widest mb-1">CÓDIGO SKU</p>
                    <p className="text-4xl font-black uppercase tracking-tighter text-black">{inventory.sku || '---'}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center py-4 min-h-0 bg-white">
                    <QRRenderer value={qrValue} size={template.qrSize + 40} />
                  </div>
                  <div className="border-t-[4px] border-zinc-100 pt-6 mb-2">
                    <p className="text-[12px] font-black text-zinc-500 uppercase mb-2 tracking-widest">ESPECIFICACIONES</p>
                    <p className="text-[15px] font-bold uppercase line-clamp-4 leading-snug text-zinc-800">{inventory.description || 'SIN REGISTRO ASIGNADO'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-zinc-900/95 border border-blue-500/30 px-6 py-4 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] flex items-center gap-8 animate-in slide-in-from-bottom-10 backdrop-blur-xl">
            <div className="flex items-center gap-4 border-r border-zinc-800 pr-8">
              <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
                <Layers className="text-blue-500" size={18} />
              </div>
              <div className="flex flex-col">
                <span className="text-white font-black text-sm uppercase tracking-tight">{selectedIds.size} ACTIVOS SELECCIONADOS</span>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">FORMATO CARTA (2X2)</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setPreviewPage(0); setShowPreview(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-lg active:scale-95">
                <Printer size={16} /> GENERAR VISTA PREVIA
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="p-3 bg-zinc-800 text-zinc-500 hover:text-white rounded-xl transition-all">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {isFullscreen && (
          <div className="fixed inset-0 z-[250] bg-black/98 flex items-center justify-center p-12 backdrop-blur-3xl animate-in fade-in duration-400">
            <button onClick={() => setIsFullscreen(false)} className="absolute top-12 right-12 text-zinc-500 bg-white/5 p-6 rounded-full transition-all hover:text-white"><X size={36} /></button>
            <div className="bg-white p-24 rounded-[4rem] flex flex-col items-center gap-12 scale-110 shadow-2xl">
               <div className="bg-white border-[16px] border-white p-4 shadow-inner">
                 <QRRenderer value={qrValue} size={480} />
               </div>
               <div className="text-center">
                  <p className="text-black font-black text-5xl uppercase tracking-tighter mb-4">{inventory.sku}</p>
                  <p className="text-zinc-400 font-mono font-bold text-lg uppercase tracking-widest">{qrValue}</p>
               </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan { 0%, 100% { top: 10%; } 50% { top: 90%; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #18181b; border-radius: 12px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        
        #print-area { display: none; }
        .print-page {
          width: 215.9mm;
          height: 279.4mm;
          background: white;
          padding: 15mm;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 15mm;
          box-sizing: border-box;
          page-break-after: always;
        }
        .print-label-cell {
          width: 100%; height: 100%;
          box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
        }

        .preview-sheet-scaler {
          aspect-ratio: 8.5 / 11;
          height: 82vh; 
          display: flex; align-items: center; justify-content: center;
        }
        
        .preview-letter-sheet-real {
          width: 215.9mm; height: 279.4mm;
          box-sizing: border-box;
          transform: scale(calc(82vh / 279.4mm * 0.9));
          transform-origin: center center;
          pointer-events: none;
        }

        @media print {
          #main-ui { display: none !important; }
          #print-area { display: block !important; }
          @page { size: letter; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default App;
