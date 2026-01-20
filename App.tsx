
/**
 * =========================================================================
 * CODIGO SQL PARA GENERAR LAS TABLAS EN SUPABASE
 * =========================================================================
 * 
 * -- 1. Tabla de Inventario
 * CREATE TABLE IF NOT EXISTS inventory (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   sku TEXT NOT NULL,
 *   description TEXT,
 *   localizador TEXT NOT NULL,
 *   pieces INTEGER DEFAULT 0,
 *   subinventario TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- 2. Tabla de Layout
 * CREATE TABLE IF NOT EXISTS warehouse_layout (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   localizador TEXT NOT NULL UNIQUE,
 *   zone TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import QRCode from 'qrcode';
import { toJpeg } from 'html-to-image';
import { createClient } from '@supabase/supabase-js';
import { 
  QrCode as QrCodeIcon, 
  Printer, 
  Palette, 
  X,
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
  Download,
  Loader2,
  FileText,
  Tag,
  LayoutGrid,
  Trash,
  Layers,
  ArrowLeft,
  ArrowRight,
  Minus,
  AlertTriangle,
  Info
} from 'lucide-react';
import { 
  InventoryData,
  TemplateConfig,
  ProductRecord
} from './types';

const SUPABASE_URL = 'https://pbtsimirbnvnghlqszgn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBidHNpbWlyYm52bmdobHFzemduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDc3MTUsImV4cCI6MjA4MzI4MzcxNX0.PcYb2opgRzfl8iIllfi3uCX2cA38uhvsURLnXl1NvYM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ZONES = ['TODOS', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

// ORIENTACIÓN DE RACKS SEGÚN ESPECIFICACIÓN DEL USUARIO
const RACK_ORIENTATION: Record<string, 'FRENTE' | 'FONDO'> = {
  'A': 'FONDO', 'B': 'FRENTE',
  'C': 'FRENTE', 'D': 'FONDO',
  'E': 'FONDO', 'F': 'FRENTE',
  'G': 'FRENTE', 'H': 'FONDO',
  'I': 'FONDO', 'J': 'FRENTE',
  'K': 'FRENTE', 'L': 'FONDO'
};

// MAPEO DE PAREJAS DE RACKS (PASILLOS)
const RACK_PAIRS: Record<string, string> = {
  'A': 'AB', 'B': 'AB', 'C': 'CD', 'D': 'CD', 'E': 'EF', 'F': 'EF',
  'G': 'GH', 'H': 'GH', 'I': 'IJ', 'J': 'IJ', 'K': 'KL', 'L': 'KL'
};
const LEFT_RACKS = new Set(['A', 'C', 'E', 'G', 'I', 'K']); 
const RIGHT_RACKS = new Set(['B', 'D', 'F', 'H', 'J', 'L']);

const PASILLO_MAP: Record<string, [string, string]> = {
  'AB': ['A', 'B'], 'CD': ['C', 'D'], 'EF': ['E', 'F'],
  'GH': ['G', 'H'], 'IJ': ['I', 'J'], 'KL': ['K', 'L']
};

/**
 * UTILIDAD DE ORDENAMIENTO LOGÍSTICO (RACK-COL-LVL)
 */
const compareLocators = (a: string, b: string) => {
  const parse = (loc: string) => {
    const parts = (loc || '').toUpperCase().split('-');
    return {
      rack: parts[0] || 'Z',
      col: parseInt(parts[1]) || 0,
      lvl: parseInt(parts[2]) || 0
    };
  };
  const la = parse(a), lb = parse(b);
  if (la.rack !== lb.rack) return la.rack.localeCompare(lb.rack);
  if (la.col !== lb.col) return la.col - lb.col;
  return la.lvl - lb.lvl;
};

const QRRenderer = memo(({ value, size }: { value: string; size: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size, margin: 1, color: { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel: 'M'
      }, (error) => { if (error && active) console.error("Error QR:", error); });
    }
    return () => { active = false; };
  }, [value, size]);
  return <canvas ref={canvasRef} className="max-w-full h-auto" />;
});

