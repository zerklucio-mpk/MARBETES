
export enum LabelType {
  BARCODE = 'barcode'
}

export interface InventoryData {
  sku: string;
  description: string;
  localizador: string;
  pieces: number;
  subinventario: string;
}

export interface ProductRecord extends InventoryData {
  id: string;
}

export type BarcodeDataMode = 'SKU_ONLY' | 'STRUCTURED';
export type QRDataFormat = 'JSON' | 'PIPE' | 'CSV' | 'PREFIJO';
export type PaperSize = 'LETTER' | 'LABEL' | 'LABEL2';

export interface TemplateConfig {
  headerText: string;
  headerBg: string;
  headerTextColor: string;
  accentColor: string;
  barcodeWidth: number;
  barcodeHeight: number;
  qrSize: number;
  showDate: boolean;
  borderWidth: number;
  borderStyle: 'solid' | 'dashed' | 'double';
  fontFamily: 'font-sans' | 'font-serif' | 'font-mono';
  logoUrl?: string;
  qrFormat: QRDataFormat;
  barcodeMode: BarcodeDataMode;
  qrSeparator: string;
  paperSize: PaperSize;
  qrsPerLabel: number;
}

export interface BarcodeConfig {
  value: string;
  format: 'CODE128' | 'EAN13' | 'CODE39';
  displayValue: boolean;
  fontSize: number;
}
