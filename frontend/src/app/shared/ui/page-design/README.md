# PageDesign

`PageDesign` is organized around one public entrypoint and four internal slices:

- `core/`: shell component and shared toolbar/grid logic.
- `menus/`: interactive menu components such as group and filter.
- `panels/`: drawer-style panels such as columns and customize.
- `models/`: shared contracts and types.
- `styles/`: shared SCSS skin consumed by the shell.

Rules:

- Consumers import from `@shared/ui/page-design` only.
- `core` owns orchestration and composition.
- `menus` and `panels` stay focused on UI behavior.
- Shared contracts live in `models`, not in component files.
