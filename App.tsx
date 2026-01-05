
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { 
  QrCode as QrCodeIcon, 
  Printer, 
  Palette, 
  X,
  Maximize2,
  ClipboardList,
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
  ImagePlus,
  Hash,
  MapPin,
  FileText,
  Tag,
  Boxes,
  Eye
} from 'lucide-react';
import { 
  InventoryData,
  TemplateConfig,
  ProductRecord
} from './types';

// --- CONSTANTES ---
const STORAGE_KEY = 'qr_studio_db_v5';
const ZONES = ['TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// --- COMPONENTES OPTIMIZADOS (MEMOIZADOS) ---

const QRRenderer = memo(({ value, size }: { value: string; size: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1, 
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      }, (error) => {
        if (error) console.error("Error al generar QR", error);
      });
    }
  }, [value, size]);

  return <canvas ref={canvasRef} className="max-w-full h-auto rounded-none" />;
});

interface PrintableLabelProps {
  product: ProductRecord;
  template: TemplateConfig;
  groupIndex?: number;
  groupTotal?: number;
  isMiniMode?: boolean;
}

const PrintableLabel = memo(({ product, template, groupIndex, groupTotal, isMiniMode = false }: PrintableLabelProps) => {
  const isPickeoZone = useMemo(() => 
    product.localizador?.toString().trim().endsWith('1'),
    [product.localizador]
  );

  const qrValue = useMemo(() => {
    const piecesData = isPickeoZone ? '0' : product.pieces;
    const sep = template.qrSeparator;
    return `${product.sku}${sep}${product.localizador}${sep}${piecesData}${sep}${product.description}${sep}${product.subinventario || ''}`;
  }, [product, template.qrSeparator, isPickeoZone]);

  const displayQrSize = useMemo(() => {
    if (isMiniMode) {
      return 105; 
    } else {
      let baseSize = template.qrSize;
      if (template.qrsPerLabel === 1) return baseSize;
      if (template.qrsPerLabel <= 2) return baseSize * 0.8;
      return baseSize * 0.6;
    }
  }, [template.qrSize, template.qrsPerLabel, isMiniMode]);

  if (isMiniMode) {
    return (
      <div className="bg-white text-black flex flex-col h-full w-full overflow-hidden font-sans border border-zinc-200 select-none box-border">
        <div className="bg-black text-white px-2 flex items-center justify-between shrink-0 h-[18px]">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-600 rounded-full flex items-center justify-center font-black text-[5px]">CV</div>
            <h2 className="text-[8px] font-black leading-none uppercase tracking-tighter">{template.headerText}</h2>
          </div>
          <span className="text-[5px] font-black opacity-70 uppercase tracking-tight">
            {groupTotal && groupTotal > 1 ? `${groupIndex} de ${groupTotal}` : 'CTL'}
          </span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-between p-1 overflow-hidden">
          <div className="w-full text-center shrink-0 pt-0.5">
             <span className="text-[4px] font-bold text-zinc-400 uppercase leading-none block mb-0.5 tracking-tighter">ARTÍCULO / SKU</span>
             <p className="text-[12px] font-black leading-none uppercase truncate tracking-tight text-black">
               {product.sku}
             </p>
          </div>

          <div className="flex-1 flex items-center justify-center w-full min-h-0">
             <QRRenderer value={qrValue} size={displayQrSize} />
          </div>

          <div className="w-full shrink-0">
            <div className="border-t border-zinc-200 py-1 text-center">
              <span className="text-[4px] font-bold text-zinc-400 uppercase leading-none block mb-0.5">UBICACIÓN / SUBINV</span>
              <p className="text-[10px] font-black leading-none uppercase text-blue-800 tracking-tight">
                {product.localizador} {product.subinventario ? `| ${product.subinventario}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-black flex flex-col h-full w-full overflow-hidden font-sans box-border select-none border border-zinc-200">
      <div className="bg-black text-white px-5 py-2 flex items-center gap-3 shrink-0 h-[60px]">
        {template.logoUrl ? (
          <img src={template.logoUrl} className="h-9 w-auto object-contain" alt="Logo" />
        ) : (
          <div className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center font-black text-xs">CV</div>
        )}
        <div className="flex flex-col min-w-0">
          <h2 className="text-xl font-black leading-none tracking-tighter truncate uppercase">{template.headerText}</h2>
          <p className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-80 mt-0.5">MARBETE DE CONTROL</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 py-3 overflow-hidden">
        <div className="flex justify-between items-end mb-1 shrink-0">
          <div className="min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5">
              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">ID / SKU</p>
              {isPickeoZone && (
                <span className="bg-blue-600 text-white text-[7px] px-1.5 py-0.5 rounded font-black uppercase">PICKEO</span>
              )}
            </div>
            <p className="text-2xl font-black leading-none uppercase truncate">{product.sku || '---'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">CANTIDAD</p>
            <p className="text-3xl font-black leading-none">{isPickeoZone ? '---' : (product.pieces || 0)}</p>
          </div>
        </div>

        <div className="h-[2px] bg-black w-full mb-3 shrink-0"></div>

        <div className="flex-1 min-h-0 flex items-center justify-center py-1 overflow-hidden">
          <div className={`w-full max-h-full grid ${template.qrsPerLabel > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 items-center justify-center`}>
            {Array.from({ length: template.qrsPerLabel }).map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                <QRRenderer value={qrValue} size={displayQrSize} />
                <span className="text-[6px] font-bold text-zinc-400 mt-1 uppercase">{product.sku} | {product.localizador}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="h-[1px] bg-zinc-200 w-full my-2 shrink-0"></div>

        <div className="shrink-0 mb-2">
          <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight leading-none mb-1">DESCRIPCIÓN DEL ARTÍCULO</p>
          <p className="text-[12px] font-bold italic uppercase leading-none line-clamp-1 text-zinc-800">
            {product.description || 'N/A'}
          </p>
        </div>

        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 mt-auto shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[7px] font-black text-zinc-400 uppercase tracking-tight mb-0.5">UBICACIÓN / SUBINV</p>
              <p className="text-2xl font-black uppercase leading-none text-black">
                {product.localizador || '---'} {product.subinventario ? <span className="text-blue-600 ml-2">/ {product.subinventario}</span> : ''}
              </p>
            </div>
            {groupTotal && groupTotal > 1 && (
               <div className="text-right">
                  <p className="text-[7px] font-black text-zinc-400 uppercase tracking-tight mb-0.5">SECUENCIA</p>
                  <p className="text-lg font-black text-blue-600">{groupIndex}/{groupTotal}</p>
               </div>
            )}
          </div>
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
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">{prod.localizador}</span>
          {prod.subinventario && (
            <span className="text-[8px] bg-blue-950/30 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">{prod.subinventario}</span>
          )}
          <span className="text-[8px] bg-emerald-950/30 text-emerald-500 px-1.5 py-0.5 rounded font-bold uppercase">{prod.pieces} UDS</span>
        </div>
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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'content' | 'database' | 'design'>('content');
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportProgress, setExportProgress] = useState<{current: number, total: number} | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('TODOS');
  
  const [products, setProducts] = useState<ProductRecord[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<InventoryData>({ sku: '', description: '', localizador: '', pieces: 0, subinventario: '' });
  
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerInterval = useRef<number | null>(null);
  const virtualLabelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [template, setTemplate] = useState<TemplateConfig>({
    headerText: 'CVDIRECTO',
    headerBg: '#000000',
    headerTextColor: '#ffffff',
    accentColor: '#3b82f6',
    barcodeWidth: 160, 
    barcodeHeight: 160,
    qrSize: 150, 
    showDate: true,
    borderWidth: 4,
    borderStyle: 'solid',
    fontFamily: 'font-sans',
    logoUrl: undefined,
    qrFormat: 'PIPE',
    barcodeMode: 'STRUCTURED', 
    qrSeparator: '_',
    paperSize: 'LETTER',
    qrsPerLabel: 1
  });

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
    setInventory({ sku: prod.sku, description: prod.description, localizador: prod.localizador, pieces: prod.pieces, subinventario: prod.subinventario || '' });
    setActiveTab('content');
  }, []);

  const handleAddProduct = () => {
    if (!inventory.sku) return;
    const newProduct: ProductRecord = {
      ...inventory,
      id: Date.now().toString(),
      sku: inventory.sku.toUpperCase(),
      subinventario: inventory.subinventario.toUpperCase()
    };
    setProducts(prev => [newProduct, ...prev]);
    setInventory({ sku: '', description: '', localizador: '', pieces: 0, subinventario: '' });
  };

  const handleClearDatabase = () => {
    if (window.confirm('¿ELIMINAR TODO EL HISTORIAL DE MARBETES?')) {
      setProducts([]);
      setSelectedIds(new Set());
    }
  };

  const sortProductsByLocator = useCallback((list: ProductRecord[]) => {
    return [...list].sort((a, b) => 
      a.localizador.localeCompare(b.localizador, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, []);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (selectedZone !== 'TODOS') {
      list = list.filter(p => p.localizador.trim().toUpperCase().startsWith(selectedZone));
    }
    if (searchTerm) {
      list = list.filter(p => 
        p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.localizador.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.subinventario && p.subinventario.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return sortProductsByLocator(list);
  }, [products, searchTerm, selectedZone, sortProductsByLocator]);

  const selectedProducts = useMemo(() => {
    const list = products.filter(p => selectedIds.has(p.id));
    return sortProductsByLocator(list);
  }, [products, selectedIds, sortProductsByLocator]);

  const itemsPerPage = useMemo(() => {
    if (template.paperSize === 'LETTER') return 4;
    if (template.paperSize === 'LABEL') return 6;
    return 12;
  }, [template.paperSize]);
  
  const allForPrinting = useMemo(() => {
    if (selectedIds.size > 0) return selectedProducts;
    if (inventory.sku) return [{ ...inventory, id: 'temp-print' } as ProductRecord];
    return [];
  }, [selectedIds, selectedProducts, inventory]);

  const getGroupMetadata = useCallback((prod: ProductRecord) => {
    const sameSkuItems = allForPrinting.filter(p => p.sku === prod.sku);
    if (sameSkuItems.length <= 1) return { index: 1, total: 1 };
    const index = sameSkuItems.findIndex(p => p.id === prod.id) + 1;
    return { index, total: sameSkuItems.length };
  }, [allForPrinting]);

  const totalPages = Math.ceil(allForPrinting.length / itemsPerPage);

  const handleQuickJpeg = async () => {
    if (!virtualLabelRef.current) return;
    setExportProgress({ current: 1, total: 1 });
    try {
      const dataUrl = await toJpeg(virtualLabelRef.current, { quality: 0.95, pixelRatio: 5 });
      const link = document.createElement('a');
      link.download = `MARBETE_SOLO_${inventory.sku || 'IND'}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) { alert('Error al exportar marbete individual'); }
    setExportProgress(null);
  };

  const handleExportBatch = async () => {
    const printArea = document.getElementById('print-area');
    if (!printArea) return;
    setExportProgress({ current: 0, total: totalPages });
    printArea.style.display = 'block';
    try {
      const pages = printArea.querySelectorAll('.print-page');
      for (let i = 0; i < pages.length; i++) {
        setExportProgress({ current: i + 1, total: totalPages });
        const dataUrl = await toJpeg(pages[i] as HTMLElement, { 
          quality: 0.95, 
          pixelRatio: 5, 
          backgroundColor: '#ffffff' 
        });
        const link = document.createElement('a');
        link.download = `LOTE_${template.paperSize}_SALIDA_${i + 1}.jpg`;
        link.href = dataUrl;
        link.click();
        await new Promise(r => setTimeout(r, 800)); 
      }
      setSelectedIds(new Set());
      setShowPreview(false); 
    } catch (e) { alert('Error al procesar el lote de imágenes'); }
    printArea.style.display = 'none';
    setExportProgress(null);
  };

  const downloadCsvTemplate = () => {
    const csv = "SKU,LOCALIZADOR,PIEZAS,DESCRIPTION,SUBINVENTARIO\nID-100,A-1-1,15,Ejemplo de producto,ALMACEN-1";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_inventario_cv.csv';
    link.click();
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
    } catch (err) { setIsScanning(false); }
  };

  const stopScanner = () => {
    if (scannerInterval.current) clearInterval(scannerInterval.current);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
    setIsScanning(false);
  };

  const printPageStyle = useMemo(() => {
    if (template.paperSize === 'LETTER') {
      return { width: '215.9mm', height: '279.4mm', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
    }
    if (template.paperSize === 'LABEL') {
      return { width: '100mm', height: '155mm', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr 1fr' };
    }
    return { width: '100mm', height: '310mm', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(6, 1fr)' };
  }, [template.paperSize]);

  return (
    <div className={`min-h-screen text-zinc-100 flex flex-col ${template.fontFamily}`}>
      
      <div id="print-area" className="hidden fixed top-0 left-0" style={{ zIndex: -100 }}>
        {Array.from({ length: totalPages }).map((_, pIdx) => (
          <div key={pIdx} 
            className="print-page bg-white p-[1.5mm] grid gap-[1.5mm] box-border overflow-hidden"
            style={printPageStyle}
          >
            {allForPrinting.slice(pIdx * itemsPerPage, pIdx * itemsPerPage + itemsPerPage).map((prod) => {
              const meta = getGroupMetadata(prod);
              return (
                <div key={prod.id} className="w-full h-full overflow-hidden">
                  <PrintableLabel 
                    product={prod} 
                    template={template} 
                    groupIndex={meta.index} 
                    groupTotal={meta.total} 
                    isMiniMode={template.paperSize === 'LABEL' || template.paperSize === 'LABEL2'} 
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isScanning && (
        <div className="fixed inset-0 z-[500] bg-black/95 flex flex-col items-center justify-center p-6 backdrop-blur-xl">
          <div className="relative w-full max-w-lg aspect-square bg-zinc-900 overflow-hidden rounded-[2.5rem] border-4 border-blue-600 shadow-2xl">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover opacity-70" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 h-4/5 border-2 border-dashed border-white/20 rounded-3xl relative">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-blue-500 animate-[scan_2s_infinite]"></div>
              </div>
            </div>
          </div>
          <button onClick={stopScanner} className="mt-10 bg-white text-black px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-xl">Cerrar</button>
        </div>
      )}

      {exportProgress && (
        <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="text-blue-500 animate-spin mb-6" size={64} />
          <h2 className="text-2xl font-black uppercase tracking-tighter">Procesando {exportProgress.current} de {exportProgress.total}</h2>
          <p className="text-zinc-500 text-xs mt-2 uppercase font-bold tracking-widest">Generando archivos JPG...</p>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-[400] bg-zinc-950/95 flex flex-col backdrop-blur-3xl animate-in fade-in duration-300">
          {/* Header del Previsualizador */}
          <div className="h-20 shrink-0 flex items-center justify-between px-8 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <Eye className="text-white" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter leading-none">PREVISUALIZACIÓN</h3>
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Lote: {allForPrinting.length} marbetes</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="bg-zinc-900 px-4 py-2 rounded-xl border border-zinc-800 flex items-center gap-3">
                <span className="text-[9px] font-black text-zinc-600 uppercase">Hoja</span>
                <span className="text-sm text-white font-black">{previewPage + 1} <span className="text-zinc-700 mx-1">/</span> {totalPages}</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="w-10 h-10 bg-zinc-900/50 flex items-center justify-center rounded-xl hover:bg-red-600/10 hover:text-red-500 transition-all">
                <X size={20} />
              </button>
            </div>
          </div>
          
          {/* Área de Visualización Centrada */}
          <div className="flex-1 relative overflow-auto flex items-start justify-center p-8 bg-[#0a0a0a]">
             <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
             
             {totalPages > 1 && (
                <>
                  <button 
                    disabled={previewPage === 0} 
                    onClick={() => setPreviewPage(p => p - 1)} 
                    className="fixed left-6 top-1/2 -translate-y-1/2 z-10 w-16 h-16 bg-black/80 hover:bg-blue-600 text-white rounded-full flex items-center justify-center border border-white/10 disabled:opacity-0 disabled:pointer-events-none transition-all active:scale-90 shadow-2xl"
                  >
                    <ChevronLeft size={32} />
                  </button>
                  <button 
                    disabled={previewPage === totalPages - 1} 
                    onClick={() => setPreviewPage(p => p + 1)} 
                    className="fixed right-6 top-1/2 -translate-y-1/2 z-10 w-16 h-16 bg-black/80 hover:bg-blue-600 text-white rounded-full flex items-center justify-center border border-white/10 disabled:opacity-0 disabled:pointer-events-none transition-all active:scale-90 shadow-2xl"
                  >
                    <ChevronRight size={32} />
                  </button>
                </>
             )}

             {/* Contenedor de la Hoja con Escalado Automático */}
             <div className="flex items-center justify-center min-h-full py-4">
                <div 
                  className="bg-white grid p-[2mm] gap-[2mm] shadow-[0_40px_100px_rgba(0,0,0,0.7)] origin-top transition-transform duration-500 ease-out"
                  style={{
                    ...printPageStyle,
                    transform: 'scale(0.85)', // Escalado inicial base
                    maxHeight: 'calc(100vh - 200px)', // Evita que se salga del viewport vertical
                    zoom: '0.65' // Alternativa de escalado más moderna para mantener proporción visual
                  }}
                >
                  {allForPrinting.slice(previewPage * itemsPerPage, previewPage * itemsPerPage + itemsPerPage).map((prod) => {
                    const meta = getGroupMetadata(prod);
                    return (
                      <div key={prod.id} className="w-full h-full border-[0.5mm] border-zinc-100">
                        <PrintableLabel 
                          product={prod} 
                          template={template} 
                          groupIndex={meta.index} 
                          groupTotal={meta.total} 
                          isMiniMode={template.paperSize === 'LABEL' || template.paperSize === 'LABEL2'} 
                        />
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>

          {/* Footer de Acciones */}
          <div className="h-28 shrink-0 bg-black/60 flex items-center px-8 gap-6 border-t border-white/10 backdrop-blur-md">
            <button 
              onClick={handleExportBatch} 
              className="flex-1 max-w-xl mx-auto bg-blue-600 py-6 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-4 hover:bg-blue-500 shadow-2xl transition-all shadow-blue-600/30 active:scale-95 group"
            >
              <Download size={20} className="group-hover:translate-y-0.5 transition-transform" /> 
              DESCARGAR LOTE JPG FINAL
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center p-6 md:p-12 lg:p-20 max-w-[1700px] mx-auto w-full gap-10">
        <header className="w-full flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3">
              <QrCodeIcon className="text-white" size={40} />
            </div>
            <div>
              <h1 className="text-5xl font-black text-white uppercase tracking-tighter">CV <span className="text-blue-600">DIRECTO</span></h1>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">SISTEMA INTEGRAL DE MARBETES</p>
            </div>
          </div>
        </header>

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 flex flex-col gap-8">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-[3rem] overflow-hidden backdrop-blur-xl shadow-2xl flex flex-col min-h-[720px]">
              <nav className="flex bg-black/40 border-b border-zinc-800/60 p-3 gap-2 overflow-x-auto scrollbar-hide">
                {[
                  { id: 'content', label: 'Captura', icon: ClipboardList },
                  { id: 'database', label: 'Historial', icon: Database },
                  { id: 'design', label: 'Estilo', icon: Palette },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-8 py-4 text-[11px] font-black uppercase rounded-2xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <tab.icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'content' && (
                  <div className="animate-in fade-in duration-300 space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Identificador SKU</label>
                      <div className="flex gap-4">
                        <input type="text" value={inventory.sku} onChange={e => setInventory({...inventory, sku: e.target.value.toUpperCase()})}
                          className="flex-1 bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] font-mono text-2xl outline-none focus:border-blue-500 transition-all" placeholder="ID-000" />
                        <button onClick={startScanner} className="bg-zinc-800 hover:bg-zinc-700 text-white p-6 rounded-[1.5rem] transition-all"><Scan size={28} /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Localizador</label>
                        <input type="text" value={inventory.localizador} onChange={e => setInventory({...inventory, localizador: e.target.value.toUpperCase()})}
                          className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-xl font-black outline-none focus:border-blue-500 transition-all" placeholder="Ej: A-1-1" />
                      </div>
                      <div className="space-y-4">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Subinventario</label>
                        <input type="text" value={inventory.subinventario} onChange={e => setInventory({...inventory, subinventario: e.target.value.toUpperCase()})}
                          className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-xl font-black outline-none focus:border-blue-500 transition-all" placeholder="Ej: ALMACEN-1" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Piezas</label>
                      <input type="number" value={inventory.pieces} onChange={e => setInventory({...inventory, pieces: parseInt(e.target.value) || 0})}
                        className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-2xl font-black outline-none focus:border-blue-500 transition-all" />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Descripción</label>
                      <textarea rows={2} value={inventory.description} onChange={e => setInventory({...inventory, description: e.target.value.toUpperCase()})}
                        className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-sm font-bold outline-none resize-none" />
                    </div>

                    <button onClick={handleAddProduct} disabled={!inventory.sku} className={`w-full py-8 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-4 transition-all active:scale-95 ${!inventory.sku ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/20'}`}>
                      <Plus size={28} /> Añadir a Historial
                    </button>
                  </div>
                )}

                {activeTab === 'database' && (
                  <div className="animate-in fade-in duration-300 space-y-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <MapPin size={12} /> Zonas de Localización
                      </label>
                      <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
                        {ZONES.map(zone => (
                          <button
                            key={zone}
                            onClick={() => setSelectedZone(zone)}
                            className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase transition-all whitespace-nowrap border ${selectedZone === zone ? 'bg-blue-600 text-white border-blue-500 shadow-lg' : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:text-zinc-400'}`}
                          >
                            {zone}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
                        <input type="text" placeholder="BUSCAR..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-6 pl-16 rounded-[1.5rem] text-xs font-black uppercase outline-none focus:border-blue-500" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={downloadCsvTemplate} className="p-6 bg-zinc-950 border border-zinc-800 rounded-[1.5rem] text-emerald-500 transition-all"><FileSpreadsheet /></button>
                        <button onClick={()=>csvInputRef.current?.click()} className="p-6 bg-zinc-950 border border-zinc-800 rounded-[1.5rem] text-zinc-400 hover:bg-white/5 transition-all"><UploadCloud /></button>
                        <button onClick={handleClearDatabase} className="p-6 bg-zinc-950 border border-zinc-800 rounded-[1.5rem] text-red-500 hover:bg-red-500/10 transition-all"><Trash2 /></button>
                        <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const rows = (ev.target?.result as string).split('\n');
                            const news: ProductRecord[] = [];
                            for (let i = 1; i < rows.length; i++) {
                              const cols = rows[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
                              if (cols.length >= 4) {
                                news.push({ 
                                  id: Math.random().toString(), 
                                  sku: cols[0].toUpperCase(), 
                                  localizador: cols[1].toUpperCase(),
                                  pieces: parseInt(cols[2]) || 0,
                                  description: cols[3].toUpperCase(),
                                  subinventario: cols[4] ? cols[4].toUpperCase() : ''
                                });
                              }
                            }
                            setProducts(prev => [...news, ...prev]);
                          };
                          reader.readAsText(file);
                        }} />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {filteredProducts.map(prod => (
                        <CatalogItem key={prod.id} prod={prod} isSelected={selectedIds.has(prod.id)} onToggle={handleToggleSelection} onSelect={handleSelectProduct} onDelete={(id)=>setProducts(p=>p.filter(x=>x.id!==id))} />
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'design' && (
                  <div className="animate-in fade-in duration-300 space-y-10">
                     <div className="space-y-6">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dimensiones de Salida JPG</label>
                        <div className="grid grid-cols-1 gap-4">
                           <button onClick={()=>setTemplate({...template, paperSize: 'LETTER'})} className={`flex items-center gap-4 p-6 rounded-[1.5rem] border-2 transition-all ${template.paperSize === 'LETTER' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                              <FileText size={24} />
                              <div className="text-left font-black text-xs uppercase">Carta (4 por Hoja)</div>
                           </button>
                           <button onClick={()=>setTemplate({...template, paperSize: 'LABEL'})} className={`flex items-center gap-4 p-6 rounded-[1.5rem] border-2 transition-all ${template.paperSize === 'LABEL' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                              <Tag size={24} />
                              <div className="text-left font-black text-xs uppercase">Etiqueta (6 por Hoja)</div>
                           </button>
                           <button onClick={()=>setTemplate({...template, paperSize: 'LABEL2'})} className={`flex items-center gap-4 p-6 rounded-[1.5rem] border-2 transition-all ${template.paperSize === 'LABEL2' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                              <Tag size={24} />
                              <div className="text-left font-black text-xs uppercase">Etiqueta 2 (12 por Hoja - 10x31cm)</div>
                           </button>
                        </div>
                     </div>

                     <div className="space-y-6">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">QRs por cada Marbete</label>
                        <div className="grid grid-cols-6 gap-2">
                           {[1, 2, 3, 4, 5, 6].map(num => (
                             <button key={num} onClick={() => setTemplate({...template, qrsPerLabel: num})}
                              className={`py-4 rounded-xl border-2 font-black text-sm transition-all ${template.qrsPerLabel === num ? 'bg-blue-600 border-blue-400 text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-600'}`}>
                               {num}
                             </button>
                           ))}
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-zinc-500 uppercase">Texto Empresa</label>
                           <input type="text" value={template.headerText} onChange={e=>setTemplate({...template, headerText: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl outline-none focus:border-blue-500" />
                        </div>
                        <div className="space-y-4">
                           <label className="text-[10px] font-black text-zinc-500 uppercase">Logo Marbete</label>
                           <button onClick={() => fileInputRef.current?.click()} className="w-full h-24 bg-zinc-950 border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-2 text-[10px] font-black text-zinc-600 uppercase hover:border-blue-500/50">
                             <ImagePlus size={20} /> Cambiar Logo
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
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="sticky top-10 flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6 px-4">
                <span className="text-[11px] font-black text-zinc-600 uppercase tracking-widest">Vista Previa Marbete</span>
                <div className="flex gap-2">
                   <button onClick={handleQuickJpeg} className="text-zinc-700 hover:text-emerald-500 p-2.5 transition-all" title="Descargar JPG Actual"><Download size={22} /></button>
                   <button onClick={()=>setIsFullscreen(true)} className="text-zinc-700 hover:text-white p-2.5 transition-all"><Maximize2 size={22} /></button>
                </div>
              </div>

              <div 
                ref={virtualLabelRef} 
                className={`shadow-[0_40px_100px_rgba(0,0,0,0.6)] bg-white rounded-sm overflow-hidden border border-zinc-200 transition-all duration-500`}
                style={{
                  width: template.paperSize === 'LETTER' ? '380px' : '320px',
                  height: template.paperSize === 'LETTER' ? '520px' : (template.paperSize === 'LABEL' ? '496px' : '992px')
                }}
              >
                <PrintableLabel product={{...inventory, id: 'preview'} as ProductRecord} template={template} isMiniMode={template.paperSize === 'LABEL' || template.paperSize === 'LABEL2'} />
              </div>
              <p className="mt-6 text-[10px] text-zinc-700 font-black uppercase text-center italic tracking-widest opacity-60">
                {template.paperSize === 'LABEL2' ? 'SALIDA: JPG 10X31CM (12 PRODUCTOS POR HOJA)' : (template.paperSize === 'LABEL' ? 'SALIDA: JPG 10X15.5CM (6 PRODUCTOS POR HOJA)' : 'SALIDA: HOJA CARTA (4 PRODUCTOS POR HOJA)')}
              </p>
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && !showPreview && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-zinc-900/95 border border-blue-500/30 px-10 py-6 rounded-[2.5rem] shadow-[0_30px_100px_rgba(0,0,0,1)] flex items-center gap-12 backdrop-blur-2xl animate-in slide-in-from-bottom-20 duration-500">
            <div className="flex items-center gap-6 border-r border-zinc-800 pr-12">
               <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center">
                  <Layers className="text-blue-500" size={28} />
               </div>
               <div>
                  <span className="text-white font-black text-lg uppercase tracking-tight">{selectedIds.size} SELECCIONADOS</span>
               </div>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setPreviewPage(0); setShowPreview(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest flex items-center gap-4 transition-all">
                <Printer size={20} /> PREVISUALIZAR
              </button>
              <button onClick={()=>setSelectedIds(new Set())} className="p-5 bg-zinc-800 text-zinc-500 hover:text-white rounded-2xl transition-all"><X size={20}/></button>
            </div>
          </div>
        )}

        {isFullscreen && (
          <div className="fixed inset-0 z-[600] bg-black/98 flex items-center justify-center p-10 animate-in zoom-in-95 duration-300">
             <button onClick={()=>setIsFullscreen(false)} className="absolute top-10 right-10 p-6 text-white hover:bg-white/10 rounded-full transition-colors"><X size={48}/></button>
             <div className="bg-white p-24 rounded-[4rem] shadow-2xl flex flex-col items-center gap-12">
                <div className="p-6 bg-white border-[20px] border-white shadow-inner">
                  {/* Vista previa full screen con todos los campos incluyendo subinventario */}
                  <QRRenderer value={`${inventory.sku}${template.qrSeparator}${inventory.localizador}${template.qrSeparator}${inventory.pieces}${template.qrSeparator}${inventory.description}${template.qrSeparator}${inventory.subinventario}`} size={550} />
                </div>
                <p className="text-6xl font-black uppercase tracking-tighter text-black">{inventory.sku || 'N/A'}</p>
             </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan { 0%, 100% { top: 10%; } 50% { top: 90%; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #09090b; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; border: 1px solid #3f3f46; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3b82f6; }
        .preview-sheet-scaler { transform-origin: center center; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        @page { size: auto; margin: 0; }
        @media print {
          body { background: white !important; }
          #root { display: none !important; }
          #print-area { display: block !important; position: static !important; }
          .print-page { page-break-after: always; margin: 0; border: none; }
        }
      `}</style>
    </div>
  );
};

export default App;