const PrintableLabel = memo(({ product, template, isMiniMode = false }: any) => {
  const isEmptyLoc = product.sku === 'UBICACIÓN VACÍA';
  const isPickingLoc = product.sku === 'PICKING';
  const isSpecial = isEmptyLoc || isPickingLoc;
  
  const rackId = useMemo(() => (product.localizador || '').split('-')[0], [product.localizador]);
  const orientation = useMemo(() => RACK_ORIENTATION[rackId] || 'N/A', [rackId]);
  
  const isPickeoZone = useMemo(() => product.localizador?.toString().trim().endsWith('1'), [product.localizador]);
  
  const qrValue = useMemo(() => {
    if (isEmptyLoc) return "EMPTY_LOCATION";
    if (isPickingLoc) return "PICKING_LOCATION";
    const piecesData = isPickeoZone ? '0' : product.pieces;
    return `${product.sku || '---'}_${piecesData}_${product.description || 'N/A'}_${product.subinventario || 'N/A'}_${product.localizador || '---'}`;
  }, [product, isPickeoZone, isEmptyLoc, isPickingLoc]);

  const displayQrSize = isMiniMode ? 105 : template.qrSize;

  if (isMiniMode) {
    return (
      <div className={`bg-white text-black flex flex-col h-full w-full overflow-hidden font-sans border box-border ${isSpecial ? 'border-zinc-200' : 'border-zinc-300'}`}>
        <div className={`${isPickingLoc ? 'bg-orange-600' : (isEmptyLoc ? 'bg-zinc-400' : 'bg-black')} text-white px-2 flex items-center justify-between shrink-0 h-[18px]`}>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-600 rounded-full flex items-center justify-center font-black text-[5px]">CV</div>
            <h2 className="text-[8px] font-black leading-none uppercase tracking-tighter">{template.headerText}</h2>
          </div>
          <span className="text-[5px] font-black opacity-70 uppercase tracking-tight">{product.subinventario || (isSpecial ? 'ZONA ESPECIAL' : 'CTL')}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-between p-1 overflow-hidden">
          <div className="w-full text-center shrink-0">
             <span className="text-[4px] font-bold text-zinc-400 uppercase leading-none block tracking-tighter">{isSpecial ? 'TIPO DE ÁREA' : 'ARTÍCULO / SKU'}</span>
             <p className={`text-[11px] font-black leading-none uppercase truncate tracking-tight ${isPickingLoc ? 'text-orange-600' : (isEmptyLoc ? 'text-zinc-400' : 'text-black')}`}>{product.sku}</p>
          </div>
          
          <div className="flex-1 flex items-center justify-center w-full min-h-0 py-0.5">
            {isSpecial ? (
              <div className={`flex flex-col items-center justify-start pt-1 gap-0.5 w-full h-full`}>
                <div className={`px-2 py-0.5 rounded border border-black w-[85%] text-center ${orientation === 'FRENTE' ? 'bg-emerald-50' : 'bg-purple-50'}`}>
                  <span className={`text-[10px] font-black uppercase tracking-tight ${orientation === 'FRENTE' ? 'text-emerald-800' : 'text-purple-800'}`}>
                    {orientation}
                  </span>
                </div>
                {template.arrowDirection !== 'NONE' && (
                  <div className="flex items-center justify-center text-black">
                    {template.arrowDirection === 'LEFT' ? <ArrowLeft size={template.arrowSize * 0.375} strokeWidth={3} /> : <ArrowRight size={template.arrowSize * 0.375} strokeWidth={3} />}
                  </div>
                )}
                <div className="opacity-10 flex flex-col items-center mt-auto pb-1">
                  {isPickingLoc ? <Scan size={10} className="text-orange-950" /> : <Layers size={10} className="text-zinc-950" />}
                </div>
              </div>
            ) : (
              <QRRenderer value={qrValue} size={displayQrSize} />
            )}
          </div>

          <div className="w-full shrink-0 border-t border-zinc-200 pt-1 pb-1 px-1">
            <div className="flex justify-between items-baseline">
              <p className={`text-[8px] font-black leading-none uppercase tracking-tight truncate flex-1 mr-1 ${isPickingLoc ? 'text-orange-700' : (isEmptyLoc ? 'text-zinc-500' : 'text-blue-800')}`}>
                {product.localizador} 
                {!isSpecial && <span className="text-zinc-400 ml-1">[{product.subinventario || 'GNR'}]</span>}
              </p>
              {!isSpecial && <p className="text-[9px] font-black leading-none uppercase text-black shrink-0">{isPickeoZone ? '---' : product.pieces}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white text-black flex flex-col h-full w-full overflow-hidden font-sans box-border border border-zinc-300">
      <div className={`${isPickingLoc ? 'bg-orange-600' : 'bg-black'} text-white px-5 py-2 flex items-center gap-3 shrink-0 h-[60px]`}>
        <div className="w-9 h-9 bg-red-600 rounded-full flex items-center justify-center font-black text-xs">CV</div>
        <div className="flex flex-col min-w-0">
          <h2 className="text-xl font-black leading-none tracking-tighter truncate uppercase">{template.headerText}</h2>
          <p className="text-[7px] font-bold uppercase tracking-[0.2em] opacity-80 mt-0.5">MARBETE DE CONTROL</p>
        </div>
      </div>
      <div className="flex-1 flex flex-col px-6 py-3 overflow-hidden">
        <div className="flex justify-between items-end mb-1 shrink-0">
          <div className="min-w-0 flex flex-col">
            <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">{isSpecial ? 'SITUACIÓN' : 'ID / SKU'}</p>
            <p className={`text-2xl font-black leading-none uppercase truncate ${isPickingLoc ? 'text-orange-600' : (isEmptyLoc ? 'text-zinc-300' : 'text-black')}`}>{product.sku || '---'}</p>
          </div>
          {!isSpecial && (
            <div className="text-right shrink-0">
              <p className="text-[8px] font-black text-zinc-400 uppercase tracking-tight">CANTIDAD</p>
              <p className="text-3xl font-black leading-none">{isPickeoZone ? '---' : (product.pieces || 0)}</p>
            </div>
          )}
        </div>
        <div className={`h-[2px] w-full mb-3 ${isPickingLoc ? 'bg-orange-500' : 'bg-black'}`}></div>
        <div className="flex-1 min-h-0 flex items-center justify-center py-1">
          {isSpecial ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              {/* Leyenda PICKING/VACÍO posicionada más arriba */}
              <div className={`font-black text-6xl opacity-10 absolute top-[10%] select-none ${isPickingLoc ? 'text-orange-900' : 'text-zinc-900'}`}>
                {isPickingLoc ? 'PICKING' : 'VACÍO'}
              </div>
              {/* Banner de Orientación posicionado justo debajo */}
              <div className={`z-10 w-full py-5 border-y-4 border-black text-center flex flex-col items-center justify-center transform -translate-y-2 ${orientation === 'FRENTE' ? 'bg-emerald-50' : 'bg-purple-50'}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-1 ${orientation === 'FRENTE' ? 'text-emerald-900' : 'text-purple-900'}`}>ORIENTACIÓN LOGÍSTICA</p>
                <p className={`text-6xl font-black uppercase leading-tight ${orientation === 'FRENTE' ? 'text-emerald-700' : 'text-purple-700'}`}>{orientation}</p>
                
                {template.arrowDirection !== 'NONE' && (
                  <div className="mt-2 flex items-center justify-center text-black">
                    {template.arrowDirection === 'LEFT' ? <ArrowLeft size={template.arrowSize} strokeWidth={4} /> : <ArrowRight size={template.arrowSize} strokeWidth={4} />}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <QRRenderer value={qrValue} size={displayQrSize} />
          )}
        </div>
        <div className="h-[1px] bg-zinc-200 w-full my-2"></div>
        <p className="text-[12px] font-bold italic uppercase leading-none line-clamp-1 text-zinc-800 mb-2">
          {isPickingLoc ? 'ÁREA DE SURTIDO ACTIVO' : (isEmptyLoc ? 'SIN REGISTRO EN BASE DE DATOS' : (product.description || 'N/A'))}
        </p>
        <div className={`border rounded-lg p-3 mt-auto shrink-0 ${isPickingLoc ? 'bg-orange-50 border-orange-200' : 'bg-zinc-50 border-zinc-200'}`}>
          <p className={`text-2xl font-black uppercase leading-none ${isPickingLoc ? 'text-orange-900' : 'text-black'}`}>
            {product.localizador || '---'} 
            {!isSpecial && <span className="text-xs text-zinc-400 ml-2">[{product.subinventario || 'GENERAL'}]</span>}
          </p>
        </div>
      </div>
    </div>
  );
});

const CatalogItem = memo(({ prod, isSelected, onToggle, onSelect, onDelete }: any) => {
  const rack = (prod.localizador || '').split('-')[0];
  const orientation = RACK_ORIENTATION[rack] || '---';

  return (
    <div className={`group border-2 rounded-2xl p-4 flex items-center gap-4 transition-all cursor-pointer ${isSelected ? 'bg-blue-600/10 border-blue-600/50' : 'bg-zinc-950/40 border-zinc-800/40 hover:border-zinc-700'}`} onClick={() => onToggle(prod)}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-zinc-800 text-zinc-600'}`}>{isSelected ? <CheckSquare size={20} /> : <Square size={20} />}</div>
      <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onSelect(prod); }}>
        <p className={`text-sm font-black uppercase tracking-tight truncate ${isSelected ? 'text-blue-400' : 'text-zinc-100'}`}>{prod.sku}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase">{prod.localizador}</span>
          <span className="text-[8px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">{prod.pieces} UDS</span>
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${orientation === 'FRENTE' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-purple-900/30 text-purple-400'}`}>{orientation}</span>
        </div>
      </div>
      <button onClick={(e) => { e.stopPropagation(); onDelete(prod.id); }} className="p-2 text-zinc-800 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 rounded-lg"><Trash2 size={18} /></button>
    </div>
  );
});

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'content' | 'database' | 'design' | 'layout'>('content');
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUploadRules, setShowUploadRules] = useState(false);
  const [exportProgress, setExportProgress] = useState<{current: number, total: number} | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('TODOS');
  
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [selectedItems, setSelectedItems] = useState<Map<string, ProductRecord>>(new Map());
  const [inventory, setInventory] = useState<InventoryData>({ sku: '', description: '', localizador: '', pieces: 0, subinventario: '' });
  
  const [layoutItems, setLayoutItems] = useState<{id: string, localizador: string, zone: string}[]>([]);
  const [layoutFilterRack, setLayoutFilterRack] = useState<string>('TODOS');
  const [layoutFilterColumn, setLayoutFilterColumn] = useState<string>('TODOS');
  
  const [isFetching, setIsFetching] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const csvInputRef = useRef<HTMLInputElement>(null);

  const [template, setTemplate] = useState<TemplateConfig>({
    headerText: 'CVDIRECTO', headerBg: '#000000', headerTextColor: '#ffffff', accentColor: '#3b82f6',
    barcodeWidth: 160, barcodeHeight: 160, qrSize: 150, showDate: true, borderWidth: 4, borderStyle: 'solid',
    fontFamily: 'font-sans', logoUrl: undefined, qrFormat: 'PIPE', barcodeMode: 'STRUCTURED', qrSeparator: '_', paperSize: 'LABEL2',
    arrowDirection: 'NONE', arrowSize: 64
  });

  const fetchInventoryDataOnDemand = useCallback(async () => {
    setIsFetching(true);
    try {
      let query = supabase.from('inventory').select('*');
      if (searchTerm) query = query.ilike('sku', `%${searchTerm.toUpperCase()}%`);
      if (selectedZone !== 'TODOS') query = query.ilike('localizador', `${selectedZone}-%`);

      const { data, error } = await query.limit(500);
      if (!error && data) {
        const sorted = (data as ProductRecord[]).sort((a, b) => compareLocators(a.localizador, b.localizador));
        setProducts(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  }, [searchTerm, selectedZone]);

  const fetchLayoutDataOnDemand = useCallback(async () => {
    setIsFetching(true);
    try {
      let query = supabase.from('warehouse_layout').select('*');
      if (layoutFilterRack !== 'TODOS') query = query.ilike('localizador', `${layoutFilterRack}-%`);
      if (layoutFilterColumn !== 'TODOS') query = query.ilike('localizador', `%-${layoutFilterColumn}-%`);
      if (layoutFilterRack === 'TODOS' && layoutFilterColumn === 'TODOS') query = query.limit(200);

      const { data, error } = await query;
      if (!error && data) {
        const sorted = data.sort((a, b) => compareLocators(a.localizador, b.localizador));
        setLayoutItems(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetching(false);
    }
  }, [layoutFilterRack, layoutFilterColumn]);

  useEffect(() => { 
    const timer = setTimeout(() => { fetchInventoryDataOnDemand(); }, 400); 
    return () => clearTimeout(timer);
  }, [searchTerm, selectedZone, fetchInventoryDataOnDemand]);
  
  useEffect(() => { 
    if (activeTab === 'layout') fetchLayoutDataOnDemand(); 
  }, [activeTab, layoutFilterRack, layoutFilterColumn, fetchLayoutDataOnDemand]);

  const handleAddProduct = async () => {
    if (!inventory.sku) return;
    const { data, error } = await supabase.from('inventory').insert([{ ...inventory, sku: inventory.sku.toUpperCase(), localizador: inventory.localizador.toUpperCase() }]).select();
    if (!error && data) {
      fetchInventoryDataOnDemand();
      setInventory({ sku: '', description: '', localizador: '', pieces: 0, subinventario: '' });
      alert('Guardado.');
    }
  };

  /**
   * EXPORTACIÓN DE CSV RESPETANDO EL ORDEN: SKU, LOCALIZADOR, PIEZAS, DESCRIPTION, SUBINVENTARIO
   */
  const handleExportCSV = async () => {
    try {
      const { data, error } = await supabase.from('inventory').select('*');
      if (error || !data) throw error;

      // Orden solicitado por el usuario
      const csvHeaders = ['SKU', 'LOCALIZADOR', 'PIEZAS', 'DESCRIPTION', 'SUBINVENTARIO'];
      const dbFieldsMapping = ['sku', 'localizador', 'pieces', 'description', 'subinventario'];
      
      const csvContent = [
        csvHeaders.join(','),
        ...data.map((row: any) => dbFieldsMapping.map(field => `"${row[field] || ''}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `INVENTARIO_CVDIRECTO_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Error al exportar catálogo');
    }
  };

  /**
   * IMPORTACIÓN DE CSV BASADA EN EL ORDEN: SKU, LOCALIZADOR, PIEZAS, DESCRIPTION, SUBINVENTARIO
   * INCLUYE ALGORITMO DE VALIDACIÓN EXHAUSTIVA Y DETECCIÓN DE PATRONES (SIN IA)
   */
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const validationErrors: string[] = [];
      
      // Patrones de validación (ADN de los datos)
      const localizadorRegex = /^[A-L]-[0-9]+-[0-9]+$/i;
      const numericRegex = /^[0-9]+$/;

      // ALGORITMO: Ignorar líneas vacías o de cabecera mal formadas
      const dataLines = lines.slice(1).filter(l => l.replace(/,/g, '').trim() !== '');

      if (dataLines.length === 0) {
        alert("El archivo CSV no contiene datos.");
        return;
      }

      const toInsert = dataLines.map((line, index) => {
        // Separación por comas respetando comillas
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
        const rowNum = index + 2;

        const sku = (values[0] || '').toUpperCase();
        const loc = (values[1] || '').toUpperCase();
        const pcsStr = values[2] || "";
        const descRaw = values[3] || "";
        const sub = (values[4] || '').toUpperCase();

        // 1. VALIDACIÓN DE CAMPOS VACÍOS
        if (!sku) validationErrors.push(`Fila ${rowNum}: SKU vacío.`);
        if (!loc) validationErrors.push(`Fila ${rowNum}: LOCALIZADOR vacío.`);
        if (pcsStr === "") validationErrors.push(`Fila ${rowNum}: PIEZAS vacío.`);
        if (!descRaw) validationErrors.push(`Fila ${rowNum}: DESCRIPTION vacía.`);
        if (!sub) validationErrors.push(`Fila ${rowNum}: SUBINVENTARIO vacío.`);

        // 2. DETECCIÓN DE PATRONES Y COLUMNAS INTERCAMBIADAS
        // Detectar si el SKU parece un Localizador
        if (localizadorRegex.test(sku)) {
          validationErrors.push(`Fila ${rowNum}: El SKU '${sku}' parece un LOCALIZADOR. ¿Columnas intercambiadas?`);
        }
        
        // Detectar si el Localizador NO tiene el formato correcto
        if (loc && !localizadorRegex.test(loc)) {
          validationErrors.push(`Fila ${rowNum}: El LOCALIZADOR '${loc}' es inválido. Formato esperado: RACK-COL-LVL (ej: A-1-1).`);
        }

        // Detectar si Piezas no es numérico
        if (pcsStr && !numericRegex.test(pcsStr)) {
          validationErrors.push(`Fila ${rowNum}: Cantidad de PIEZAS '${pcsStr}' inválida. Debe ser solo números.`);
        }

        // 3. LIMPIEZA DE DATOS (DESCRIPTION)
        // Eliminar guiones bajos (_) y comillas dobles (")
        const descClean = descRaw.replace(/[_"]/g, '');
        
        return {
          sku: sku,
          localizador: loc,
          pieces: parseInt(pcsStr) || 0,
          description: descClean,
          subinventario: sub
        };
      });

      // BLOQUEO TOTAL SI HAY ERRORES
      if (validationErrors.length > 0) {
        const total = validationErrors.length;
        const examples = validationErrors.slice(0, 10).join('\n');
        
        // Usamos setTimeout para asegurar que el alert se dispare después de procesar
        setTimeout(() => {
          alert(`⚠️ ERROR CRÍTICO DE ESTRUCTURA Y PATRONES\n\nSe detectaron ${total} errores en el archivo. El proceso se detuvo por seguridad.\n\nERRORES DETECTADOS:\n${examples}\n\n${total > 10 ? '...y más.' : ''}\n\nREVISA:\n1. Orden: SKU, LOCALIZADOR, PIEZAS, DESCRIPTION, SUBINVENTARIO.\n2. Localizador: Letra-Número-Número.\n3. Piezas: Solo números.`);
        }, 100);

        if (csvInputRef.current) csvInputRef.current.value = '';
        return;
      }

      // INSERCIÓN SI TODO ES CORRECTO
      if (toInsert.length > 0) {
        setIsFetching(true);
        const { error } = await supabase.from('inventory').insert(toInsert);
        setIsFetching(false);
        if (error) {
          console.error(error);
          alert('Error técnico al subir a Supabase. Verifica tu conexión.');
        } else {
          alert(`✅ ÉXITO: ${toInsert.length} registros validados, limpiados y subidos correctamente.`);
          fetchInventoryDataOnDemand();
        }
      }
    };
    reader.readAsText(file);
    if (csvInputRef.current) csvInputRef.current.value = '';
  };

  /**
   * BORRAR TODA LA BASE DE DATOS
   */
  const handleDeleteAll = async () => {
    setIsFetching(true);
    const { error } = await supabase.from('inventory').delete().neq('sku', 'BORRADO_ABSURDO_QUERY');
    setIsFetching(false);
    setShowDeleteConfirm(false);
    if (error) alert('Error al vaciar base de datos');
    else {
      alert('Base de datos vaciada correctamente.');
      fetchInventoryDataOnDemand();
    }
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
        const dataUrl = await toJpeg(pages[i] as HTMLElement, { quality: 0.90, pixelRatio: 3, backgroundColor: '#ffffff', cacheBust: true });
        const link = document.createElement('a');
        link.download = `LOTE_PAG_${i + 1}.jpg`; link.href = dataUrl; link.click();
        await new Promise(r => setTimeout(r, 1000)); 
      }
      setSelectedItems(new Map()); setShowPreview(false); alert('Lote descargado exitosamente.');
    } catch (e) { alert('Error en la exportación.'); } finally { printArea.style.display = 'none'; setExportProgress(null); }
  };

  /**
   * LÓGICA DE ORGANIZACIÓN FRENTE Y FONDO CON RELLENO DE VACÍOS Y PICKING
   */
  const baseCapacity = template.paperSize === 'LETTER' ? 4 : (template.paperSize === 'LABEL' ? 6 : 12);
  const organizedPrintingData = useMemo(() => {
    const raw: ProductRecord[] = selectedItems.size > 0 ? Array.from(selectedItems.values()) : (inventory.sku ? [{ ...inventory, id: 'temp' } as ProductRecord] : []);
    
    if (template.paperSize !== 'LABEL2' || raw.length === 0) return raw;

    const groups: Record<string, ProductRecord[]> = {};
    
    raw.forEach(p => { 
      const parts = (p.localizador || '').split('-');
      const rack = parts[0] || 'Z';
      const col = parts[1] || '0';
      const aisle = RACK_PAIRS[rack] || rack;
      const key = `${aisle}-${col}`;
      if (!groups[key]) groups[key] = []; 
      groups[key].push(p); 
    });

    const pages: (ProductRecord | null)[] = [];
    
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const pa = a.split('-'), pb = b.split('-');
      if (pa[0] !== pb[0]) return pa[0].localeCompare(pb[0]);
      return (parseInt(pa[1]) || 0) - (parseInt(pb[1]) || 0);
    });

    sortedKeys.forEach(key => {
      const [aisle, col] = key.split('-');
      const racksInAisle = PASILLO_MAP[aisle] || [aisle, aisle];
      
      for (let l = 6; l >= 1; l--) {
        // Cara Izquierda
        const leftRack = racksInAisle[0];
        const leftProd = groups[key]?.find((p: ProductRecord) => {
          const parts = p.localizador.split('-');
          return parts[0] === leftRack && parseInt(parts[2]) === l;
        });
        
        // REGLA: Si es Nivel 1, SIEMPRE es Picking. Si no hay producto y l > 1, es Vacío.
        if (l === 1) {
            pages.push({
                id: `picking-${leftRack}-${col}-${l}`,
                sku: 'PICKING',
                localizador: `${leftRack}-${col}-${l}`,
                description: '',
                pieces: 0,
                subinventario: ''
            } as ProductRecord);
        } else {
            pages.push(leftProd || {
                id: `empty-${leftRack}-${col}-${l}`,
                sku: 'UBICACIÓN VACÍA',
                localizador: `${leftRack}-${col}-${l}`,
                description: '',
                pieces: 0,
                subinventario: ''
            } as ProductRecord);
        }
        
        // Cara Derecha
        const rightRack = racksInAisle[1];
        const rightProd = groups[key]?.find((p: ProductRecord) => {
          const parts = p.localizador.split('-');
          return parts[0] === rightRack && parseInt(parts[2]) === l;
        });

        if (l === 1) {
            pages.push({
                id: `picking-${rightRack}-${col}-${l}`,
                sku: 'PICKING',
                localizador: `${rightRack}-${col}-${l}`,
                description: '',
                pieces: 0,
                subinventario: ''
            } as ProductRecord);
        } else {
            pages.push(rightProd || {
                id: `empty-${rightRack}-${col}-${l}`,
                sku: 'UBICACIÓN VACÍA',
                localizador: `${rightRack}-${col}-${l}`,
                description: '',
                pieces: 0,
                subinventario: ''
            } as ProductRecord);
        }
      }
    });

    return pages;
  }, [selectedItems, inventory, template.paperSize]);

  const totalPages = Math.ceil(organizedPrintingData.length / baseCapacity);
  const printPageStyle = template.paperSize === 'LETTER' ? { width: '215.9mm', height: '279.4mm', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' } : (template.paperSize === 'LABEL' ? { width: '100mm', height: '155mm', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr 1fr' } : { width: '100mm', height: '310mm', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(6, 1fr)' });

  let lastRC_H = "";
  let lastRC_L = "";

  const handleToggleItem = useCallback((prod: ProductRecord) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(prod.id)) next.delete(prod.id);
      else next.set(prod.id, prod);
      return next;
    });
  }, []);

  return (
    <div className={`min-h-screen text-zinc-100 flex flex-col ${template.fontFamily}`}>
      {/* INPUT CSV OCULTO */}
      <input 
        type="file" 
        ref={csvInputRef} 
        onChange={handleImportCSV} 
        accept=".csv" 
        className="hidden" 
      />

      {/* MODAL DE ADVERTENCIA REGLAS DE SUBIDA */}
      {showUploadRules && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-blue-500/30 p-10 rounded-[3rem] max-w-2xl w-full space-y-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5"><UploadCloud size={120} /></div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center">
                <Info size={32} className="text-blue-500" />
              </div>
              <div>
                <h2 className="text-3xl font-black uppercase tracking-tighter">REQUISITOS DEL TEMPLATE</h2>
                <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">VALIDACIÓN OBLIGATORIA DEL SISTEMA</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 py-4">
              <div className="bg-zinc-950/50 p-6 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center gap-3 mb-2">
                  <LayoutGrid size={18} className="text-blue-500" />
                  <span className="text-xs font-black uppercase text-blue-400">Orden de Columnas</span>
                </div>
                <p className="text-[11px] font-bold text-zinc-400 leading-relaxed uppercase tracking-tight">
                  EL ARCHIVO DEBE TENER ESTE ORDEN EXACTO:<br/>
                  <span className="text-white">SKU | LOCALIZADOR | PIEZAS | DESCRIPTION | SUBINVENTARIO</span>
                </p>
              </div>

              <div className="bg-zinc-950/50 p-6 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center gap-3 mb-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <span className="text-xs font-black uppercase text-amber-400">Reglas Estrictas</span>
                </div>
                <ul className="text-[10px] font-bold text-zinc-400 space-y-2 uppercase tracking-tight">
                  <li className="flex gap-2"><div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0"></div> Todas las columnas deben tener datos (sin celdas vacías).</li>
                  <li className="flex gap-2"><div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0"></div> El localizador debe ser Rack-Col-Nivel (Ej: A-1-1).</li>
                  <li className="flex gap-2"><div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0"></div> La columna de Piezas solo acepta números.</li>
                </ul>
              </div>

              <div className="bg-zinc-950/50 p-6 rounded-2xl border border-white/5 space-y-2">
                <div className="flex items-center gap-3 mb-2">
                  <Layers size={18} className="text-emerald-500" />
                  <span className="text-xs font-black uppercase text-emerald-400">Tratamiento de Datos</span>
                </div>
                <p className="text-[10px] font-bold text-zinc-400 leading-relaxed uppercase tracking-tight">
                  EL SISTEMA NO PERMITE LA SUBIDA SI LA DESCRIPCIÓN CONTIENE LOS CARACTERES <span className="text-white">"_"</span> O <span className="text-white">"\""</span>. POR FAVOR, ELIMÍNALOS DE TU ARCHIVO ANTES DE CARGAR.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setShowUploadRules(false); csvInputRef.current?.click(); }} 
                className="w-full bg-blue-600 py-6 rounded-2xl font-black uppercase text-xs hover:bg-blue-500 transition-all shadow-xl flex items-center justify-center gap-3"
              >
                <UploadCloud size={18} /> ENTENDIDO, SELECCIONAR ARCHIVO
              </button>
              <button 
                onClick={() => setShowUploadRules(false)} 
                className="w-full bg-zinc-800 py-6 rounded-2xl font-black uppercase text-xs hover:bg-zinc-700 transition-all"
              >
                CANCELAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN BORRAR TODO */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-red-500/30 p-10 rounded-[3rem] max-w-lg w-full text-center space-y-6 shadow-2xl">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-tighter">¿BORRAR TODO EL CATÁLOGO?</h2>
            <p className="text-zinc-500 font-bold">Esta acción es irreversible. Se eliminarán todos los registros de la base de datos de Supabase.</p>
            <div className="flex flex-col gap-3 pt-4">
              <button onClick={handleDeleteAll} className="w-full bg-red-600 py-6 rounded-2xl font-black uppercase text-xs hover:bg-red-500 transition-all shadow-xl">SÍ, BORRAR TODO</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="w-full bg-zinc-800 py-6 rounded-2xl font-black uppercase text-xs hover:bg-zinc-700 transition-all">CANCELAR</button>
            </div>
          </div>
        </div>
      )}

      {/* AREA DE IMPRESION OCULTA */}
      <div id="print-area" className="hidden fixed top-0 left-0" style={{ zIndex: -100 }}>
        {Array.from({ length: totalPages }).map((_, pIdx) => (
          <div key={pIdx} className="print-page bg-white p-[1.5mm] grid gap-[1.5mm] box-border" style={printPageStyle}>
            {organizedPrintingData.slice(pIdx * baseCapacity, pIdx * baseCapacity + baseCapacity).map((prod, i) => (
              <div key={prod?.id || `empty-${i}`} className="w-full h-full overflow-hidden">
                {prod && <PrintableLabel product={prod} template={template} isMiniMode={template.paperSize !== 'LETTER'} />}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* MODAL PREVISUALIZACION */}
      {showPreview && (
        <div className="fixed inset-0 z-[400] bg-zinc-950 flex flex-col items-center justify-center p-6 backdrop-blur-2xl">
          <div className="w-full max-w-6xl h-full flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <Printer className="text-blue-500" />
                <h3 className="text-2xl font-black uppercase tracking-tighter">PREVISUALIZACIÓN DE LOTE</h3>
              </div>
              <button onClick={() => setShowPreview(false)} className="bg-white/5 p-3 rounded-full hover:bg-white/10 transition-colors"><X /></button>
            </div>
            <div className="flex-1 bg-zinc-900/50 rounded-[3rem] border border-white/5 flex items-center justify-center relative overflow-hidden p-4">
              <div className="flex items-center justify-center w-full h-full overflow-y-auto custom-scrollbar">
                <div className="bg-white grid p-[1.5mm] gap-[1.5mm] shadow-2xl overflow-hidden transform scale-[0.4] sm:scale-[0.5] md:scale-[0.6] lg:scale-[0.7]" style={printPageStyle}>
                  {organizedPrintingData.slice(previewPage * baseCapacity, previewPage * baseCapacity + baseCapacity).map((prod, i) => (
                    <div key={prod?.id || `prev-${i}`} className="w-full h-full">
                      {prod && <PrintableLabel product={prod} template={template} isMiniMode={template.paperSize !== 'LETTER'} />}
                    </div>
                  ))}
                </div>
              </div>
              {totalPages > 1 && (
                <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none w-full px-4">
                  <button disabled={previewPage===0} onClick={()=>setPreviewPage(p=>p-1)} className="pointer-events-auto p-5 bg-black/60 rounded-full disabled:opacity-20 hover:bg-black/90 text-white"><ChevronLeft size={40}/></button>
                  <button disabled={previewPage===totalPages-1} onClick={()=>setPreviewPage(p=>p+1)} className="pointer-events-auto p-5 bg-black/60 rounded-full disabled:opacity-20 hover:bg-black/90 text-white"><ChevronRight size={40}/></button>
                </div>
              )}
            </div>
            <div className="mt-8 flex gap-4">
              <button onClick={handleExportBatch} className="flex-1 bg-blue-600 py-6 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-4 hover:bg-blue-500 transition-all shadow-xl">
                <Download size={20} /> GENERAR LOTE FINAL
              </button>
            </div>
          </div>
        </div>
      )}

      {exportProgress && (
        <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <Loader2 className="text-blue-500 animate-spin mb-6" size={64} />
          <h2 className="text-2xl font-black uppercase tracking-tighter">Exportando {exportProgress.current} de {exportProgress.total}</h2>
          <p className="text-zinc-500 mt-2 font-bold">Por favor, no cierres la ventana</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center p-6 md:p-12 lg:p-20 max-w-[1700px] mx-auto w-full gap-10">
        <header className="w-full flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl rotate-3"><QrCodeIcon className="text-white" size={40} /></div>
            <div>
              <h1 className="text-5xl font-black text-white uppercase tracking-tighter">CV <span className="text-blue-600">DIRECTO</span></h1>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mt-1">INDUSTRIAL LABELING CONSOLE</p>
            </div>
          </div>
        </header>

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 flex flex-col gap-8">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-[3rem] overflow-hidden backdrop-blur-xl shadow-2xl flex flex-col min-h-[720px]">
              <nav className="flex bg-black/40 border-b border-zinc-800/60 p-3 gap-2 overflow-x-auto">
                {[{ id: 'content', label: 'Captura', icon: ClipboardList }, { id: 'database', label: 'Historial', icon: Database }, { id: 'layout', label: 'Layout', icon: LayoutGrid }, { id: 'design', label: 'Diseño', icon: Palette }].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-3 px-8 py-4 text-[11px] font-black uppercase rounded-2xl transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-xl' : 'text-zinc-500 hover:bg-white/5'}`}><tab.icon size={18} /><span>{tab.label}</span></button>
                ))}
              </nav>

              <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
                {activeTab === 'content' && (
                  <div className="animate-in fade-in duration-300 space-y-8">
                    <div className="space-y-4"><label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">SKU PRINCIPAL</label><div className="flex gap-4"><input type="text" value={inventory.sku} onChange={e => setInventory({...inventory, sku: e.target.value.toUpperCase()})} className="flex-1 bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] font-mono text-2xl outline-none" placeholder="ID-000" /><button onClick={() => setIsScanning(true)} className="bg-zinc-800 hover:bg-zinc-700 text-white p-6 rounded-[1.5rem] transition-all shadow-xl"><Scan size={28} /></button></div></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="space-y-4"><label className="text-[10px] font-black text-zinc-500 uppercase">Localizador</label><input type="text" value={inventory.localizador} onChange={e => setInventory({...inventory, localizador: e.target.value.toUpperCase()})} className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-xl font-black outline-none" placeholder="A-1-1" /></div><div className="space-y-4"><label className="text-[10px] font-black text-zinc-500 uppercase">Cantidad</label><input type="number" value={inventory.pieces} onChange={e => setInventory({...inventory, pieces: parseInt(e.target.value) || 0})} className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-xl font-black outline-none" /></div></div>
                    <button onClick={handleAddProduct} disabled={!inventory.sku} className={`w-full py-8 rounded-[2rem] font-black uppercase text-xs flex items-center justify-center gap-4 transition-all shadow-xl ${!inventory.sku ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}><Plus size={28} /> AGREGAR A LISTA</button>
                  </div>
                )}

                {activeTab === 'database' && (
                  <div className="animate-in fade-in duration-300 space-y-6">
                    {/* BOTONES DE GESTIÓN MASIVA RESTAURADOS */}
                    <div className="grid grid-cols-3 gap-3">
                      <button onClick={() => setShowUploadRules(true)} className="flex items-center justify-center gap-2 p-4 bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 rounded-2xl font-black uppercase text-[9px] hover:bg-emerald-600/20 transition-all">
                        <UploadCloud size={16} /> SUBIR TEMPLATE
                      </button>
                      <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 p-4 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl font-black uppercase text-[9px] hover:bg-blue-600/20 transition-all">
                        <Download size={16} /> DESCARGAR TEMPLATE
                      </button>
                      <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center justify-center gap-2 p-4 bg-red-600/10 border border-red-500/20 text-red-400 rounded-2xl font-black uppercase text-[9px] hover:bg-red-600/20 transition-all">
                        <Trash size={16} /> BORRAR TODO
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="relative flex-1"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={20} /><input type="text" placeholder="BUSCAR SKU..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-6 pl-16 rounded-[1.5rem] text-xs font-black uppercase outline-none" /></div>
                      <div className="flex items-center gap-2 bg-zinc-950 p-4 rounded-[1.5rem] border border-zinc-800 overflow-x-auto custom-scrollbar">
                        {ZONES.map(z => <button key={z} onClick={() => setSelectedZone(z)} className={`px-4 py-2 rounded-lg text-[10px] font-black transition-colors ${selectedZone === z ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-white'}`}>{z}</button>)}
                      </div>
                    </div>
                    <div className="space-y-4">
                      {products.map(prod => {
                        const parts = (prod.localizador || '').split('-');
                        const rack = parts[0] || 'Z';
                        const currentRC = `${parts[0]}-${parts[1]}`;
                        const showDivider = currentRC !== lastRC_H;
                        lastRC_H = currentRC;
                        const orientation = RACK_ORIENTATION[rack] || '---';

                        return (
                          <React.Fragment key={prod.id}>
                            {showDivider && (
                              <div className="flex items-center gap-4 pt-4">
                                <div className="flex items-center gap-2">
                                  <span className="bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full text-[9px] font-black uppercase">RACK {parts[0]} · COL {parts[1]}</span>
                                  <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${orientation === 'FRENTE' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-purple-600/20 text-purple-400'}`}>{orientation}</span>
                                </div>
                                <div className="flex-1 h-[1px] bg-zinc-800/50"></div>
                              </div>
                            )}
                            <CatalogItem 
                              prod={prod} 
                              isSelected={selectedItems.has(prod.id)} 
                              onToggle={handleToggleItem} 
                              onSelect={(p: any)=>{setInventory(p);setActiveTab('content');}} 
                              onDelete={(id: string)=>supabase.from('inventory').delete().eq('id',id).then(()=>fetchInventoryDataOnDemand())} 
                            />
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'layout' && (
                  <div className="animate-in fade-in duration-300 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <select value={layoutFilterRack} onChange={e=>setLayoutFilterRack(e.target.value)} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-xs font-black uppercase text-white outline-none">
                        <option value="TODOS">TODOS LOS RACKS</option>
                        {ZONES.slice(1).map(r => <option key={r} value={r}>RACK {r}</option>)}
                      </select>
                      <select value={layoutFilterColumn} onChange={e=>setLayoutFilterColumn(e.target.value)} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-xs font-black uppercase text-white outline-none">
                        <option value="TODOS">TODAS</option>
                        {Array.from({length:25}).map((_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}
                      </select>
                    </div>
                    <div className="space-y-6">
                      {layoutItems.map(item => {
                        const parts = (item.localizador || '').split('-');
                        const rack = parts[0] || 'Z';
                        const currentRC = `${parts[0]}-${parts[1]}`;
                        const showDivider = currentRC !== lastRC_L;
                        lastRC_L = currentRC;
                        const orientation = RACK_ORIENTATION[rack] || '---';

                        return (
                          <React.Fragment key={item.id}>
                            {showDivider && (
                              <div className="flex items-center gap-4 pt-2">
                                <div className="flex items-center gap-3">
                                  <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest">RACK {parts[0]} · COL {parts[1]}</h4>
                                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${orientation === 'FRENTE' ? 'bg-emerald-600/10 text-emerald-400' : 'bg-purple-600/10 text-purple-400'}`}>{orientation}</span>
                                </div>
                                <div className="flex-1 h-[1px] bg-blue-500/10"></div>
                              </div>
                            )}
                            <div className="bg-zinc-950 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between hover:border-zinc-700 transition-colors group">
                                <div className="flex flex-col">
                                  <p className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">{item.localizador}</p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold text-zinc-600 uppercase">{item.zone || 'PASILLO'}</span>
                                    <span className={`text-[7px] font-black px-1 rounded-sm ${orientation === 'FRENTE' ? 'bg-emerald-950 text-emerald-500' : 'bg-purple-950 text-purple-500'}`}>{orientation}</span>
                                  </div>
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === 'design' && (
                  <div className="animate-in fade-in duration-300 space-y-10">
                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">FORMATO DE PAPEL</label>
                      <div className="grid grid-cols-1 gap-4">
                        <button onClick={()=>setTemplate({...template, paperSize:'LETTER'})} className={`flex items-center gap-4 p-6 rounded-[1.5rem] border-2 ${template.paperSize==='LETTER'?'bg-blue-600 border-blue-400':'bg-zinc-950 border-zinc-800'}`}><FileText/><span className="text-xs font-black uppercase">CARTA (4 ETIQUETAS)</span></button>
                        <button onClick={()=>setTemplate({...template, paperSize:'LABEL2'})} className={`flex items-center gap-4 p-6 rounded-[1.5rem] border-2 ${template.paperSize==='LABEL2'?'bg-blue-600 border-blue-400':'bg-zinc-950 border-zinc-800'}`}><Tag/><span className="text-xs font-black uppercase">LOGÍSTICO (12 ETIQUETAS)</span></button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">INDICADOR DIRECCIONAL (Especiales)</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button onClick={()=>setTemplate({...template, arrowDirection:'NONE'})} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${template.arrowDirection==='NONE'?'bg-blue-600 border-blue-400 text-white':'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                          <Minus size={24} />
                          <span className="text-[9px] font-black uppercase">SIN FLECHA</span>
                        </button>
                        <button onClick={()=>setTemplate({...template, arrowDirection:'LEFT'})} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${template.arrowDirection==='LEFT'?'bg-blue-600 border-blue-400 text-white':'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                          <ArrowLeft size={24} />
                          <span className="text-[9px] font-black uppercase">IZQUIERDA</span>
                        </button>
                        <button onClick={()=>setTemplate({...template, arrowDirection:'RIGHT'})} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all ${template.arrowDirection==='RIGHT'?'bg-blue-600 border-blue-400 text-white':'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                          <ArrowRight size={24} />
                          <span className="text-[9px] font-black uppercase">DERECHA</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">TAMAÑO DE FLECHA</label>
                      <div className="flex items-center gap-6 bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem]">
                        <input 
                          type="range" 
                          min="20" 
                          max="150" 
                          step="1"
                          value={template.arrowSize} 
                          onChange={e => setTemplate({...template, arrowSize: parseInt(e.target.value)})} 
                          className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-xl font-black text-blue-500 w-20 text-right">{template.arrowSize}px</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase">Texto Cabecera</label>
                      <input type="text" value={template.headerText} onChange={e=>setTemplate({...template, headerText: e.target.value.toUpperCase()})} className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl outline-none font-black text-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative">
            <div className="sticky top-10 flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-6 px-4"><span className="text-[11px] font-black text-zinc-600 uppercase tracking-widest">VISTA DE IMPRESIÓN</span></div>
              <div className={`shadow-2xl bg-white rounded-[2rem] overflow-hidden border border-zinc-800/50 flex items-center justify-center`} style={{ width: '100%', maxWidth: '450px', aspectRatio: template.paperSize === 'LETTER' ? '216/279' : '100/310', maxHeight: '700px' }}>
                <div className="bg-white grid p-[1.5mm] gap-[1.5mm] origin-center pointer-events-none" style={{ ...printPageStyle, transform: template.paperSize === 'LETTER' ? 'scale(0.42)' : 'scale(0.55)' }}>
                  {organizedPrintingData.slice(0, baseCapacity).map((prod, i) => prod ? (
                    <div key={prod.id} className="w-full h-full overflow-hidden"><PrintableLabel product={prod} template={template} isMiniMode={template.paperSize !== 'LETTER'} /></div>
                  ) : <div key={`e-${i}`} className="w-full h-full bg-zinc-50 border border-dashed border-zinc-200"></div>)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA FLOTANTE DE ACCIÓN */}
        {selectedItems.size > 0 && !showPreview && (
          <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] bg-zinc-900/95 border border-blue-500/30 px-10 py-6 rounded-[2.5rem] shadow-2xl flex items-center gap-12 backdrop-blur-2xl animate-in slide-in-from-bottom-20 duration-500">
            <div className="flex items-center gap-4">
              <Layers className="text-blue-500" />
              <span className="text-white font-black text-lg uppercase">{selectedItems.size} SELECCIONADOS</span>
            </div>
            <div className="h-10 w-[1px] bg-white/10"></div>
            <button onClick={() => { setPreviewPage(0); setShowPreview(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-widest flex items-center gap-4 transition-all shadow-xl"><Printer size={20} /> PREVISUALIZAR</button>
            <button onClick={()=>setSelectedItems(new Map())} className="p-5 bg-zinc-800 text-zinc-500 hover:text-white rounded-2xl transition-all"><X size={20}/></button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan { 0%, 100% { top: 10%; } 50% { top: 90%; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        @media print { body { background: white !important; } #root { display: none !important; } #print-area { display: block !important; position: static !important; } .print-page { page-break-after: always; } }
      `}</style>
    </div>
  );
};

export default App;
