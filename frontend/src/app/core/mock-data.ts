/**
 * Mock Data للتطوير والاختبار
 * يتم استخدام هذه البيانات للتطوير قبل ربط Backend حقيقي
 */

export const projects0 = [
  { id: 'P1', name: 'Al-Munisah', code: 'MN-01', status: 'Active' },
  { id: 'P2', name: 'Al-Narges', code: 'NR-02', status: 'On Hold' },
  { id: 'P3', name: 'MK2 INEX', code: 'MK-02', status: 'Active' }
] satisfies Array<{
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'On Hold' | 'Closed';
}>;

export const qs0 = [
  {
    id: 'Q1',
    projectId: 'P1',
    material: 'GI Pipe 2"',
    boq: 'FF-001',
    unit: 'Lm',
    contract: 2000,
    executed: 450,
    price: 16.5
  },
  {
    id: 'Q2',
    projectId: 'P1',
    material: 'Sprinkler Pendent',
    boq: 'FF-045',
    unit: 'EA',
    contract: 350,
    executed: 120,
    price: 95
  },
  {
    id: 'Q3',
    projectId: 'P2',
    material: 'Duct 24GA',
    boq: 'HV-101',
    unit: 'm²',
    contract: 1200,
    executed: 700,
    price: 90
  }
] satisfies Array<{
  id: string;
  projectId: string;
  material: string;
  boq: string;
  unit: string;
  contract: number;
  executed: number;
  price?: number;
}>;

export const store0 = [
  {
    id: 'S1',
    projectId: 'P1',
    material: 'GI Pipe 2"',
    boq: 'FF-001',
    unit: 'Lm',
    qtyIn: 1200,
    qtyOut: 400,
    current: 800,
    price: 16.5,
    vendor: 'AlYamama'
  },
  {
    id: 'S2',
    projectId: 'P1',
    material: 'FM-200 Cylinder',
    boq: 'SP-014',
    unit: 'EA',
    qtyIn: 12,
    qtyOut: 4,
    current: 8,
    price: 5200,
    vendor: 'Fike'
  },
  {
    id: 'S3',
    projectId: 'P2',
    material: 'Duct 24GA',
    boq: 'HV-101',
    unit: 'm²',
    qtyIn: 800,
    qtyOut: 500,
    current: 300,
    price: 90
  }
] satisfies Array<{
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
}>;

export const ir0 = [
  {
    id: 'IR1',
    projectId: 'P1',
    no: 'IR-MN-101',
    date: '2025-09-10',
    system: 'Fire Fighting',
    status: 'Approved'
  },
  {
    id: 'IR2',
    projectId: 'P3',
    no: 'IR-MK-204',
    date: '2025-09-22',
    system: 'CHW',
    status: 'Rejected'
  }
] satisfies Array<{
  id: string;
  projectId: string;
  no: string;
  date: string;
  system?: string;
  status: 'Open' | 'Approved' | 'Rejected';
}>;

export const mir0 = [
  {
    id: 'MIR1',
    projectId: 'P1',
    no: 'MIR-MN-03',
    date: '2025-09-11',
    material: 'FM-200 Cylinder',
    status: 'Approved'
  },
  {
    id: 'MIR2',
    projectId: 'P2',
    no: 'MIR-NR-12',
    date: '2025-09-20',
    material: 'GI Pipe 2"',
    status: 'Open'
  }
] satisfies Array<{
  id: string;
  projectId: string;
  no: string;
  date: string;
  material?: string;
  status: 'Open' | 'Approved' | 'Rejected';
}>;

// ========== Material Management Mock Data ==========

