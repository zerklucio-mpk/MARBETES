
import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { createClient } from '@supabase/supabase-js';
import { 
  QrCode as QrCodeIcon, 
  ClipboardList, 
  Database, 
  Search, 
  Trash2, 
  UploadCloud, 
  Plus, 
  CheckSquare, 
  Square, 
  Download, 
  Loader2, 
  ImagePlus, 
  Palette, 
  Info, 
  FileSpreadsheet,
  AlertTriangle,
  X,
  CheckCircle2
} from 'lucide-react';
import { 
  InventoryData,
  TemplateConfig,
  ProductRecord
} from './types';

// --- CONFIGURACIÓN SUPABASE ---
const SUPABASE_URL = 'https://pbtsimirbnvnghlqszgn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidHNpbWlyYm52bmdobHFzemduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDc3MTUsImV4cCI6MjA4MzI4MzcxNX0.PcYb2opgRzfl8iIllfi3uCX2cA38uhvsURLnXl1NvYM';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- UTILIDADES ---
const parseCSVLine = (text: string, delimiter: string) => {
  const result: string[] = [];
  let currentField = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') { currentField += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) { result.push(currentField.trim()); currentField = ''; }
    else { currentField += char; }
  }
  result.push(currentField.trim());
  return result;
};

// --- COMPONENTES ---

const QRRenderer = memo(({ value, size }: { value: string; size: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 1, 
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      }, (error) => { if (error) console.error("Error QR", error); });
    }
  }, [value, size]);
  return <canvas ref={canvasRef} className="max-w-full h-auto" />;
});

