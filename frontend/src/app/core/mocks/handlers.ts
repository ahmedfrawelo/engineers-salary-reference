/**
 * MSW Request Handlers
 *
 * Define mock API responses here
 */

import { http, HttpResponse, delay } from 'msw';

// Mock data generators
function generateSuppliers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `SUP-${i + 1}`,
    name: `Supplier ${i + 1}`,
    email: `supplier${i + 1}@example.com`,
    phone: `+966 50 ${String(i + 1).padStart(7, '0')}`,
    status: i % 3 === 0 ? 'Inactive' : 'Active',
    rating: Math.floor(Math.random() * 5) + 1,
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString()
  }));
}

function generateProjects(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `PRJ-${i + 1}`,
    name: `Project ${i + 1}`,
    owner: `Owner ${i + 1}`,
    status: ['Draft', 'Active', 'Archived'][i % 3],
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    deadline: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString()
  }));
}

// Request handlers
export const handlers = [
  // Suppliers
  http.get('/api/Suppliers', async () => {
    await delay(500); // Simulate network delay
    return HttpResponse.json(generateSuppliers(50));
  }),

  http.get('/api/Suppliers/:id', async ({ params }) => {
    await delay(300);
    return HttpResponse.json({
      id: params.id,
      name: `Supplier ${params.id}`,
      email: `supplier${params.id}@example.com`,
      phone: '+966 50 1234567',
      address: 'Riyadh, Saudi Arabia',
      status: 'Active',
      rating: 4,
      createdAt: new Date().toISOString()
    });
  }),

  http.post('/api/Suppliers', async ({ request }) => {
    await delay(600);
    const body = (await request.json()) as Record<string, unknown> | null;
    return HttpResponse.json(
      {
        id: `SUP-${Date.now()}`,
        ...(body ?? {}),
        createdAt: new Date().toISOString()
      },
      { status: 201 }
    );
  }),

  http.put('/api/Suppliers/:id', async ({ params, request }) => {
    await delay(600);
    const body = (await request.json()) as Record<string, unknown> | null;
    return HttpResponse.json({
      id: params.id,
      ...(body ?? {}),
      updatedAt: new Date().toISOString()
    });
  }),

  http.delete('/api/Suppliers/:id', async () => {
    await delay(400);
    return HttpResponse.json({ success: true });
  }),

  // Projects
  http.get('/api/Projects', async () => {
    await delay(500);
    return HttpResponse.json(generateProjects(30));
  }),

  http.get('/api/Projects/:id', async ({ params }) => {
    await delay(300);
    return HttpResponse.json({
      id: params.id,
      name: `Project ${params.id}`,
      owner: 'John Doe',
      status: 'Active',
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }),

  // Materials
  http.get('/api/Materials', async () => {
    await delay(400);
    return HttpResponse.json(
      Array.from({ length: 100 }, (_, i) => ({
        id: `MAT-${i + 1}`,
        name: `Material ${i + 1}`,
        category: ['Electrical', 'Plumbing', 'HVAC'][i % 3],
        unit: 'PC',
        price: Math.floor(Math.random() * 1000) + 10
      }))
    );
  }),

  // Error scenarios (for testing)
  http.get('/api/error/500', async () => {
    await delay(200);
    return HttpResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }),

  http.get('/api/error/404', async () => {
    await delay(200);
    return HttpResponse.json({ error: 'Not Found' }, { status: 404 });
  }),

  http.get('/api/error/timeout', async () => {
    await delay(35000); // Exceed timeout
    return HttpResponse.json({ data: 'This should timeout' });
  }),

  // Slow endpoint (for testing loading states)
  http.get('/api/slow', async () => {
    await delay(3000);
    return HttpResponse.json({ message: 'Slow response' });
  })
];