export const materialUnits0 = [
  {
    id: 'U1',
    code: 'M',
    name: 'Meter',
    nameAr: 'متر',
    symbol: 'm',
    type: 'length',
    isActive: true
  },
  {
    id: 'U2',
    code: 'LM',
    name: 'Linear Meter',
    nameAr: 'متر طولي',
    symbol: 'Lm',
    type: 'length',
    isActive: true
  },
  {
    id: 'U3',
    code: 'M2',
    name: 'Square Meter',
    nameAr: 'متر مربع',
    symbol: 'm²',
    type: 'area',
    isActive: true
  },
  {
    id: 'U4',
    code: 'M3',
    name: 'Cubic Meter',
    nameAr: 'متر مكعب',
    symbol: 'm³',
    type: 'volume',
    isActive: true
  },
  {
    id: 'U5',
    code: 'KG',
    name: 'Kilogram',
    nameAr: 'كيلوجرام',
    symbol: 'kg',
    type: 'weight',
    isActive: true
  },
  {
    id: 'U6',
    code: 'TON',
    name: 'Ton',
    nameAr: 'طن',
    symbol: 'ton',
    type: 'weight',
    isActive: true
  },
  {
    id: 'U7',
    code: 'EA',
    name: 'Each',
    nameAr: 'قطعة',
    symbol: 'EA',
    type: 'count',
    isActive: true
  },
  {
    id: 'U8',
    code: 'SET',
    name: 'Set',
    nameAr: 'طقم',
    symbol: 'Set',
    type: 'count',
    isActive: true
  },
  {
    id: 'U9',
    code: 'L',
    name: 'Liter',
    nameAr: 'لتر',
    symbol: 'L',
    type: 'volume',
    isActive: true
  },
  {
    id: 'U10',
    code: 'BOX',
    name: 'Box',
    nameAr: 'صندوق',
    symbol: 'Box',
    type: 'count',
    isActive: true
  }
];

export const materialCategories0 = [
  {
    id: 'C1',
    code: 'MECH',
    name: 'Mechanical',
    nameAr: 'ميكانيكا',
    description: 'Mechanical materials and equipment',
    level: 1,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'C2',
    code: 'ELEC',
    name: 'Electrical',
    nameAr: 'كهرباء',
    description: 'Electrical materials and equipment',
    level: 1,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'C3',
    code: 'PLUMB',
    name: 'Plumbing',
    nameAr: 'سباكة',
    description: 'Plumbing materials',
    level: 1,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'C4',
    code: 'HVAC',
    name: 'HVAC',
    nameAr: 'تكييف وتهوية',
    description: 'Heating, Ventilation, and Air Conditioning',
    level: 1,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'C5',
    code: 'FF',
    name: 'Fire Fighting',
    nameAr: 'إطفاء حريق',
    description: 'Fire protection and safety equipment',
    level: 1,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'C6',
    code: 'PIPE',
    name: 'Pipes',
    nameAr: 'مواسير',
    description: 'All types of pipes',
    parentId: 'C3',
    level: 2,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'C7',
    code: 'DUCT',
    name: 'Ducts',
    nameAr: 'قنوات هواء',
    description: 'Air ducts and accessories',
    parentId: 'C4',
    level: 2,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'C8',
    code: 'CABLE',
    name: 'Cables',
    nameAr: 'كابلات',
    description: 'Electrical cables and wires',
    parentId: 'C2',
    level: 2,
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  }
];

export const materialDisciplines0 = [
  {
    id: 'D1',
    code: 'MECH',
    name: 'Mechanical',
    description: 'Mechanical discipline for HVAC and rotating equipment',
    isActive: true
  },
  {
    id: 'D2',
    code: 'ELEC',
    name: 'Electrical',
    description: 'Electrical power, lighting, and ELV systems',
    isActive: true
  },
  {
    id: 'D3',
    code: 'PLMB',
    name: 'Plumbing',
    description: 'Plumbing and drainage systems',
    isActive: true
  },
  {
    id: 'D4',
    code: 'FIRE',
    name: 'Fire Fighting',
    description: 'Fire protection and suppression systems',
    isActive: true
  }
];