const PrintableLabel = memo(({ product, template }: { product: ProductRecord | null; template: TemplateConfig }) => {
  if (!product) return <div className="w-full h-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-[8px] text-zinc-300 font-black uppercase">Espacio Vacío</div>;

  const qrValue = `${product.sku}${template.qrSeparator}${product.pieces}${template.qrSeparator}${product.description}${template.qrSeparator}${product.subinventario || ''}`;

  const descriptionFontSize = useMemo(() => {
    const len = product.description?.length || 0;
    if (len > 45) return 'text-[6px] leading-[1.1]';
    if (len > 25) return 'text-[7.5px] leading-tight';
    return 'text-[9px] font-bold uppercase overflow-hidden line-clamp-2';
  }, [product.description]);

  return (
    <div className="bg-white text-black flex flex-col h-full w-full font-sans box-border select-none border border-zinc-200 overflow-hidden">
      <div className="bg-black text-white px-3 py-1.5 flex items-center gap-2 shrink-0 h-[45px]">
        {template.logoUrl ? (
          <img src={template.logoUrl} className="h-6 w-auto object-contain" alt="Logo" />
        ) : (
          <div className="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center font-black text-[9px]">CV</div>
        )}
        <div className="flex flex-col">
          <h2 className="text-base font-black leading-none tracking-tighter uppercase">{template.headerText}</h2>
          <p className="text-[5px] font-bold uppercase tracking-[0.2em] opacity-80 mt-0.5">MARBETE DE CONTROL</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-2 overflow-hidden">
        <div className="flex justify-between items-end mb-0.5">
          <div className="min-w-0 flex-1">
            <p className="text-[5px] font-black text-zinc-400 uppercase tracking-tight">ID / SKU</p>
            <p className="text-base font-bold leading-none uppercase truncate tracking-tight">{product.sku || '---'}</p>
          </div>
          <div className="text-right ml-2 shrink-0">
            <p className="text-[5px] font-black text-zinc-400 uppercase tracking-tight">CANTIDAD</p>
            <p className="text-xl font-black leading-none">{product.pieces || 0}</p>
          </div>
        </div>
        <div className="h-[1.5px] bg-black w-full mb-3"></div>
        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden py-1">
          <QRRenderer value={qrValue} size={template.qrSize || 100} />
        </div>
        
        <div className="mt-1 border-t border-zinc-100 pt-1 min-h-[24px] flex flex-col justify-start">
          <p className="text-[5px] font-black text-zinc-400 uppercase tracking-tight leading-none mb-0.5">DESCRIPCIÓN DEL ARTÍCULO</p>
          <p className={`${descriptionFontSize} font-bold uppercase overflow-hidden line-clamp-2`}>
            {product.description || 'N/A'}
          </p>
        </div>

        <div className="mt-1.5 mb-1.5 border border-zinc-300 rounded-lg p-2 flex items-center bg-zinc-50/30">
          <div className="flex-1 min-w-0">
            <p className="text-[5px] font-black text-zinc-400 uppercase leading-none mb-0.5">SUBINVENTARIO</p>
            <p className="text-[10px] font-black uppercase truncate leading-tight text-black">{product.subinventario || '---'}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

const LabelSheet = memo(({ products, template }: { products: ProductRecord[]; template: TemplateConfig }) => {
  if (template.qrsPerLabel === 4) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 w-full h-full gap-0 bg-white">
        <PrintableLabel product={products[0] || null} template={template} />
        <PrintableLabel product={products[1] || null} template={template} />
        <PrintableLabel product={products[2] || null} template={template} />
        <PrintableLabel product={products[3] || null} template={template} />
      </div>
    );
  }
  return (
    <div className="w-full h-full bg-white">
      <PrintableLabel product={products[0] || null} template={template} />
    </div>
  );
});

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'content' | 'database' | 'design'>('content');
  const [exportProgress, setExportProgress] = useState<{current: number, total: number} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'syncing'>('connected');
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inventory, setInventory] = useState<InventoryData>({ sku: '', description: '', pieces: 0, subinventario: '' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  
  const sheetRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [template, setTemplate] = useState<TemplateConfig>({
    headerText: 'CVDIRECTO', headerBg: '#000000', headerTextColor: '#ffffff', accentColor: '#3b82f6',
    barcodeWidth: 160, barcodeHeight: 160, qrSize: 100, showDate: true, borderWidth: 4,
    borderStyle: 'solid', fontFamily: 'font-sans', logoUrl: undefined, qrFormat: 'PIPE',
    barcodeMode: 'STRUCTURED', qrSeparator: '_', paperSize: 'LETTER', qrsPerLabel: 4 
  });

  const fetchProducts = useCallback(async () => {
    setDbStatus('syncing');
    try {
      const { data, error } = await supabase.from('inventory').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProducts((data || []).map(i => ({ ...i, id: String(i.id) })));
      setDbStatus('connected');
    } catch (err: any) { setDbStatus('error'); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const currentPreviewProducts = useMemo(() => {
    if (selectedIds.size > 0) {
      return products.filter(p => selectedIds.has(p.id)).slice(0, 4);
    }
    return [{ ...inventory, id: 'preview' } as ProductRecord];
  }, [selectedIds, products, inventory]);

  const handleAddProduct = async () => {
    if (!inventory.sku) return;
    setDbStatus('syncing');
    try {
      const { data, error } = await supabase.from('inventory').insert([{
        sku: inventory.sku.toUpperCase(), description: inventory.description.toUpperCase(),
        pieces: inventory.pieces, subinventario: inventory.subinventario.toUpperCase()
      }]).select();
      if (error) throw error;
      if (data) setProducts(prev => [{ ...data[0], id: String(data[0].id) }, ...prev]);
      setInventory({ sku: '', description: '', pieces: 0, subinventario: '' });
      setDbStatus('connected');
    } catch (err: any) { setDbStatus('error'); }
  };

  const handleClearDatabase = async () => {
    setShowClearConfirm(false);
    setDbStatus('syncing');
    try {
      const { error } = await supabase.from('inventory').delete().not('id', 'is', null);
      if (error) {
        alert(`Error al vaciar nube: ${error.message}`);
        throw error;
      }
      setProducts([]);
      setSelectedIds(new Set());
      setDbStatus('connected');
    } catch (err: any) { 
      setDbStatus('error');
      console.error("Error completo de Supabase:", err);
    }
  };

  const handleDeleteSelected = async () => {
    setShowDeleteSelectedConfirm(false);
    if (selectedIds.size === 0) return;
    setDbStatus('syncing');
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase.from('inventory').delete().in('id', ids);
      if (error) throw error;
      setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setDbStatus('connected');
    } catch (err: any) { setDbStatus('error'); }
  };

  const downloadCSVTemplate = () => {
    const headers = "SKU,PIEZAS,DESCRIPTION,SUBINVENTARIO\n";
    const sampleData = "0-91037-30236-6,3,STICK VAC PRESTO 2 EN 1,LINEA";
    const blob = new Blob([headers + sampleData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "plantilla_marbetes.csv";
    link.click();
  };

  const [batchProducts, setBatchProducts] = useState<ProductRecord[]>([]);

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return;
    const selectedItems = products.filter(p => selectedIds.has(p.id));
    const chunkSize = template.qrsPerLabel;
    const totalSheets = Math.ceil(selectedItems.length / chunkSize);
    
    setExportProgress({ current: 0, total: totalSheets });

    for (let i = 0; i < selectedItems.length; i += chunkSize) {
      const chunk = selectedItems.slice(i, i + chunkSize);
      setBatchProducts(chunk);
      setExportProgress({ current: Math.floor(i / chunkSize) + 1, total: totalSheets });
      await new Promise(r => setTimeout(r, 600)); 

      if (sheetRef.current) {
        try {
          const dataUrl = await toJpeg(sheetRef.current, { quality: 1, pixelRatio: 3 });
          const link = document.createElement('a');
          link.download = `HOJA_MARBETES_${Math.floor(i / chunkSize) + 1}.jpg`;
          link.href = dataUrl;
          link.click();
        } catch (err) { console.error("Error exportando", err); }
      }
    }
    setBatchProducts([]);
    setExportProgress(null);
  };

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const s = searchTerm.toLowerCase();
    return products.filter(p => p.sku.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
  }, [products, searchTerm]);

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col">
      {/* INPUT CSV GLOBAL */}
      <input 
        ref={csvInputRef} 
        type="file" 
        accept=".csv" 
        className="hidden" 
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) {
            setDbStatus('syncing');
            const reader = new FileReader();
            reader.onload = async (ev) => {
              try {
                const content = ev.target?.result as string;
                const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
                if (lines.length < 2) {
                  alert("El archivo está vacío o no tiene el formato correcto.");
                  setDbStatus('connected');
                  return;
                }
                const news = [];
                for (let i = 1; i < lines.length; i++) {
                  const cols = parseCSVLine(lines[i], ',');
                  if (cols.length >= 3) {
                    news.push({ 
                      sku: cols[0].toUpperCase(), 
                      pieces: parseInt(cols[1]) || 0, 
                      description: cols[2].toUpperCase(), 
                      subinventario: (cols[3] || '').toUpperCase() 
                    });
                  }
                }
                
                if (news.length === 0) {
                  alert("No se encontraron registros válidos en el CSV.");
                } else {
                  const { error } = await supabase.from('inventory').insert(news);
                  if (error) throw error;
                  alert(`¡Éxito! Se importaron ${news.length} registros.`);
                  fetchProducts();
                }
              } catch (err: any) {
                alert(`Error al importar: ${err.message || 'Verifica el formato del archivo'}`);
                setDbStatus('error');
              } finally {
                if (csvInputRef.current) csvInputRef.current.value = '';
              }
            };
            reader.readAsText(file);
          }
        }} 
      />

      {/* MODAL DE CONFIRMACIÓN DE BORRADO TOTAL */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowClearConfirm(false)}></div>
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h2 className="text-2xl font-black text-white text-center uppercase tracking-tighter mb-4">¿Vaciar Toda la Nube?</h2>
            <p className="text-zinc-400 text-center font-bold text-sm leading-relaxed mb-8">
              Esta acción es <span className="text-red-500">irreversible</span>. Se eliminarán permanentemente todos los registros almacenados en el inventario de la nube.
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleClearDatabase}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl"
              >
                ELIMINAR TODO EL REGISTRO
              </button>
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                CANCELAR
              </button>
            </div>
            <button 
              onClick={() => setShowClearConfirm(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE BORRADO SELECCIONADO */}
      {showDeleteSelectedConfirm && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowDeleteSelectedConfirm(false)}></div>
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 mx-auto">
              <Trash2 className="text-red-500" size={32} />
            </div>
            <h2 className="text-2xl font-black text-white text-center uppercase tracking-tighter mb-4">Borrar Marcados</h2>
            <p className="text-zinc-400 text-center font-bold text-sm leading-relaxed mb-8">
              Estás a punto de eliminar <span className="text-white font-black">{selectedIds.size} elementos</span> seleccionados de la nube. ¿Deseas continuar?
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDeleteSelected}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl"
              >
                ELIMINAR SELECCIONADOS
              </button>
              <button 
                onClick={() => setShowDeleteSelectedConfirm(false)}
                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                CANCELAR
              </button>
            </div>
            <button 
              onClick={() => setShowDeleteSelectedConfirm(false)}
              className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>
      )}

      {exportProgress && (
        <div className="fixed inset-0 z-[600] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="text-blue-500 animate-spin mb-8" size={64} />
          <h2 className="text-4xl font-black uppercase mb-2">Generando Hojas</h2>
          <p className="text-zinc-500 font-bold">Hoja {exportProgress.current} de {exportProgress.total}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center p-6 md:p-12 lg:p-16 max-w-[1700px] mx-auto w-full gap-8">
        <header className="w-full flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl rotate-3 transition-transform hover:rotate-0 cursor-pointer">
              <QrCodeIcon className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter">CV <span className="text-blue-600">DIRECTO</span></h1>
              <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">CONTROL DE INVENTARIO INDUSTRIAL</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {dbStatus === 'syncing' && <span className="text-[8px] font-black text-blue-500 uppercase animate-pulse">Sincronizando...</span>}
            {dbStatus === 'connected' && <CheckCircle2 className="text-emerald-500" size={16}/>}
          </div>
        </header>

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 flex flex-col gap-6">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-[2.5rem] overflow-hidden backdrop-blur-xl shadow-2xl flex flex-col min-h-[680px]">
              <nav className="flex bg-black/40 border-b border-zinc-800/60 p-3 gap-2">
                {[
                  { id: 'content', label: 'Captura', icon: ClipboardList },
                  { id: 'database', label: 'Nube', icon: Database },
                  { id: 'design', label: 'Estilo', icon: Palette },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-3 px-6 py-4 text-[10px] font-black uppercase rounded-2xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl' : 'text-zinc-500 hover:bg-white/5'}`}>
                    <tab.icon size={16} /> <span>{tab.label}</span>
                  </button>
                ))}
              </nav>

              <div className="p-8 flex-1 overflow-y-auto">
                {activeTab === 'content' && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase">SKU</label>
                        <input type="text" value={inventory.sku} onChange={e => setInventory({...inventory, sku: e.target.value.toUpperCase()})}
                          className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-xl font-mono text-xl outline-none focus:border-blue-500 transition-colors" placeholder="SKU" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-zinc-500 uppercase">Cantidad</label>
                        <input type="number" value={inventory.pieces} onChange={e => setInventory({...inventory, pieces: parseInt(e.target.value) || 0})}
                          className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-xl text-xl font-black outline-none focus:border-blue-500 transition-colors" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase">Descripción</label>
                      <input type="text" value={inventory.description} onChange={e => setInventory({...inventory, description: e.target.value.toUpperCase()})}
                        className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-xl text-lg font-black outline-none focus:border-blue-500 transition-colors" placeholder="Descripción" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-zinc-500 uppercase">Subinventario</label>
                      <input type="text" value={inventory.subinventario} onChange={e => setInventory({...inventory, subinventario: e.target.value.toUpperCase()})}
                        className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-xl text-lg font-bold outline-none focus:border-blue-500 transition-colors" placeholder="Subinventario" />
                    </div>
                    <button onClick={handleAddProduct} disabled={!inventory.sku || dbStatus === 'syncing'} 
                      className="w-full py-6 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white shadow-xl transition-all active:scale-95">
                      {dbStatus === 'syncing' ? <Loader2 className="animate-spin" size={24}/> : <Plus size={24} />} Guardar en Nube
                    </button>
                  </div>
                )}

                {activeTab === 'database' && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
                        <input type="text" placeholder="BUSCAR SKU..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-5 pl-14 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500 transition-colors" />
                      </div>
                      <button onClick={downloadCSVTemplate} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 hover:text-blue-500 hover:border-blue-500 transition-all" title="Descargar Plantilla CSV">
                        <FileSpreadsheet size={18}/>
                      </button>
                      <button onClick={() => csvInputRef.current?.click()} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 hover:text-blue-500 hover:border-blue-500 transition-all" title="Importar CSV">
                        <UploadCloud size={18}/>
                      </button>
                      <button onClick={() => setShowClearConfirm(true)} className="p-5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 hover:text-red-500 hover:border-red-500 transition-all" title="Vaciar Toda la Nube">
                        <Trash2 size={18}/>
                      </button>
                    </div>

                    <div className={`p-5 rounded-xl flex items-center justify-between transition-all ${selectedIds.size > 0 ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-950/40 text-zinc-600 border border-zinc-800/40'}`}>
                      <div className="flex items-center gap-3">
                        <button onClick={() => {
                          if (selectedIds.size === filteredProducts.length) setSelectedIds(new Set());
                          else setSelectedIds(new Set(filteredProducts.map(p => p.id)));
                        }}>
                          {selectedIds.size === filteredProducts.length && filteredProducts.length > 0 ? <CheckSquare size={18}/> : <Square size={18}/>}
                        </button>
                        <p className="text-[9px] font-black uppercase tracking-widest">{selectedIds.size} Marcados</p>
                      </div>
                      {selectedIds.size > 0 && (
                        <div className="flex gap-2">
                          <button onClick={() => setShowDeleteSelectedConfirm(true)} className="p-2 bg-red-500 hover:bg-red-400 rounded-lg text-white transition-colors flex items-center justify-center active:scale-95" title="Eliminar Seleccionados">
                            <Trash2 size={16} />
                          </button>
                          <button onClick={handleBatchDownload} className="px-5 py-2.5 bg-white text-blue-600 rounded-lg text-[9px] font-black uppercase flex items-center gap-2 hover:bg-zinc-100 transition-colors active:scale-95">
                             <Download size={14} /> Descargar Lote
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {filteredProducts.length === 0 ? (
                        <div className="py-20 text-center flex flex-col items-center gap-4 text-zinc-700">
                           <Database size={48} opacity={0.2} />
                           <p className="text-[10px] font-black uppercase">Sin registros en la nube</p>
                        </div>
                      ) : (
                        filteredProducts.map(prod => (
                          <div key={prod.id} 
                            onClick={() => {
                              const n = new Set(selectedIds);
                              if (n.has(prod.id)) n.delete(prod.id); else n.add(prod.id);
                              setSelectedIds(n);
                            }}
                            className={`p-4 rounded-xl flex items-center gap-4 cursor-pointer border transition-all ${selectedIds.has(prod.id) ? 'bg-blue-600/10 border-blue-600' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}>
                            {selectedIds.has(prod.id) ? <CheckSquare className="text-blue-500" size={20}/> : <Square className="text-zinc-700" size={20}/>}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black uppercase truncate tracking-tight">{prod.sku}</p>
                              <p className="text-[9px] text-zinc-500 uppercase truncate">{prod.description}</p>
                            </div>
                            <button 
                              onClick={async (e) => { 
                                e.stopPropagation(); 
                                if(window.confirm(`¿Eliminar el registro ${prod.sku} permanentemente de la nube?`)) { 
                                  await supabase.from('inventory').delete().eq('id', prod.id); 
                                  fetchProducts(); 
                                } 
                              }} 
                              className="text-zinc-800 hover:text-red-500 transition-colors p-2"
                              title="Eliminar este registro"
                            >
                               <Trash2 size={18} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'design' && (
                  <div className="space-y-8 animate-in fade-in">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Formato de Hoja</label>
                      <div className="grid grid-cols-2 gap-4">
                         {[1, 4].map(num => (
                           <button key={num} onClick={() => setTemplate({...template, qrsPerLabel: num})}
                            className={`py-6 rounded-2xl border-2 font-black text-[10px] uppercase flex flex-col items-center gap-3 transition-all ${template.qrsPerLabel === num ? 'bg-blue-600 border-blue-400 text-white shadow-xl' : 'bg-zinc-950 border-zinc-800 text-zinc-600 hover:bg-white/5'}`}>
                             {num === 1 ? '1 QR por Hoja' : '4 QRs (Agrupados)'}
                           </button>
                         ))}
                      </div>
                    </div>
                    <div className="space-y-6">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                         <span>Tamaño del QR</span>
                         <span className="text-blue-500">{template.qrSize}px</span>
                       </label>
                       <input type="range" min="60" max="140" value={template.qrSize} onChange={e => setTemplate({...template, qrSize: parseInt(e.target.value)})}
                         className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                    
                    <div className="space-y-4">
                       <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Personalización</label>
                       <input type="text" value={template.headerText} onChange={e=>setTemplate({...template, headerText: e.target.value.toUpperCase()})} className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-xl outline-none text-sm font-bold focus:border-blue-500 transition-colors" placeholder="Nombre Empresa" />
                       <button onClick={() => fileInputRef.current?.click()} className="w-full h-20 bg-zinc-950 border-2 border-dashed border-zinc-800 rounded-xl flex items-center justify-center gap-3 text-[9px] font-black text-zinc-600 uppercase hover:border-blue-500 hover:text-blue-500 transition-all">
                         <ImagePlus size={18} /> {template.logoUrl ? 'Cambiar Logo' : 'Subir Logo Corporativo'}
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
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col items-center">
            <h3 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-4 flex items-center gap-2 self-start">
              <Info size={14}/> Vista Previa de Hoja {template.qrsPerLabel === 4 ? '(2x2)' : '(1x1)'}
            </h3>

            <div className="industrial-border p-6 rounded-[2.5rem] shadow-2xl bg-zinc-950/20">
              <div 
                ref={sheetRef} 
                className="bg-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden" 
                style={{ width: '400px', height: '540px' }}
              >
                <LabelSheet 
                  products={batchProducts.length > 0 ? batchProducts : currentPreviewProducts} 
                  template={template} 
                />
              </div>
            </div>

            <p className="mt-4 text-[9px] text-zinc-600 uppercase font-black text-center max-w-[300px]">
              {selectedIds.size > 0 
                ? `Mostrando ${Math.min(selectedIds.size, 4)} de ${selectedIds.size} seleccionados.`
                : 'Previsualización de captura actual.'}
            </p>

            <button 
              onClick={handleBatchDownload}
              disabled={selectedIds.size === 0}
              className="mt-8 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white px-10 py-4 rounded-xl font-black text-[10px] uppercase flex items-center gap-3 transition-all shadow-xl active:scale-95"
            >
              <Download size={20} /> Descargar Lote Seleccionado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
