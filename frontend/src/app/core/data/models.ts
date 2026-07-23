/**
 * Data Models - Type Definitions
 * التعريفات فقط بدون بيانات تجريبية
 * للبيانات التجريبية، راجع: src/app/core/mock-data.ts
 */

// ========== Material Management Models ==========
export type MaterialCategory = {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  parentId?: string; // For hierarchical categories
  level: number; // 1 = Main Category, 2 = Sub-category, etc.
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

export type MaterialUnit = {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  symbol: string; // e.g., "m", "kg", "pcs"
  type: 'length' | 'area' | 'volume' | 'weight' | 'count' | 'other';
  isActive: boolean;
};

export type Material = {
  id: string;
  code: string; // Unique material code
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  disciplineId?: string;
  systemId?: string;
  typeId?: string;
  specId?: string;
  specText?: string;
  serial?: number;
  brandId?: string;
  categoryId: string;
  category?: MaterialCategory; // Populated from relation
  unitId: string;
  unit?: MaterialUnit; // Populated from relation
  specifications?: string; // Technical specs
  brand?: string;
  manufacturer?: string;
  supplierCode?: string; // Supplier's code for this material
  unitPrice?: number;
  currency?: string;
  leadTime?: number; // Days
  minOrderQty?: number;
  maxOrderQty?: number;
  reorderLevel?: number;
  isActive: boolean;
  tags?: string[]; // For search and filtering
  attachments?: string[]; // File URLs
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
};

export type MaterialDefinition = {
  id: string;
  materialId: string;
  material?: Material;
  field: string; // e.g., "strength", "grade", "thickness"
  value: string;
  unit?: string;
  sortOrder: number;
};

export type MaterialDiscipline = {
  id: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  isActive: boolean;
};

export type MaterialSystem = {
  id: string;
  disciplineId: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  isActive: boolean;
};

export type MaterialType = {
  id: string;
  systemId: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  isActive: boolean;
};

export type MaterialSpec = {
  id: string;
  typeId: string;
  code: string;
  name: string;
  nameAr?: string;
  description?: string;
  isActive: boolean;
};

export type MaterialBrand = {
  id: string;
  code?: string;
  name: string;
  nameAr?: string;
  isActive: boolean;
};

export type Project = {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'On Hold' | 'Closed';
};

export type StoreItem = {
  id: string;
  projectId: string;
  material: string;
  boq?: string;
  unit: string;
  qtyIn: number;
  qtyOut: number;
  current: number;
  price?: number;
  vendor?: string;
};

export type QSItem = {
  id: string;
  projectId: string;
  material: string;
  boq: string;
  unit: string;
  contract: number;
  executed: number;
  price?: number;
};

export type IR = {
  id: string;
  projectId: string;
  no: string;
  date: string;
  system?: string;
  status: 'Open' | 'Approved' | 'Rejected';
};

export type MIR = {
  id: string;
  projectId: string;
  no: string;
  date: string;
  material?: string;
  status: 'Open' | 'Approved' | 'Rejected';
};

// ✅ للبيانات التجريبية: import من './core/mock-data'
// مثال: import { projects0, qs0, store0, ir0, mir0 } from './core/mock-data';

// ⚠️ للتوافق المؤقت مع الكود القديم - سيتم إزالتها لاحقاً
export { projects0, qs0, store0, ir0, mir0 } from '../mock-data';
