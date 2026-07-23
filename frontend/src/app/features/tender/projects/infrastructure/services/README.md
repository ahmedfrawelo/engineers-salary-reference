# Projects Services

This folder contains all API services specific to the **Projects** page.

## 📁 Structure

```
projects/services/
├── projects.api.ts        # Main projects API service
├── checklists.api.ts      # Checklists for projects
├── index.ts               # Barrel export
└── README.md              # This file
```

## 🚀 Services

### TenderProjectsApi

Main service for managing tender projects with full CRUD operations.

**Methods:**
- `list(params?)` - Get all projects with pagination & filtering
- `get(id)` - Get project by ID
- `create(dto)` - Create new project
- `update(id, dto)` - Update existing project
- `remove(id)` - Delete project
- `loadAllLookups()` - Load all lookup tables

### CheckListsApi

Service for managing project checklists (tasks/todo items).

**Methods:**
- `getAll()` - Get all checklists
- `getByProjectId(projectId)` - Get checklists for specific project
- `create(dto)` - Create new checklist
- `update(id, dto)` - Update checklist
- `delete(id)` - Delete checklist
- `toggleCompleted(id)` - Toggle completion status

## 💡 Usage

```typescript
import { TenderProjectsApi, CheckListsApi } from './services';

// Or import from parent
import { TenderProjectsApi } from '../services';
```

## 🔗 API Endpoints

### Projects
- `GET /api/Projects`
- `POST /api/Projects`
- `PUT /api/Projects/{id}`
- `DELETE /api/Projects/{id}`

### CheckLists
- `GET /api/CheckLists/project/{projectId}`
- `POST /api/CheckLists`
- `PATCH /api/CheckLists/{id}/toggle`

## 📦 Shared Services

For shared services like Lookups (Countries, Owners, Statuses, etc.), import from:
```typescript
import { LookupsApi } from '../../shared/services';
```
