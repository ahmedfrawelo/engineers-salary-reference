import { test, expect, type Page, type Route } from '@playwright/test';

type MockSupplier = {
  id: number;
  name: string;
  displayName: string;
  website: string;
  address: string;
  countryId: number;
  countryName: string;
  rating: number;
  supplierEmail: string;
  supplierPhone: string;
};

type MockOfficial = {
  id: number;
  supplierId: number;
  name: string;
  email: string;
  phone: string;
  position: string;
};

type MockConnection = {
  id: number;
  supplierId: number;
  materialCategoryId: number;
  materialCategoryName: string;
  brandId: number;
  brandName: string;
  officialId: number | null;
};

type MockAggregateRequest = {
  scope: 'page' | 'filtered' | 'all';
  aggregates: Array<{ field: string; operation: string }>;
};

type MockState = {
  supplier: MockSupplier;
  officials: MockOfficial[];
  connections: MockConnection[];
  materials: Array<{ id: number; name: string }>;
  brands: Array<{ id: number; name: string }>;
  aggregateTotals: {
    page: number;
    filtered: number;
    all: number;
  };
  aggregateRequests: MockAggregateRequest[];
  deleted?: boolean;
};

const wrap = <T>(data: T) => ({
  success: true,
  statusCode: 200,
  message: 'ok',
  data,
  errors: []
});

const paginate = <T>(items: T[], pageNumber: number, pageSize: number) => {
  const safePageNumber = Math.max(1, pageNumber || 1);
  const safePageSize = Math.max(1, pageSize || 1);
  const start = (safePageNumber - 1) * safePageSize;
  const pagedItems = items.slice(start, start + safePageSize);
  const totalCount = items.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / safePageSize) : 0;

  return {
    items: pagedItems,
    totalCount,
    pageNumber: safePageNumber,
    pageSize: safePageSize,
    totalPages,
    hasPreviousPage: safePageNumber > 1,
    hasNextPage: safePageNumber < totalPages
  };
};

const buildScenarioState = (): MockState => ({
  supplier: {
    id: 22,
    name: '22-22',
    displayName: '22-22',
    website: 'https://example.com',
    address: 'Doha',
    countryId: 634,
    countryName: 'Qatar',
    rating: 4,
    supplierEmail: 'we@gmail.com',
    supplierPhone: '+974 50 000 0000'
  },
  officials: [
    {
      id: 1241,
      supplierId: 22,
      name: '',
      email: 'test.user@example.test',
      phone: '',
      position: ''
    }
  ],
  connections: [
    {
      id: 501,
      supplierId: 22,
      materialCategoryId: 9,
      materialCategoryName: 'Ablution Panel',
      brandId: 18,
      brandName: 'ABB',
      officialId: 1241
    }
  ],
  materials: [{ id: 9, name: 'Ablution Panel' }],
  brands: [{ id: 18, name: 'ABB' }],
  aggregateTotals: {
    page: 1,
    filtered: 1,
    all: 25
  },
  aggregateRequests: []
});

const buildMultiConnectionScenarioState = (): MockState => ({
  supplier: {
    id: 77,
    name: 'Carrier Kuwait Air Conditioning',
    displayName: 'Carrier Kuwait Air Conditioning',
    website: 'https://carrier.example.com',
    address: 'Kuwait City',
    countryId: 414,
    countryName: 'Kuwait',
    rating: 4,
    supplierEmail: 'info@carrier-kw.com',
    supplierPhone: '24819733'
  },
  officials: [
    {
      id: 3101,
      supplierId: 77,
      name: 'Ahmed Rahma',
      email: 'ahmed.rahma@carrier-kw.com',
      phone: '24819733',
      position: 'Sales Manager'
    },
    {
      id: 3102,
      supplierId: 77,
      name: 'Qais Saad',
      email: 'qais.saad@carrier-kw.com',
      phone: '24819734',
      position: 'Engineer'
    }
  ],
  connections: [
    {
      id: 9001,
      supplierId: 77,
      materialCategoryId: 101,
      materialCategoryName: 'Air Handling Units',
      brandId: 201,
      brandName: 'Carrier',
      officialId: 3101
    },
    {
      id: 9002,
      supplierId: 77,
      materialCategoryId: 102,
      materialCategoryName: 'Chillers',
      brandId: 201,
      brandName: 'Carrier',
      officialId: 3102
    },
    {
      id: 9003,
      supplierId: 77,
      materialCategoryId: 103,
      materialCategoryName: 'Fan Coil Units',
      brandId: 201,
      brandName: 'Carrier',
      officialId: 3102
    }
  ],
  materials: [
    { id: 101, name: 'Air Handling Units' },
    { id: 102, name: 'Chillers' },
    { id: 103, name: 'Fan Coil Units' }
  ],
  brands: [{ id: 201, name: 'Carrier' }],
  aggregateTotals: {
    page: 1,
    filtered: 1,
    all: 25
  },
  aggregateRequests: []
});