export const materialSystems0 = [
  {
    id: 'S1',
    disciplineId: 'D1',
    code: 'CHW',
    name: 'Chilled Water',
    description: 'CHW system',
    isActive: true
  },
  {
    id: 'S2',
    disciplineId: 'D1',
    code: 'VENT',
    name: 'Ventilation',
    description: 'Ventilation system',
    isActive: true
  },
  {
    id: 'S3',
    disciplineId: 'D2',
    code: 'PWR',
    name: 'Power',
    description: 'Power distribution',
    isActive: true
  },
  {
    id: 'S4',
    disciplineId: 'D2',
    code: 'LTG',
    name: 'Lighting',
    description: 'Lighting system',
    isActive: true
  },
  {
    id: 'S5',
    disciplineId: 'D2',
    code: 'ELV',
    name: 'ELV',
    description: 'Extra low voltage',
    isActive: true
  },
  {
    id: 'S6',
    disciplineId: 'D3',
    code: 'WS',
    name: 'Water Supply',
    description: 'Domestic water supply',
    isActive: true
  },
  {
    id: 'S7',
    disciplineId: 'D3',
    code: 'DRN',
    name: 'Drainage',
    description: 'Drainage and sewer',
    isActive: true
  },
  {
    id: 'S8',
    disciplineId: 'D4',
    code: 'SPR',
    name: 'Sprinkler',
    description: 'Sprinkler system',
    isActive: true
  },
  {
    id: 'S9',
    disciplineId: 'D4',
    code: 'FM2',
    name: 'FM-200',
    description: 'FM-200 system',
    isActive: true
  }
];

export const materialTypes0 = [
  {
    id: 'T1',
    systemId: 'S1',
    code: 'PIPE',
    name: 'Pipe',
    description: 'CHW piping',
    isActive: true
  },
  {
    id: 'T2',
    systemId: 'S1',
    code: 'VALV',
    name: 'Valve',
    description: 'CHW valves',
    isActive: true
  },
  {
    id: 'T3',
    systemId: 'S2',
    code: 'DUCT',
    name: 'Duct',
    description: 'Ventilation ductwork',
    isActive: true
  },
  {
    id: 'T4',
    systemId: 'S2',
    code: 'DIFF',
    name: 'Diffuser',
    description: 'Air diffusers',
    isActive: true
  },
  {
    id: 'T5',
    systemId: 'S3',
    code: 'CABL',
    name: 'Cable',
    description: 'Power cables',
    isActive: true
  },
  {
    id: 'T6',
    systemId: 'S3',
    code: 'DB',
    name: 'Distribution Board',
    description: 'Electrical DBs',
    isActive: true
  },
  {
    id: 'T7',
    systemId: 'S4',
    code: 'LUM',
    name: 'Luminaire',
    description: 'Lighting fixtures',
    isActive: true
  },
  {
    id: 'T8',
    systemId: 'S4',
    code: 'SWCH',
    name: 'Switch',
    description: 'Switches and dimmers',
    isActive: true
  },
  {
    id: 'T9',
    systemId: 'S5',
    code: 'CCTV',
    name: 'CCTV',
    description: 'CCTV devices',
    isActive: true
  },
  {
    id: 'T10',
    systemId: 'S5',
    code: 'FA',
    name: 'Fire Alarm',
    description: 'Fire alarm devices',
    isActive: true
  },
  {
    id: 'T11',
    systemId: 'S6',
    code: 'PIPE',
    name: 'Pipe',
    description: 'Water supply piping',
    isActive: true
  },
  {
    id: 'T12',
    systemId: 'S6',
    code: 'PUMP',
    name: 'Pump',
    description: 'Water pumps',
    isActive: true
  },
  {
    id: 'T13',
    systemId: 'S7',
    code: 'PIPE',
    name: 'Pipe',
    description: 'Drainage piping',
    isActive: true
  },
  {
    id: 'T14',
    systemId: 'S7',
    code: 'FIX',
    name: 'Fixture',
    description: 'Plumbing fixtures',
    isActive: true
  },
  {
    id: 'T15',
    systemId: 'S8',
    code: 'HEAD',
    name: 'Sprinkler Head',
    description: 'Sprinkler heads',
    isActive: true
  },
  {
    id: 'T16',
    systemId: 'S8',
    code: 'PIPE',
    name: 'Pipe',
    description: 'Sprinkler piping',
    isActive: true
  },
  {
    id: 'T17',
    systemId: 'S9',
    code: 'CYL',
    name: 'Cylinder',
    description: 'FM-200 cylinders',
    isActive: true
  },
  {
    id: 'T18',
    systemId: 'S9',
    code: 'NOZL',
    name: 'Nozzle',
    description: 'FM-200 nozzles',
    isActive: true
  }
];