const parseJsonBody = (route: Route): Record<string, unknown> => {
  try {
    return (route.request().postDataJSON() as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
};

const normalizeAggregateScope = (scope: unknown): 'page' | 'filtered' | 'all' =>
  scope === 'page' || scope === 'all' || scope === 'filtered' ? scope : 'filtered';

const buildAggregateResponse = (state: MockState, body: Record<string, unknown>) => {
  const scope = normalizeAggregateScope(body.scope);
  const totalRows = state.aggregateTotals[scope];
  const aggregates = Array.isArray(body.aggregates)
    ? (body.aggregates as Array<Record<string, unknown>>).map(aggregate => {
        const field = String(aggregate.field ?? '').trim();
        const operation = String(aggregate.operation ?? '').trim();
        if (field === 'supplier' && operation === 'count') {
          return { field, operation, value: totalRows };
        }
        if (field === 'rating' && operation === 'sum') {
          return { field, operation, value: scope === 'all' ? state.supplier.rating * totalRows : state.supplier.rating };
        }
        return { field, operation, value: null };
      })
    : [];

  state.aggregateRequests.push({
    scope,
    aggregates: aggregates.map(aggregate => ({
      field: aggregate.field,
      operation: aggregate.operation
    }))
  });

  return {
    scope,
    totalRows,
    aggregates
  };
};

const toSupplierApiModel = (supplier: MockSupplier) => ({
  id: supplier.id,
  name: supplier.name,
  displayName: supplier.displayName,
  website: supplier.website,
  address: supplier.address,
  notes: null,
  status: 1,
  reason: null,
  rate: supplier.rating,
  attachment: null,
  countryId: supplier.countryId,
  countryName: supplier.countryName,
  emails: supplier.supplierEmail ? [{ id: 9101, type: 2, value: supplier.supplierEmail }] : [],
  mobiles: supplier.supplierPhone ? [{ id: 9102, type: 4, value: supplier.supplierPhone }] : []
});

const toOfficialApiModel = (official: MockOfficial) => ({
  id: official.id,
  supplierId: official.supplierId,
  name: official.name,
  position: official.position || null,
  notes: null,
  contacts: [
    ...(official.email ? [{ id: official.id * 10 + 1, type: 2, value: official.email }] : []),
    ...(official.phone ? [{ id: official.id * 10 + 2, type: 4, value: official.phone }] : [])
  ]
});

const buildDetailsRows = (state: MockState) =>
  state.connections.map(connection => {
    const official = state.officials.find(entry => entry.id === connection.officialId) ?? null;
    return {
      id: connection.id,
      supplierId: state.supplier.id,
      supplierName: state.supplier.name,
      supplierDisplayName: state.supplier.displayName,
      supplierAddress: state.supplier.address,
      supplierEmail: state.supplier.supplierEmail,
      supplierPhone: state.supplier.supplierPhone,
      supplierWebsite: state.supplier.website,
      supplierRating: state.supplier.rating,
      supplierCountry: state.supplier.countryName,
      supplierCountryName: state.supplier.countryName,
      materialCategoryId: connection.materialCategoryId,
      materialCategoryName: connection.materialCategoryName,
      brandId: connection.brandId,
      brandName: connection.brandName,
      officialId: official?.id ?? null,
      officialName: official?.name || null,
      officialEmail: official?.email || null
    };
  });

const toTenderSupplierListRow = (state: MockState) => {
  const firstConnection = state.connections[0] ?? null;
  const firstOfficial =
    (firstConnection
      ? state.officials.find(entry => entry.id === firstConnection.officialId)
      : null) ??
    state.officials[0] ??
    null;

  return {
    id: state.supplier.id,
    supplier: state.supplier.displayName || state.supplier.name,
    country: state.supplier.countryName,
    address: state.supplier.address,
    phone: state.supplier.supplierPhone,
    website: state.supplier.website,
    rating: state.supplier.rating > 0 ? `${state.supplier.rating} / 5` : 'Not Rated',
    status: 'Active',
    primaryEmail: state.supplier.supplierEmail,
    supplierEmail: state.supplier.supplierEmail,
    officialName: firstOfficial?.name ?? '',
    officialEmail: firstOfficial?.email ?? '',
    brand: firstConnection?.brandName ?? '',
    item: firstConnection?.materialCategoryName ?? '',
    connectionId: firstConnection?.id ?? null,
    materialCategoryId: firstConnection?.materialCategoryId ?? null,
    brandId: firstConnection?.brandId ?? null,
    officialId: firstOfficial?.id ?? null
  };
};

const toTenderSupplierDetails = (state: MockState) => ({
  id: state.supplier.id,
  supplier: state.supplier.displayName || state.supplier.name,
  name: state.supplier.name,
  displayName: state.supplier.displayName,
  country: state.supplier.countryName,
  address: state.supplier.address,
  phone: state.supplier.supplierPhone,
  email: state.supplier.supplierEmail,
  website: state.supplier.website,
  rating: state.supplier.rating,
  status: 'Active',
  primaryEmail: state.supplier.supplierEmail,
  supplierEmail: state.supplier.supplierEmail,
  officials: state.officials.map(official => ({
    id: official.id,
    name: official.name,
    phone: official.phone,
    email: official.email,
    position: official.position,
    contactIds: {
      email: official.email ? official.id * 10 + 1 : null,
      phone: official.phone ? official.id * 10 + 2 : null
    }
  })),
  connections: state.connections.map(connection => ({
    connectionId: connection.id,
    itemId: connection.materialCategoryId,
    brandId: connection.brandId,
    officialId: connection.officialId,
    officialName: state.officials.find(entry => entry.id === connection.officialId)?.name ?? '',
    item: connection.materialCategoryName,
    brand: connection.brandName
  })),
  attachments: {
    catalog: [],
    portfolio: [],
    financial: []
  },
  contactIds: {
    supplierEmail: state.supplier.supplierEmail ? 9101 : null,
    supplierPhone: null,
    supplierMobile: state.supplier.supplierPhone ? 9102 : null
  },
  loadedAt: new Date().toISOString()
});

const getTenderSupplierFilterOptions = (state: MockState, field: string): string[] => {
  switch ((field || '').trim().toLowerCase()) {
    case 'item':
      return state.materials.map(material => material.name);
    case 'supplier':
      return [state.supplier.displayName || state.supplier.name];
    case 'supplieremail':
      return [state.supplier.supplierEmail];
    case 'brand':
      return state.brands.map(brand => brand.name);
    case 'officialname':
      return state.officials.map(official => official.name).filter(Boolean);
    case 'officialemail':
      return state.officials.map(official => official.email).filter(Boolean);
    case 'country':
      return [state.supplier.countryName];
    case 'address':
      return [state.supplier.address];
    case 'phone':
      return [state.supplier.supplierPhone];
    case 'website':
      return [state.supplier.website];
    case 'rating':
      return [state.supplier.rating > 0 ? `${state.supplier.rating} / 5` : 'Not Rated'];
    default:
      return [];
  }
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const getSupplierFieldValues = (state: MockState, field: string): string[] => {
  switch ((field || '').trim().toLowerCase()) {
    case 'item':
      return state.connections
        .map(connection => normalizeText(connection.materialCategoryName))
        .filter(Boolean);
    case 'supplier':
      return [normalizeText(state.supplier.displayName || state.supplier.name)].filter(Boolean);
    case 'supplieremail':
      return [normalizeText(state.supplier.supplierEmail)].filter(Boolean);
    case 'brand':
      return state.connections
        .map(connection => normalizeText(connection.brandName))
        .filter(Boolean);
    case 'officialname':
      return state.officials.map(official => normalizeText(official.name)).filter(Boolean);
    case 'officialemail':
      return state.officials.map(official => normalizeText(official.email)).filter(Boolean);
    case 'country':
      return [normalizeText(state.supplier.countryName)].filter(Boolean);
    case 'address':
      return [normalizeText(state.supplier.address)].filter(Boolean);
    case 'phone':
      return [normalizeText(state.supplier.supplierPhone)].filter(Boolean);
    case 'website':
      return [normalizeText(state.supplier.website)].filter(Boolean);
    case 'rating':
      return [state.supplier.rating > 0 ? `${state.supplier.rating} / 5` : 'Not Rated'];
    case 'status':
      return ['Active'];
    default:
      return [];
  }
};

const supplierMatchesSearch = (state: MockState, term: string): boolean => {
  const search = normalizeText(term).toLowerCase();
  if (!search) {
    return true;
  }

  const values = [
    ...getSupplierFieldValues(state, 'supplier'),
    ...getSupplierFieldValues(state, 'supplieremail'),
    ...getSupplierFieldValues(state, 'brand'),
    ...getSupplierFieldValues(state, 'item'),
    ...getSupplierFieldValues(state, 'officialname'),
    ...getSupplierFieldValues(state, 'officialemail'),
    ...getSupplierFieldValues(state, 'country'),
    ...getSupplierFieldValues(state, 'address'),
    ...getSupplierFieldValues(state, 'phone'),
    ...getSupplierFieldValues(state, 'website'),
    ...getSupplierFieldValues(state, 'rating'),
    ...getSupplierFieldValues(state, 'status')
  ];

  return values.some(value => value.toLowerCase().includes(search));
};

type MockFilter = {
  field?: string;
  operator?: string;
  value?: unknown;
};

const supplierMatchesFilter = (state: MockState, filter: MockFilter): boolean => {
  const field = normalizeText(filter.field).toLowerCase();
  const operator = normalizeText(filter.operator || 'contains').toLowerCase();
  const values = getSupplierFieldValues(state, field);
  const hasNonEmpty = values.length > 0;

  if (operator === 'isempty') {
    return !hasNonEmpty;
  }

  if (operator === 'notempty') {
    return hasNonEmpty;
  }

  const raw = filter.value;
  const list = Array.isArray(raw)
    ? raw.map(entry => normalizeText(entry)).filter(Boolean)
    : [normalizeText(raw)].filter(Boolean);
  const includesEmpty = list.includes('__EMPTY__');
  const selected = list.filter(entry => entry !== '__EMPTY__');
  const loweredValues = values.map(value => value.toLowerCase());

  if (operator === 'in') {
    if (includesEmpty && !hasNonEmpty) {
      return true;
    }
    return selected.some(entry => loweredValues.includes(entry.toLowerCase()));
  }

  if (operator === 'notin') {
    if (includesEmpty && !hasNonEmpty) {
      return false;
    }
    return !selected.some(entry => loweredValues.includes(entry.toLowerCase()));
  }

  const single = normalizeText(raw).toLowerCase();
  if (!single) {
    return true;
  }

  return operator === 'equals'
    ? loweredValues.includes(single)
    : operator === 'notequals'
      ? !loweredValues.includes(single)
      : operator === 'startswith'
        ? loweredValues.some(value => value.startsWith(single))
        : operator === 'endswith'
          ? loweredValues.some(value => value.endsWith(single))
          : operator === 'notcontains'
            ? hasNonEmpty && !loweredValues.some(value => value.includes(single))
            : loweredValues.some(value => value.includes(single));
};

const supplierMatchesQuery = (state: MockState, url: URL): boolean => {
  const search = normalizeText(url.searchParams.get('search'));
  if (search && !supplierMatchesSearch(state, search)) {
    return false;
  }

  const rawFilters = url.searchParams.get('filters');
  if (!rawFilters) {
    return true;
  }

  try {
    const parsed = JSON.parse(rawFilters) as MockFilter[];
    return parsed.every(filter => supplierMatchesFilter(state, filter));
  } catch {
    return true;
  }
};

const installAuth = async (page: Page) => {
  await page.addInitScript(() => {
    const expiresAt = Date.now() + 60 * 60 * 1000;
    const session = {
      tokens: {
        accessToken: 'e2e-token',
        refreshToken: 'e2e-refresh-token',
        expiresAt
      },
      user: {
        id: 'e2e-user',
        name: 'E2E User',
        email: 'e2e@engineers-salary-reference.sa',
        roles: ['admin'],
        permissions: [
          'tender.suppliers.view',
          'tender.suppliers.edit',
          'suppliers.view',
          'suppliers.create',
          'suppliers.edit',
          'suppliers.delete'
        ]
      }
    };
    const serialized = JSON.stringify(session);
    window.localStorage.setItem('engineers-salary-reference.portal.session', serialized);
    window.sessionStorage.setItem('engineers-salary-reference.portal.session', serialized);
  });

  await page.route(/.*\/auth\/.*/i, async route => {
    const path = new URL(route.request().url()).pathname.toLowerCase();
    if (path.includes('/refresh')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          accessToken: 'e2e-token',
          refreshToken: 'e2e-refresh-token',
          expiresAt: Date.now() + 60 * 60 * 1000,
          expiresIn: 3600,
          tokenType: 'Bearer'
        })
      });
      return;
    }

    if (path.includes('/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'e2e-user',
          name: 'E2E User',
          email: 'e2e@engineers-salary-reference.sa'
        })
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({})
    });
  });
};

const installEmptyApiMock = async (page: Page) => {
  await page.route('**/api/**', async route => {
    const payload = route.request().method() === 'GET' ? [] : null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap(payload))
    });
  });
};

const installScenarioApiMock = async (page: Page, state: MockState) => {
  await page.route('**/api/**', async route => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path.endsWith('/api/tender-suppliers/bootstrap') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
      const supplierRows =
        state.deleted || !supplierMatchesQuery(state, url) ? [] : [toTenderSupplierListRow(state)];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            suppliers: paginate(supplierRows, pageNumber, pageSize),
            countries: [{ id: state.supplier.countryId, name: state.supplier.countryName }],
            materialCategories: state.materials,
            brands: state.brands,
            loadedAt: new Date().toISOString()
          })
        )
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers/filter-options') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap(getTenderSupplierFilterOptions(state, url.searchParams.get('field') ?? ''))
        )
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '100');
      const supplierRows =
        state.deleted || !supplierMatchesQuery(state, url) ? [] : [toTenderSupplierListRow(state)];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(supplierRows, pageNumber, pageSize)))
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers/aggregates') && method === 'POST') {
      const body = parseJsonBody(route);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(buildAggregateResponse(state, body)))
      });
      return;
    }

    if (/\/api\/tender-suppliers\/\d+$/.test(path) && method === 'GET') {
      if (state.deleted) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            statusCode: 404,
            message: 'Supplier not found',
            data: null,
            errors: []
          })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(toTenderSupplierDetails(state)))
      });
      return;
    }

    if (/\/api\/tender-suppliers\/\d+$/.test(path) && method === 'PUT') {
      const body = parseJsonBody(route);
      state.supplier = {
        ...state.supplier,
        name: String(body.name ?? state.supplier.name).trim() || state.supplier.name,
        displayName:
          String(body.displayName ?? state.supplier.displayName).trim() ||
          state.supplier.displayName,
        website: String(body.website ?? state.supplier.website).trim() || state.supplier.website,
        address: String(body.address ?? state.supplier.address).trim() || state.supplier.address,
        supplierEmail:
          String(body.email ?? state.supplier.supplierEmail).trim() || state.supplier.supplierEmail,
        supplierPhone:
          String(body.phone ?? state.supplier.supplierPhone).trim() || state.supplier.supplierPhone,
        countryId: Number(body.countryId ?? state.supplier.countryId) || state.supplier.countryId,
        countryName:
          String(body.country ?? state.supplier.countryName).trim() || state.supplier.countryName,
        rating: Number(body.rating ?? state.supplier.rating) || state.supplier.rating
      };

      const officials = Array.isArray(body.officials)
        ? (body.officials as Array<Record<string, unknown>>)
        : [];
      state.officials = officials.map((official, index) => ({
        id: Number(official.id ?? state.officials[index]?.id ?? 1300 + index),
        supplierId: state.supplier.id,
        name: String(official.name ?? '').trim(),
        email: String(official.email ?? '').trim(),
        phone: String(official.phone ?? '').trim(),
        position: String(official.position ?? '').trim()
      }));

      const connections = Array.isArray(body.connections)
        ? (body.connections as Array<Record<string, unknown>>)
        : [];
      state.connections = connections.map((connection, index) => ({
        id: Number(connection.connectionId ?? state.connections[index]?.id ?? 600 + index),
        supplierId: state.supplier.id,
        materialCategoryId: Number(
          connection.itemId ?? state.connections[index]?.materialCategoryId ?? 0
        ),
        materialCategoryName:
          state.materials.find(
            entry =>
              entry.id ===
              Number(connection.itemId ?? state.connections[index]?.materialCategoryId ?? 0)
          )?.name ??
          String(connection.item ?? state.connections[index]?.materialCategoryName ?? ''),
        brandId: Number(connection.brandId ?? state.connections[index]?.brandId ?? 0),
        brandName:
          state.brands.find(
            entry =>
              entry.id === Number(connection.brandId ?? state.connections[index]?.brandId ?? 0)
          )?.name ?? String(connection.brand ?? state.connections[index]?.brandName ?? ''),
        officialId:
          connection.officialId == null
            ? null
            : Number(connection.officialId ?? state.connections[index]?.officialId)
      }));

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(toTenderSupplierDetails(state)))
      });
      return;
    }

    if (path.endsWith('/api/tender-suppliers') && method === 'POST') {
      const body = parseJsonBody(route);
      state.supplier = {
        ...state.supplier,
        id: Number(body.id ?? state.supplier.id),
        name: String(body.name ?? state.supplier.name).trim() || state.supplier.name,
        displayName:
          String(body.displayName ?? body.name ?? state.supplier.displayName).trim() ||
          state.supplier.displayName,
        website: String(body.website ?? state.supplier.website).trim() || state.supplier.website,
        address: String(body.address ?? state.supplier.address).trim() || state.supplier.address,
        supplierEmail:
          String(body.email ?? state.supplier.supplierEmail).trim() || state.supplier.supplierEmail,
        supplierPhone:
          String(body.phone ?? state.supplier.supplierPhone).trim() || state.supplier.supplierPhone,
        countryName:
          String(body.country ?? state.supplier.countryName).trim() || state.supplier.countryName,
        rating: Number(body.rating ?? state.supplier.rating) || state.supplier.rating
      };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(wrap(toTenderSupplierDetails(state)))
      });
      return;
    }

    if (/\/api\/tender-suppliers\/\d+$/.test(path) && method === 'DELETE') {
      state.deleted = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(true))
      });
      return;
    }

    if (path.endsWith('/api/SupplierMaterialCategoryConnections/details') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '300');
      const supplierIdFilter = Number(url.searchParams.get('supplierId') ?? '0');
      const details = buildDetailsRows(state).filter(row =>
        supplierIdFilter > 0 ? row.supplierId === supplierIdFilter : true
      );
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(details, pageNumber, pageSize)))
      });
      return;
    }

    if (path.endsWith('/api/SupplierMaterialCategoryConnections') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '300');
      const supplierIdFilter = Number(url.searchParams.get('supplierId') ?? '0');
      const rows = state.connections
        .filter(row => (supplierIdFilter > 0 ? row.supplierId === supplierIdFilter : true))
        .map(row => ({
          id: row.id,
          supplierId: row.supplierId,
          materialCategoryId: row.materialCategoryId,
          brandId: row.brandId,
          officialId: row.officialId
        }));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(rows, pageNumber, pageSize)))
      });
      return;
    }

    if (/\/api\/SupplierMaterialCategoryConnections\/\d+$/.test(path) && method === 'PUT') {
      const body = parseJsonBody(route);
      const id = Number(path.split('/').pop());
      const index = state.connections.findIndex(entry => entry.id === id);
      if (index >= 0) {
        state.connections[index] = {
          ...state.connections[index],
          materialCategoryId: Number(
            body.materialCategoryId ?? state.connections[index].materialCategoryId
          ),
          brandId: Number(body.brandId ?? state.connections[index].brandId),
          officialId:
            body.officialId == null
              ? null
              : Number(body.officialId ?? state.connections[index].officialId)
        };
        const material = state.materials.find(
          entry => entry.id === state.connections[index].materialCategoryId
        );
        const brand = state.brands.find(entry => entry.id === state.connections[index].brandId);
        state.connections[index].materialCategoryName =
          material?.name ?? state.connections[index].materialCategoryName;
        state.connections[index].brandName = brand?.name ?? state.connections[index].brandName;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            id,
            supplierId: state.supplier.id,
            materialCategoryId: state.connections[index]?.materialCategoryId ?? 0,
            brandId: state.connections[index]?.brandId ?? null,
            officialId: state.connections[index]?.officialId ?? null
          })
        )
      });
      return;
    }

    if (/\/api\/SupplierMaterialCategoryConnections\/\d+$/.test(path) && method === 'DELETE') {
      const id = Number(path.split('/').pop());
      state.connections = state.connections.filter(entry => entry.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(true))
      });
      return;
    }

    if (path.endsWith('/api/SupplierMaterialCategoryConnections') && method === 'POST') {
      const body = parseJsonBody(route);
      const nextId = Math.max(0, ...state.connections.map(entry => entry.id)) + 1;
      const materialCategoryId = Number(body.materialCategoryId ?? 0);
      const brandId = Number(body.brandId ?? 0);
      const officialId = body.officialId == null ? null : Number(body.officialId);
      state.connections.push({
        id: nextId,
        supplierId: Number(body.supplierId ?? state.supplier.id),
        materialCategoryId,
        materialCategoryName:
          state.materials.find(entry => entry.id === materialCategoryId)?.name ??
          'Unknown material',
        brandId,
        brandName: state.brands.find(entry => entry.id === brandId)?.name ?? 'Unknown brand',
        officialId
      });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap({
            id: nextId,
            supplierId: state.supplier.id,
            materialCategoryId,
            brandId,
            officialId
          })
        )
      });
      return;
    }

    if (/\/api\/Suppliers\/\d+$/.test(path) && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(toSupplierApiModel(state.supplier)))
      });
      return;
    }

    if (/\/api\/Suppliers\/\d+$/.test(path) && method === 'PUT') {
      const body = parseJsonBody(route);
      state.supplier = {
        ...state.supplier,
        name: String(body.name ?? state.supplier.name).trim() || state.supplier.name,
        displayName:
          String(body.displayName ?? state.supplier.displayName).trim() ||
          state.supplier.displayName,
        website: String(body.website ?? state.supplier.website).trim() || state.supplier.website,
        address: String(body.address ?? state.supplier.address).trim() || state.supplier.address,
        countryId: Number(body.countryId ?? state.supplier.countryId) || state.supplier.countryId
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(toSupplierApiModel(state.supplier)))
      });
      return;
    }

    if (/\/api\/Suppliers\/\d+$/.test(path) && method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(true))
      });
      return;
    }

    if (path.endsWith('/api/Suppliers') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '300');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          wrap(paginate([toSupplierApiModel(state.supplier)], pageNumber, pageSize))
        )
      });
      return;
    }

    if (path.endsWith('/api/Officials') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '300');
      const supplierIdFilter = Number(url.searchParams.get('supplierId') ?? state.supplier.id);
      const rows = state.officials
        .filter(entry => entry.supplierId === supplierIdFilter)
        .map(toOfficialApiModel);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(rows, pageNumber, pageSize)))
      });
      return;
    }

    if (/\/api\/Officials\/\d+$/.test(path) && method === 'GET') {
      const id = Number(path.split('/').pop());
      const official = state.officials.find(entry => entry.id === id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(official ? toOfficialApiModel(official) : null))
      });
      return;
    }

    if (/\/api\/Officials\/\d+$/.test(path) && method === 'PUT') {
      const body = parseJsonBody(route);
      const id = Number(path.split('/').pop());
      const index = state.officials.findIndex(entry => entry.id === id);
      if (index >= 0) {
        const contacts = Array.isArray(body.contacts)
          ? (body.contacts as Array<Record<string, unknown>>)
          : [];
        const emailContact = contacts.find(entry => Number(entry.type) === 2);
        const phoneContact = contacts.find(entry => Number(entry.type) === 4);
        state.officials[index] = {
          ...state.officials[index],
          name: String(body.name ?? state.officials[index].name).trim(),
          position: String(body.position ?? state.officials[index].position).trim(),
          email:
            typeof emailContact?.value === 'string'
              ? emailContact.value.trim()
              : state.officials[index].email,
          phone:
            typeof phoneContact?.value === 'string'
              ? phoneContact.value.trim()
              : state.officials[index].phone
        };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(index >= 0 ? toOfficialApiModel(state.officials[index]) : null))
      });
      return;
    }

    if (/\/api\/Officials\/\d+$/.test(path) && method === 'DELETE') {
      const id = Number(path.split('/').pop());
      state.officials = state.officials.filter(entry => entry.id !== id);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(true))
      });
      return;
    }

    if (path.endsWith('/api/Officials') && method === 'POST') {
      const body = parseJsonBody(route);
      const nextId = Math.max(1200, ...state.officials.map(entry => entry.id)) + 1;
      const contacts = Array.isArray(body.contacts)
        ? (body.contacts as Array<Record<string, unknown>>)
        : [];
      const emailContact = contacts.find(entry => Number(entry.type) === 2);
      const phoneContact = contacts.find(entry => Number(entry.type) === 4);
      const created: MockOfficial = {
        id: nextId,
        supplierId: Number(body.supplierId ?? state.supplier.id),
        name: String(body.name ?? '').trim(),
        email: typeof emailContact?.value === 'string' ? emailContact.value.trim() : '',
        phone: typeof phoneContact?.value === 'string' ? phoneContact.value.trim() : '',
        position: String(body.position ?? '').trim()
      };
      state.officials.push(created);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(toOfficialApiModel(created)))
      });
      return;
    }

    if (path.endsWith('/api/MaterialCategories') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '300');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(state.materials, pageNumber, pageSize)))
      });
      return;
    }

    if (path.endsWith('/api/Brands') && method === 'GET') {
      const pageNumber = Number(url.searchParams.get('pageNumber') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '300');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap(paginate(state.brands, pageNumber, pageSize)))
      });
      return;
    }

    if (path.includes('/api/contacts') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrap([]))
      });
      return;
    }

    const payload = method === 'GET' ? [] : null;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wrap(payload))
    });
  });
};