export const materialSpecs0 = [
  { id: 'SP1', typeId: 'T1', code: '2IN', name: '2 inch', description: '2" pipe', isActive: true },
  { id: 'SP2', typeId: 'T1', code: '3IN', name: '3 inch', description: '3" pipe', isActive: true },
  { id: 'SP3', typeId: 'T1', code: '4IN', name: '4 inch', description: '4" pipe', isActive: true },
  {
    id: 'SP4',
    typeId: 'T2',
    code: 'BV2',
    name: 'Ball Valve 2"',
    description: '2" ball valve',
    isActive: true
  },
  {
    id: 'SP5',
    typeId: 'T2',
    code: 'GV2',
    name: 'Gate Valve 2"',
    description: '2" gate valve',
    isActive: true
  },
  {
    id: 'SP6',
    typeId: 'T3',
    code: '24GA',
    name: '24 Gauge',
    description: '24 gauge duct',
    isActive: true
  },
  {
    id: 'SP7',
    typeId: 'T3',
    code: '22GA',
    name: '22 Gauge',
    description: '22 gauge duct',
    isActive: true
  },
  {
    id: 'SP8',
    typeId: 'T4',
    code: '600X600',
    name: '600x600',
    description: '600x600 diffuser',
    isActive: true
  },
  {
    id: 'SP9',
    typeId: 'T4',
    code: '300X300',
    name: '300x300',
    description: '300x300 diffuser',
    isActive: true
  },
  {
    id: 'SP10',
    typeId: 'T5',
    code: '4X25',
    name: '4x25mm2',
    description: '4 core x 25mm2',
    isActive: true
  },
  {
    id: 'SP11',
    typeId: 'T5',
    code: '4X16',
    name: '4x16mm2',
    description: '4 core x 16mm2',
    isActive: true
  },
  {
    id: 'SP12',
    typeId: 'T6',
    code: '12W',
    name: '12 Way',
    description: '12 way DB',
    isActive: true
  },
  {
    id: 'SP13',
    typeId: 'T6',
    code: '24W',
    name: '24 Way',
    description: '24 way DB',
    isActive: true
  },
  {
    id: 'SP14',
    typeId: 'T7',
    code: 'LED18',
    name: 'LED 18W',
    description: '18W LED',
    isActive: true
  },
  {
    id: 'SP15',
    typeId: 'T7',
    code: 'LED36',
    name: 'LED 36W',
    description: '36W LED',
    isActive: true
  },
  {
    id: 'SP16',
    typeId: 'T8',
    code: '1G',
    name: '1 Gang',
    description: '1 gang switch',
    isActive: true
  },
  {
    id: 'SP17',
    typeId: 'T8',
    code: '2G',
    name: '2 Gang',
    description: '2 gang switch',
    isActive: true
  },
  {
    id: 'SP18',
    typeId: 'T9',
    code: 'IP',
    name: 'IP Camera',
    description: 'IP CCTV',
    isActive: true
  },
  {
    id: 'SP19',
    typeId: 'T9',
    code: 'ANL',
    name: 'Analog',
    description: 'Analog CCTV',
    isActive: true
  },
  {
    id: 'SP20',
    typeId: 'T10',
    code: 'MCP',
    name: 'Manual Call Point',
    description: 'MCP',
    isActive: true
  },
  {
    id: 'SP21',
    typeId: 'T10',
    code: 'SMK',
    name: 'Smoke Detector',
    description: 'Smoke detector',
    isActive: true
  },
  {
    id: 'SP22',
    typeId: 'T11',
    code: '1IN',
    name: '1 inch',
    description: '1" pipe',
    isActive: true
  },
  {
    id: 'SP23',
    typeId: 'T11',
    code: '2IN',
    name: '2 inch',
    description: '2" pipe',
    isActive: true
  },
  {
    id: 'SP24',
    typeId: 'T12',
    code: '5HP',
    name: '5 HP',
    description: '5 HP pump',
    isActive: true
  },
  {
    id: 'SP25',
    typeId: 'T12',
    code: '7HP',
    name: '7 HP',
    description: '7 HP pump',
    isActive: true
  },
  {
    id: 'SP26',
    typeId: 'T13',
    code: '3IN',
    name: '3 inch',
    description: '3" pipe',
    isActive: true
  },
  {
    id: 'SP27',
    typeId: 'T13',
    code: '4IN',
    name: '4 inch',
    description: '4" pipe',
    isActive: true
  },
  {
    id: 'SP28',
    typeId: 'T14',
    code: 'WC',
    name: 'Water Closet',
    description: 'WC',
    isActive: true
  },
  {
    id: 'SP29',
    typeId: 'T14',
    code: 'FD',
    name: 'Floor Drain',
    description: 'Floor drain',
    isActive: true
  },
  {
    id: 'SP30',
    typeId: 'T15',
    code: 'PEND',
    name: 'Pendent',
    description: 'Pendent head',
    isActive: true
  },
  {
    id: 'SP31',
    typeId: 'T15',
    code: 'UPRT',
    name: 'Upright',
    description: 'Upright head',
    isActive: true
  },
  {
    id: 'SP32',
    typeId: 'T16',
    code: '1IN',
    name: '1 inch',
    description: '1" pipe',
    isActive: true
  },
  {
    id: 'SP33',
    typeId: 'T16',
    code: '2IN',
    name: '2 inch',
    description: '2" pipe',
    isActive: true
  },
  {
    id: 'SP34',
    typeId: 'T17',
    code: '50L',
    name: '50 L',
    description: '50L cylinder',
    isActive: true
  },
  {
    id: 'SP35',
    typeId: 'T17',
    code: '100L',
    name: '100 L',
    description: '100L cylinder',
    isActive: true
  },
  {
    id: 'SP36',
    typeId: 'T18',
    code: 'STD',
    name: 'Standard',
    description: 'Standard nozzle',
    isActive: true
  },
  {
    id: 'SP37',
    typeId: 'T18',
    code: 'HIF',
    name: 'High Flow',
    description: 'High flow nozzle',
    isActive: true
  }
];