const gotoSuppliersPage = async (page: Page) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
  await page.goto('/tender/suppliers');
  await expect(page).toHaveURL(/\/tender\/suppliers$/, { timeout: 30000 });

  await expect(page.getByRole('toolbar', { name: 'Suppliers page actions' })).toBeVisible({
    timeout: 30000
  });
  await expect(page.getByRole('button', { name: 'Add New Supplier' })).toBeVisible({
    timeout: 30000
  });
};

test.describe('Suppliers Page', () => {
  test.beforeEach(async ({ page }) => {
    await installAuth(page);
  });

  test('should display suppliers workspace', async ({ page }) => {
    await installEmptyApiMock(page);
    await gotoSuppliersPage(page);
    await expect(page.getByRole('toolbar', { name: 'Suppliers page actions' })).toBeVisible();
    await expect(page.locator('engineers-salary-reference-data-grid').first()).toBeVisible();
  });

  test('should show grid action controls', async ({ page }) => {
    await installEmptyApiMock(page);
    await gotoSuppliersPage(page);
    await expect(page.getByRole('button', { name: 'Views' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add New Supplier' })).toBeVisible();
  });

  test('should open the add supplier editor with the cleaned split action and sidebar layout', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const state = buildMultiConnectionScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    await page.getByRole('button', { name: 'Add New Supplier' }).click();

    const overlay = page.locator('.supplier-editor-overlay');
    await expect(overlay).toBeVisible({ timeout: 30000 });
    await expect(overlay.locator('.cu-task-tab.active')).toHaveText('Add New Supplier');
    await expect(overlay.locator('textarea[name="name"]')).toHaveAttribute(
      'placeholder',
      'Supplier name'
    );

    const mainColumn = overlay.locator('.supplier-main-column');
    const sidebarColumn = overlay.locator('.supplier-sidebar-column');
    await expect(mainColumn).toBeVisible();
    await expect(sidebarColumn).toBeVisible();
    await expect(mainColumn.getByRole('heading', { name: 'Officials' })).toBeVisible();
    await expect(
      sidebarColumn.getByRole('heading', { name: 'Material Category & Brand Connections' })
    ).toBeVisible();
    await expect(sidebarColumn.locator('.field > span:not(.field-label-hidden)')).toHaveCount(0);
    await expect(overlay.getByText('Attachments', { exact: true })).toHaveCount(0);
    await expect(overlay.getByText('No officials added')).toHaveCount(0);

    const panelMetrics = await overlay.evaluate(panel => {
      const main = panel.querySelector('.supplier-main-column') as HTMLElement | null;
      const sidebar = panel.querySelector('.supplier-sidebar-column') as HTMLElement | null;
      const box = panel.getBoundingClientRect();
      const mainBox = main?.getBoundingClientRect();
      const sidebarBox = sidebar?.getBoundingClientRect();
      return {
        width: Math.round(box.width),
        height: Math.round(box.height),
        mainOverflowY: main ? getComputedStyle(main).overflowY : '',
        sidebarOverflowY: sidebar ? getComputedStyle(sidebar).overflowY : ''
      };
    });

    expect(panelMetrics.width).toBeGreaterThanOrEqual(1100);
    expect(panelMetrics.height).toBeGreaterThanOrEqual(660);
    expect(panelMetrics.mainOverflowY).not.toBe('hidden');
    expect(panelMetrics.sidebarOverflowY).not.toBe('hidden');

    const createSurface = overlay.locator('.supplier-create-surface');
    await expect(createSurface).toBeVisible();
    await expect(createSurface.getByRole('button', { name: 'Create Supplier' })).toBeVisible();
    await overlay.locator('details.supplier-create-menu > summary').click();

    const createMenu = overlay.locator('.supplier-create-menu-list');
    await expect(createMenu.getByRole('button', { name: 'Create and open' })).toBeVisible();
    await expect(
      createMenu.getByRole('button', { name: 'Create and start another' })
    ).toBeVisible();
    await expect(createMenu.getByRole('button', { name: 'Create and duplicate' })).toBeVisible();

    const menuStyles = await createMenu.evaluate(menu => {
      const styles = getComputedStyle(menu);
      const menuBox = menu.getBoundingClientRect();
      const surfaceBox = document
        .querySelector('.supplier-create-surface')
        ?.getBoundingClientRect();
      return {
        boxShadow: styles.boxShadow,
        opensAboveButton: surfaceBox ? menuBox.bottom <= surfaceBox.top : false
      };
    });
    expect(menuStyles.boxShadow).toBe('none');
    expect(menuStyles.opensAboveButton).toBe(true);
  });

  test('should open supplier item details directly in editable mode with officials visible', async ({
    page
  }) => {
    const state = buildScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    await page.getByRole('button', { name: /item: Ablution Panel/i }).click();
    const editorPanel = page.locator('.supplier-editor-overlay');
    await expect(editorPanel).toBeVisible();
    await expect(editorPanel.locator('.cu-task-tab.active')).toHaveText('Edit Supplier');
    await expect(editorPanel.getByRole('heading', { name: 'Officials' })).toBeVisible();
    await expect(editorPanel.getByText(state.officials[0].email, { exact: true })).toBeVisible();
    await expect(editorPanel.getByRole('button', { name: 'Save Supplier' })).toBeVisible();
  });

  test('should seed inline edit with the current supplier values', async ({ page }) => {
    const state = buildScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    await page.getByRole('button', { name: /item: Ablution Panel/i }).click();
    const editorPanel = page.locator('.supplier-editor-overlay');
    await expect(editorPanel).toBeVisible();

    await expect(editorPanel.locator('textarea[name="name"]')).toHaveValue(state.supplier.name);
    await expect(editorPanel.locator('input[name="displayName"]')).toHaveValue(
      state.supplier.displayName
    );
    await expect(editorPanel.locator('textarea[name="address"]')).toHaveValue(
      state.supplier.address
    );
    const addressHeight = await editorPanel.locator('textarea[name="address"]').evaluate(node => {
      const box = node.getBoundingClientRect();
      return Math.round(box.height);
    });
    expect(addressHeight).toBeGreaterThanOrEqual(40);
    expect(addressHeight).toBeLessThanOrEqual(80);
    await expect(editorPanel.locator('input[name="email"]')).toHaveValue(
      state.supplier.supplierEmail
    );
  });

  test('should open delete dialog and remove the supplier through the aggregated page api', async ({
    page
  }) => {
    const state = buildScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    await page.getByRole('button', { name: /supplier:\s*22-22/i }).click();
    const supplierPanel = page.locator('.supplier-detail-panel');
    await expect(supplierPanel).toBeVisible();

    await supplierPanel.getByRole('button', { name: 'Delete supplier' }).click();

    const deleteDialog = page.locator('.confirm-delete-overlay');
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog.getByText('Delete permanently')).toBeVisible();

    const deleteCodeInput = deleteDialog.getByPlaceholder('Enter the delete code');
    await expect(deleteCodeInput).toBeVisible();
    await deleteCodeInput.fill('ok');
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(deleteDialog).toBeHidden();
    await expect(page.getByRole('button', { name: /supplier:\s*22-22/i })).toHaveCount(0);
  });

  test('should keep a single grid row when opening details for a supplier with many connections', async ({
    page
  }) => {
    const state = buildMultiConnectionScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    const supplierButton = page.getByRole('button', {
      name: /supplier:\s*Carrier Kuwait Air Conditioning/i
    });
    await expect(supplierButton).toHaveCount(1);

    await supplierButton.click();
    const supplierPanel = page.locator('.supplier-detail-panel');
    await expect(supplierPanel).toBeVisible();
    await expect(supplierPanel.locator('.edit-inline-action')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /supplier:\s*Carrier Kuwait Air Conditioning/i })
    ).toHaveCount(1);
  });

  test('should open the unified supplier editor when editing from supplier details', async ({
    page
  }) => {
    const state = buildScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    await page.getByRole('button', { name: /supplier:\s*22-22/i }).click();

    const supplierPanel = page.locator('.supplier-detail-panel');
    await expect(supplierPanel).toBeVisible();

    await supplierPanel.getByRole('button', { name: 'Edit supplier' }).click();

    const editorPanel = page.locator('.supplier-editor-overlay');
    await expect(editorPanel).toBeVisible();
    await expect(editorPanel.locator('.cu-task-tab.active')).toHaveText('Edit Supplier');
    await expect(editorPanel.locator('textarea[name="name"]')).toHaveValue(state.supplier.name);
    await expect(editorPanel.locator('input[name="displayName"]')).toHaveValue(
      state.supplier.displayName
    );
    await expect(supplierPanel).toBeHidden();
  });

  test('should refresh aggregate totals when switching the supplier aggregate scope', async ({
    page
  }) => {
    test.setTimeout(120_000);
    const state = buildScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    const aggregateTrigger = page
      .locator('.grid-calculate-footer__trigger:not(.grid-calculate-footer__trigger--scope)')
      .nth(1);

    await aggregateTrigger.click();

    const operationPanel = page.locator('.grid-calculate-footer__panel--operation');
    await expect(operationPanel).toBeVisible();
    await operationPanel.locator('.grid-calculate-footer__select').selectOption('count');
    await operationPanel.getByRole('button', { name: 'Calculate' }).click();

    await expect(aggregateTrigger).toContainText('1');
    await expect
      .poll(() => state.aggregateRequests.at(-1)?.scope ?? null)
      .toBe('filtered');

    const scopeTrigger = page.locator('.grid-calculate-footer__trigger--scope').first();
    await scopeTrigger.click();
    await page
      .locator('.grid-calculate-footer__panel--scope')
      .getByRole('button', { name: /All Data/i })
      .click();

    await expect(aggregateTrigger).toContainText('25');
    await expect
      .poll(() => state.aggregateRequests.at(-1)?.scope ?? null)
      .toBe('all');

    await scopeTrigger.click();
    await page
      .locator('.grid-calculate-footer__panel--scope')
      .getByRole('button', { name: /Page/i })
      .click();

    await expect(aggregateTrigger).toContainText('1');
    await expect
      .poll(() => state.aggregateRequests.at(-1)?.scope ?? null)
      .toBe('page');
  });

  test('should keep the mail preview overlay responsive and preserve editor history on mobile', async ({
    page
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });

    const state = buildMultiConnectionScenarioState();
    state.officials = Array.from({ length: 24 }, (_, index) => ({
      id: 4100 + index,
      supplierId: state.supplier.id,
      name: `Mail Official ${index + 1}`,
      email: `mail-official-${index + 1}@carrier-kw.com`,
      phone: `248197${String(index).padStart(2, '0')}`,
      position: index % 2 === 0 ? 'Sales Manager' : 'Engineer'
    }));

    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    await page.getByRole('button', { name: 'Send Mail' }).click();
    const noEmailOverlay = page.locator('.no-email-selection-overlay');
    await expect(noEmailOverlay).toBeVisible();
    await expect(noEmailOverlay.getByText('Select email recipients first')).toBeVisible();
    await expect(noEmailOverlay.getByText('Pick suppliers with available')).toBeVisible();
    await noEmailOverlay.getByRole('button', { name: 'Okay, got it' }).click();
    await expect(noEmailOverlay).toBeHidden();

    await page
      .getByRole('button', { name: /supplier:\s*Carrier Kuwait Air Conditioning/i })
      .click();

    const supplierPanel = page.locator('.supplier-detail-panel');
    await expect(supplierPanel).toBeVisible();
    await supplierPanel.getByRole('link', { name: state.officials[0].email }).click();

    const mailOverlay = page.locator('.supplier-mail-preview-overlay');
    await expect(mailOverlay).toBeVisible();
    await expect(mailOverlay.getByText('Email Recipients')).toBeVisible();
    await expect(mailOverlay.locator('.mail-pill')).toHaveCount(state.officials.length + 1);
    await expect(mailOverlay.locator('.mail-filter--supplier .mail-filter__count')).toHaveText('1');
    await expect(mailOverlay.locator('.mail-filter--official .mail-filter__count')).toHaveText(
      String(state.officials.length)
    );
    await expect(
      mailOverlay.getByText('Recipients are added to BCC so suppliers do not see each other.')
    ).toBeVisible();
    await expect(mailOverlay.locator('.mail-composer__row--destination')).toContainText(
      `${state.officials.length + 1} recipients`
    );
    await expect(mailOverlay.locator('.mail-composer__row--destination')).toContainText(
      `1 supplier + ${state.officials.length} officials included privately`
    );
    await expect(mailOverlay.getByRole('textbox', { name: 'Email body' })).toBeVisible();
    await expect(
      mailOverlay.getByRole('button', { name: 'Copy recipient emails' })
    ).toHaveAttribute('title', 'Copy all recipient emails');
    await page.evaluate(() => {
      const store = window as Window & { __copiedEmails?: string };
      store.__copiedEmails = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: (value: string) => {
            store.__copiedEmails = value;
            return Promise.resolve();
          }
        }
      });
    });
    await mailOverlay.getByRole('button', { name: 'Copy recipient emails' }).click();
    await expect(mailOverlay.getByRole('button', { name: 'Copy recipient emails' })).toContainText(
      'Copied'
    );
    await expect(
      mailOverlay.getByRole('button', { name: 'Copy recipient emails' })
    ).toHaveAttribute('title', 'Copied recipient emails');
    const copiedEmails = await page.evaluate(
      () => (window as Window & { __copiedEmails?: string }).__copiedEmails ?? ''
    );
    expect(copiedEmails).toContain('info@carrier-kw.com');
    expect(copiedEmails).toContain(state.officials[0].email);
    expect(copiedEmails.split('; ')).toHaveLength(state.officials.length + 1);
    await mailOverlay.locator('.mail-filter--supplier').click();
    await expect(mailOverlay.getByRole('button', { name: 'Copy recipient emails' })).toContainText(
      'Copy Emails'
    );
    await mailOverlay.locator('.mail-filter--official').click();
    await expect(mailOverlay.getByText('Email sources are turned off')).toBeVisible();
    await expect(mailOverlay.locator('.mail-filter--supplier .mail-filter__count')).toHaveText('1');
    await expect(mailOverlay.locator('.mail-filter--official .mail-filter__count')).toHaveText(
      String(state.officials.length)
    );
    await expect(
      mailOverlay.getByText('Recipients are added to BCC so suppliers do not see each other.')
    ).toBeVisible();
    await expect(mailOverlay.locator('.mail-composer__row--destination')).toContainText(
      'Turn on Supplier Emails or Official Emails to add recipients back to this draft.'
    );
    await expect(mailOverlay.getByRole('button', { name: 'Copy recipient emails' })).toBeDisabled();
    await expect(
      mailOverlay.getByRole('button', { name: 'Copy recipient emails' })
    ).toHaveAttribute(
      'title',
      'Turn on Supplier Emails or Official Emails to add recipients back to this draft.'
    );
    await expect(mailOverlay.getByRole('button', { name: /Go to Send/i })).toBeDisabled();
    await expect(mailOverlay.getByRole('button', { name: /Go to Send/i })).toHaveAttribute(
      'title',
      'Turn on Supplier Emails or Official Emails to add recipients back to this draft.'
    );
    await expect(mailOverlay.getByLabel('More send options')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await expect(mailOverlay.getByLabel('More send options')).toHaveAttribute(
      'title',
      'Turn on Supplier Emails or Official Emails to add recipients back to this draft.'
    );
    await mailOverlay.locator('.mail-filter--supplier').click();
    await mailOverlay.locator('.mail-filter--official').click();
    await expect(mailOverlay.getByText('Email sources are turned off')).toBeHidden();
    await expect(mailOverlay.locator('.mail-pill')).toHaveCount(state.officials.length + 1);
    await expect(mailOverlay.locator('.mail-composer__row--destination')).toContainText(
      `1 supplier + ${state.officials.length} officials included privately`
    );
    await expect(
      mailOverlay.locator('.mail-pill__source').filter({ hasText: 'Supplier' })
    ).toHaveCount(1);
    await expect(
      mailOverlay.locator('.mail-pill__source').filter({ hasText: 'Official' })
    ).toHaveCount(state.officials.length);
    await expect(
      mailOverlay.locator('.mail-pill').filter({ hasText: state.officials[0].email })
    ).toHaveAttribute('title', `${state.officials[0].email} (Official)`);
    await expect(
      mailOverlay.getByRole('button', { name: `Remove ${state.officials[0].email}` })
    ).toBeVisible();
    const sendOptionsTrigger = mailOverlay.getByRole('button', { name: 'More send options' });
    await expect(sendOptionsTrigger).toHaveAttribute('aria-haspopup', 'menu');
    await expect(sendOptionsTrigger).toHaveAttribute(
      'aria-controls',
      'supplierMailSendOptionsMenu'
    );
    await sendOptionsTrigger.press('ArrowDown');
    await expect(sendOptionsTrigger).toHaveAttribute('aria-expanded', 'true');
    await expect(
      mailOverlay.getByRole('menuitem', { name: /Send via Outlook Web/i })
    ).toBeVisible();
    await expect(
      mailOverlay.getByRole('menuitem', { name: /Send via Outlook App/i })
    ).toBeVisible();
    await expect(
      mailOverlay.getByRole('menuitem', { name: /Send via Outlook Web/i })
    ).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(
      mailOverlay.getByRole('menuitem', { name: /Send via Outlook App/i })
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sendOptionsTrigger).toHaveAttribute('aria-expanded', 'false');
    await expect(mailOverlay.getByRole('menuitem', { name: /Send via Outlook Web/i })).toBeHidden();
    await expect(sendOptionsTrigger).toBeFocused();
    await sendOptionsTrigger.click();
    await expect(
      mailOverlay.getByRole('menuitem', { name: /Send via Outlook Web/i })
    ).toBeVisible();
    await expect(
      mailOverlay.getByRole('menuitem', { name: /Send via Outlook App/i })
    ).toBeVisible();
    await expect(mailOverlay.getByText('Open a browser draft')).toBeVisible();
    await expect(mailOverlay.getByText('Open the desktop mail app')).toBeVisible();
    const sendMenuMetrics = await mailOverlay.locator('.supplier-mail-send-menu').evaluate(menu => {
      const box = menu.getBoundingClientRect();
      const surfaceBox = document
        .querySelector('.supplier-mail-send-field .supplier-create-surface')
        ?.getBoundingClientRect();
      return {
        fitsViewport:
          box.left >= -1 &&
          box.top >= -1 &&
          box.right <= window.innerWidth + 1 &&
          box.bottom <= window.innerHeight + 1,
        opensAboveButton: surfaceBox ? box.bottom <= surfaceBox.top : false
      };
    });
    expect(sendMenuMetrics.fitsViewport).toBe(true);
    expect(sendMenuMetrics.opensAboveButton).toBe(true);
    await sendOptionsTrigger.click();
    await expect(mailOverlay.getByRole('menuitem', { name: /Send via Outlook Web/i })).toBeHidden();
    await expect(mailOverlay.locator('.mail-overlay__list-head')).toBeHidden();
    await expect(page.locator('app-messages-widget .chat-widget')).toBeHidden();
    await expect
      .poll(() =>
        mailOverlay.evaluate(panel => {
          const message = panel.querySelector('.supplier-mail-section--message');
          const recipients = panel.querySelector('.supplier-mail-section--recipients');
          if (!message || !recipients) {
            return false;
          }

          return message.getBoundingClientRect().top < recipients.getBoundingClientRect().top;
        })
      )
      .toBe(true);
    await expect
      .poll(() =>
        mailOverlay.evaluate(panel => {
          const sendButton = Array.from(panel.querySelectorAll('button')).find(button =>
            button.textContent?.includes('Go to Send')
          );
          if (!sendButton) {
            return false;
          }

          const rect = sendButton.getBoundingClientRect();
          const topElement = document.elementsFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
          )[0];

          return Boolean(topElement?.closest('.supplier-mail-send-field'));
        })
      )
      .toBe(true);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(250);
    await expect(mailOverlay.locator('.mail-overlay__list-head')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const title = document.querySelector(
            '.supplier-mail-section--recipients .supplier-mail-section__title'
          );
          if (!title) {
            return false;
          }

          const rect = title.getBoundingClientRect();
          const topElement = document.elementsFromPoint(
            rect.left + 4,
            rect.top + rect.height / 2
          )[0];

          return Boolean(topElement?.closest('.supplier-mail-preview-overlay'));
        })
      )
      .toBe(true);

    await page.setViewportSize({ width: 390, height: 667 });
    await page.waitForTimeout(250);

    const overlayMetrics = await mailOverlay.evaluate(panel => {
      const box = panel.getBoundingClientRect();
      const main = panel.querySelector('.supplier-mail-main') as HTMLElement | null;
      const list = panel.querySelector('.mail-overlay__list') as HTMLElement | null;
      const subject = panel.querySelector('#mailSubject') as HTMLElement | null;
      const editor = panel.querySelector('#mailBody') as HTMLElement | null;
      const toolbar = panel.querySelector('.mail-form__toolbar') as HTMLElement | null;
      const subjectBox = subject?.getBoundingClientRect();
      const editorBox = editor?.getBoundingClientRect();
      const toolbarBox = toolbar?.getBoundingClientRect();
      return {
        fitsViewport:
          box.left >= -1 &&
          box.top >= -1 &&
          box.right <= window.innerWidth + 1 &&
          box.bottom <= window.innerHeight + 1,
        width: Math.round(box.width),
        height: Math.round(box.height),
        mainOverflowX: main ? main.scrollWidth > main.clientWidth + 2 : true,
        listHeight: list ? Math.round(list.getBoundingClientRect().height) : 0,
        listOverflowY: list ? getComputedStyle(list).overflowY : '',
        listScrollable: list ? list.scrollHeight > list.clientHeight : false,
        subjectVisible: subjectBox
          ? subjectBox.width >= 120 && subjectBox.height >= 24 && subjectBox.top >= box.top
          : false,
        editorHeight: editorBox ? Math.round(editorBox.height) : 0,
        editorOverflowY: editor ? getComputedStyle(editor).overflowY : '',
        toolbarOverflowX: toolbar ? toolbar.scrollWidth > toolbar.clientWidth + 2 : true,
        toolbarHeight: toolbarBox ? Math.round(toolbarBox.height) : 0,
        toolbarButtonMinHeight: toolbar
          ? Math.min(
              ...Array.from(toolbar.querySelectorAll('.toolbar-btn')).map(button =>
                Math.round(button.getBoundingClientRect().height)
              )
            )
          : 0
      };
    });

    expect(overlayMetrics.fitsViewport).toBe(true);
    expect(overlayMetrics.width).toBeLessThanOrEqual(390);
    expect(overlayMetrics.height).toBeLessThanOrEqual(667);
    expect(overlayMetrics.mainOverflowX).toBe(false);
    expect(overlayMetrics.listHeight).toBeGreaterThanOrEqual(120);
    expect(overlayMetrics.listOverflowY).toMatch(/auto|scroll/);
    expect(overlayMetrics.listScrollable).toBe(true);
    expect(overlayMetrics.subjectVisible).toBe(true);
    expect(overlayMetrics.editorHeight).toBeGreaterThanOrEqual(180);
    expect(overlayMetrics.editorOverflowY).toMatch(/auto|scroll/);
    expect(overlayMetrics.toolbarOverflowX).toBe(false);
    expect(overlayMetrics.toolbarHeight).toBeGreaterThanOrEqual(70);
    expect(overlayMetrics.toolbarButtonMinHeight).toBeGreaterThanOrEqual(32);

    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForTimeout(250);

    const compactMetrics = await mailOverlay.evaluate(panel => {
      const box = panel.getBoundingClientRect();
      const main = panel.querySelector('.supplier-mail-main') as HTMLElement | null;
      const subject = panel.querySelector('#mailSubject') as HTMLElement | null;
      const editor = panel.querySelector('#mailBody') as HTMLElement | null;
      const toolbar = panel.querySelector('.mail-form__toolbar') as HTMLElement | null;
      const sendButton = Array.from(panel.querySelectorAll('button')).find(button =>
        button.textContent?.includes('Go to Send')
      );
      const subjectBox = subject?.getBoundingClientRect();
      const editorBox = editor?.getBoundingClientRect();
      const toolbarBox = toolbar?.getBoundingClientRect();
      const sendBox = sendButton?.getBoundingClientRect();
      const sendTopElement = sendBox
        ? document.elementsFromPoint(
            sendBox.left + sendBox.width / 2,
            sendBox.top + sendBox.height / 2
          )[0]
        : null;

      return {
        fitsViewport:
          box.left >= -1 &&
          box.top >= -1 &&
          box.right <= window.innerWidth + 1 &&
          box.bottom <= window.innerHeight + 1,
        mainOverflowX: main ? main.scrollWidth > main.clientWidth + 2 : true,
        subjectVisible: subjectBox
          ? subjectBox.width >= 112 && subjectBox.height >= 24 && subjectBox.top >= box.top
          : false,
        editorHeight: editorBox ? Math.round(editorBox.height) : 0,
        toolbarOverflowX: toolbar ? toolbar.scrollWidth > toolbar.clientWidth + 2 : true,
        toolbarHeight: toolbarBox ? Math.round(toolbarBox.height) : 0,
        sendVisible: Boolean(sendTopElement?.closest('.supplier-mail-send-field'))
      };
    });

    expect(compactMetrics.fitsViewport).toBe(true);
    expect(compactMetrics.mainOverflowX).toBe(false);
    expect(compactMetrics.subjectVisible).toBe(true);
    expect(compactMetrics.editorHeight).toBeGreaterThanOrEqual(160);
    expect(compactMetrics.toolbarOverflowX).toBe(false);
    expect(compactMetrics.toolbarHeight).toBeGreaterThanOrEqual(70);
    expect(compactMetrics.sendVisible).toBe(true);

    const editor = mailOverlay.locator('#mailBody');
    const longBody = Array.from({ length: 32 }, (_, index) => `line ${index} mixed Case`).join(
      '\n'
    );

    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(longBody);

    const editorBeforeFormat = await editor.evaluate(node => ({
      overflowY: getComputedStyle(node).overflowY,
      scrollable: node.scrollHeight > node.clientHeight,
      text: node.textContent ?? ''
    }));

    expect(editorBeforeFormat.overflowY).toMatch(/auto|scroll/);
    expect(editorBeforeFormat.scrollable).toBe(true);
    expect(editorBeforeFormat.text).toContain('line 0 mixed Case');

    await expect(mailOverlay.getByRole('button', { name: 'Uppercase', exact: true })).toBeVisible();
    await expect(mailOverlay.getByRole('button', { name: 'Lowercase', exact: true })).toBeVisible();
    await expect(mailOverlay.getByRole('button', { name: 'A^ Uppercase' })).toHaveCount(0);
    await expect(mailOverlay.getByRole('button', { name: 'aV Lowercase' })).toHaveCount(0);

    await mailOverlay.getByRole('button', { name: 'Uppercase' }).click();
    await expect
      .poll(async () => editor.evaluate(node => node.textContent ?? ''))
      .toContain('LINE 0 MIXED CASE');

    await mailOverlay.getByRole('button', { name: 'Undo' }).click();
    await expect
      .poll(async () => editor.evaluate(node => node.textContent ?? ''))
      .toContain('line 0 mixed Case');

    await mailOverlay.getByRole('button', { name: 'Redo' }).click();
    await expect
      .poll(async () => editor.evaluate(node => node.textContent ?? ''))
      .toContain('LINE 0 MIXED CASE');

    await page.evaluate(() => {
      const store = window as Window & { __outlookWebUrls?: string[] };
      store.__outlookWebUrls = [];
      window.open = ((url?: string | URL) => {
        store.__outlookWebUrls?.push(String(url ?? ''));
        return { opener: null } as Window;
      }) as typeof window.open;
    });

    await sendOptionsTrigger.click();
    await mailOverlay.getByRole('menuitem', { name: /Send via Outlook Web/i }).click();

    const openedOutlookUrl = await page.evaluate(
      () => (window as Window & { __outlookWebUrls?: string[] }).__outlookWebUrls?.[0] ?? ''
    );
    const openedOutlookParams = new URL(openedOutlookUrl).searchParams;
    expect(openedOutlookUrl).toContain('https://outlook.office.com/mail/deeplink/compose');
    expect(openedOutlookParams.get('subject')).toBe('ENGINEERS_SALARY_REFERENCE Suppliers');
    expect(openedOutlookParams.get('bcc')).toContain(state.officials[0].email);
    await expect(mailOverlay).toBeHidden();
  });

  test('should keep the supplier visible when filtering by a secondary material category', async ({
    page
  }) => {
    const state = buildMultiConnectionScenarioState();
    await installScenarioApiMock(page, state);
    await gotoSuppliersPage(page);

    const materialHeader = page.getByRole('columnheader', { name: /Material Category/i });
    await materialHeader.click({ button: 'right' });

    const columnMenu = page.locator('.column-context-menu').last();
    await expect(columnMenu).toBeVisible();
    await columnMenu
      .locator('.context-menu-item.has-submenu')
      .filter({ hasText: 'Filter' })
      .hover();
    const filterSubmenu = page.locator('.column-context-submenu[data-submenu="filter"]').last();
    await expect(filterSubmenu).toBeVisible();
    await filterSubmenu.getByText('Open Filter Panel', { exact: true }).click();

    const filterPanel = page.locator('.proj-filter-menu-list').last();
    await expect(filterPanel).toBeVisible();
    const valueInput = filterPanel.locator('.proj-filter-value-select .ss-inline-input').last();
    await valueInput.click();
    await valueInput.fill('Chillers');
    const valueOption = page
      .locator('.ss-panel .ss-item')
      .filter({ hasText: 'Chillers' })
      .last();
    await expect(valueOption).toBeVisible();
    await valueOption.click();
    await page.keyboard.press('Escape');

    await expect(
      page.getByRole('button', { name: /supplier:\s*Carrier Kuwait Air Conditioning/i })
    ).toHaveCount(1);
  });
});