export const materialBrands0 = [
  { id: 'B1', code: 'TYCO', name: 'Tyco', isActive: true },
  { id: 'B2', code: 'GRUN', name: 'Grundfos', isActive: true },
  { id: 'B3', code: 'SCHN', name: 'Schneider', isActive: true },
  { id: 'B4', code: 'SIEM', name: 'Siemens', isActive: true },
  { id: 'B5', code: 'GREE', name: 'Gree', isActive: true },
  { id: 'B6', code: 'FIKE', name: 'Fike', isActive: true }
];

export const materials0 = [
  {
    id: 'M1',
    code: 'PIPE-GI-2',
    name: 'Galvanized Iron Pipe 2"',
    nameAr: 'ماسورة حديد مجلفن 2 بوصة',
    description: 'GI Pipe 2 inch, Schedule 40, threaded ends',
    descriptionAr: 'ماسورة حديد مجلفن 2 بوصة، جدول 40، نهايات ملولبة',
    categoryId: 'C6',
    unitId: 'U2',
    specifications: 'Schedule 40, ASTM A53, Hot-dipped galvanized',
    brand: 'Saudi Steel',
    manufacturer: 'Saudi Iron & Steel',
    unitPrice: 16.5,
    currency: 'SAR',
    leadTime: 7,
    minOrderQty: 10,
    reorderLevel: 100,
    isActive: true,
    tags: ['pipe', 'galvanized', 'plumbing', 'steel'],
    notes: 'Standard plumbing pipe for water supply',
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-15T10:00:00Z'
  },
  {
    id: 'M2',
    code: 'SPR-PEND-STD',
    name: 'Sprinkler Head Pendent Standard Response',
    nameAr: 'رأس رشاش معلق استجابة قياسية',
    description: 'Standard response pendent sprinkler head, 68°C',
    descriptionAr: 'رأس رشاش معلق استجابة قياسية، 68 درجة مئوية',
    categoryId: 'C5',
    unitId: 'U7',
    specifications: 'K-factor 80, 68°C, Chrome plated, UL/FM approved',
    brand: 'Tyco',
    manufacturer: 'Tyco Fire Products',
    unitPrice: 95,
    currency: 'SAR',
    leadTime: 14,
    minOrderQty: 50,
    reorderLevel: 200,
    isActive: true,
    tags: ['sprinkler', 'fire', 'safety', 'pendent'],
    notes: 'Commonly used in office and residential applications',
    createdAt: '2025-01-15T10:05:00Z',
    updatedAt: '2025-01-15T10:05:00Z'
  },
  {
    id: 'M3',
    code: 'DUCT-24GA-RECT',
    name: 'Rectangular Duct 24 Gauge',
    nameAr: 'قناة هواء مستطيلة 24 جيج',
    description: 'Galvanized steel rectangular duct, 24 gauge',
    descriptionAr: 'قناة هواء مستطيلة من الصلب المجلفن، 24 جيج',
    categoryId: 'C7',
    unitId: 'U3',
    specifications: '24 GA, G90 galvanized coating, TDC/TDF connection',
    brand: 'Al Zamil',
    manufacturer: 'Zamil Steel',
    unitPrice: 90,
    currency: 'SAR',
    leadTime: 10,
    minOrderQty: 50,
    reorderLevel: 500,
    isActive: true,
    tags: ['duct', 'hvac', 'galvanized', 'rectangular'],
    notes: 'Standard HVAC duct for commercial buildings',
    createdAt: '2025-01-15T10:10:00Z',
    updatedAt: '2025-01-15T10:10:00Z'
  },
  {
    id: 'M4',
    code: 'FM200-CYL-100',
    name: 'FM-200 Fire Suppression Cylinder 100L',
    nameAr: 'اسطوانة إطفاء FM-200 سعة 100 لتر',
    description: 'FM-200 clean agent fire suppression cylinder, 100L capacity',
    descriptionAr: 'اسطوانة إطفاء نظيفة FM-200، سعة 100 لتر',
    categoryId: 'C5',
    unitId: 'U7',
    specifications: '100L, 25 bar, includes valve and pressure gauge',
    brand: 'Fike',
    manufacturer: 'Fike Corporation',
    unitPrice: 5200,
    currency: 'SAR',
    leadTime: 30,
    minOrderQty: 1,
    reorderLevel: 5,
    isActive: true,
    tags: ['fm200', 'fire', 'suppression', 'cylinder', 'clean-agent'],
    notes: 'Used for data center and server room fire protection',
    createdAt: '2025-01-15T10:15:00Z',
    updatedAt: '2025-01-15T10:15:00Z'
  },
  {
    id: 'M5',
    code: 'CABLE-NYY-4X25',
    name: 'NYY Cable 4x25mm²',
    nameAr: 'كابل NYY 4x25 مم²',
    description: 'NYY power cable 4 core x 25mm², copper conductor',
    descriptionAr: 'كابل كهرباء NYY 4 أسلاك × 25 مم²، نحاس',
    categoryId: 'C8',
    unitId: 'U1',
    specifications: 'Copper conductor, PVC insulated, 0.6/1kV',
    brand: 'Saudi Cable',
    manufacturer: 'Saudi Cable Company',
    unitPrice: 45,
    currency: 'SAR',
    leadTime: 7,
    minOrderQty: 100,
    reorderLevel: 500,
    isActive: true,
    tags: ['cable', 'electrical', 'power', 'copper'],
    notes: 'Standard power distribution cable',
    createdAt: '2025-01-15T10:20:00Z',
    updatedAt: '2025-01-15T10:20:00Z'
  },
  {
    id: 'M6',
    code: 'VALVE-BALL-2',
    name: 'Ball Valve 2" Brass',
    nameAr: 'محبس كروي 2 بوصة نحاس',
    description: 'Brass ball valve 2 inch, full port',
    descriptionAr: 'محبس كروي نحاس 2 بوصة، فتحة كاملة',
    categoryId: 'C3',
    unitId: 'U7',
    specifications: 'Full port, brass body, threaded ends, PN16',
    brand: 'Valpres',
    manufacturer: 'Valpres SpA',
    unitPrice: 85,
    currency: 'SAR',
    leadTime: 14,
    minOrderQty: 10,
    reorderLevel: 50,
    isActive: true,
    tags: ['valve', 'ball', 'brass', 'plumbing'],
    notes: 'Commonly used in water supply systems',
    createdAt: '2025-01-15T10:25:00Z',
    updatedAt: '2025-01-15T10:25:00Z'
  },
  {
    id: 'M7',
    code: 'AC-SPLIT-24K',
    name: 'Split Air Conditioner 24000 BTU',
    nameAr: 'مكيف سبليت 24000 وحدة حرارية',
    description: 'Split type air conditioner, 24000 BTU cooling capacity',
    descriptionAr: 'مكيف هواء سبليت، قدرة تبريد 24000 وحدة حرارية',
    categoryId: 'C4',
    unitId: 'U7',
    specifications: 'Inverter, R410A refrigerant, Energy class A++, includes installation kit',
    brand: 'Gree',
    manufacturer: 'Gree Electric',
    unitPrice: 2800,
    currency: 'SAR',
    leadTime: 5,
    minOrderQty: 1,
    reorderLevel: 10,
    isActive: true,
    tags: ['ac', 'air-conditioner', 'split', 'hvac', 'cooling'],
    notes: 'Popular model for residential and small commercial use',
    createdAt: '2025-01-15T10:30:00Z',
    updatedAt: '2025-01-15T10:30:00Z'
  },
  {
    id: 'M8',
    code: 'PUMP-CENT-5HP',
    name: 'Centrifugal Pump 5HP',
    nameAr: 'طلمبة طرد مركزي 5 حصان',
    description: 'Centrifugal water pump, 5HP motor',
    descriptionAr: 'طلمبة مياه طرد مركزي، موتور 5 حصان',
    categoryId: 'C1',
    unitId: 'U7',
    specifications: '5HP, 380V, 50Hz, Cast iron body, Max head 30m, Flow 200 LPM',
    brand: 'Grundfos',
    manufacturer: 'Grundfos',
    unitPrice: 3500,
    currency: 'SAR',
    leadTime: 20,
    minOrderQty: 1,
    reorderLevel: 5,
    isActive: true,
    tags: ['pump', 'centrifugal', 'water', 'mechanical'],
    notes: 'Used for water supply and circulation',
    createdAt: '2025-01-15T10:35:00Z',
    updatedAt: '2025-01-15T10:35:00Z'
  }
];
