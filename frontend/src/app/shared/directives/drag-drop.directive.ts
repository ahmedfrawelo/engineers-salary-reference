import { Directive, Output, EventEmitter, HostListener, Input } from '@angular/core';
import { CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

type LooseValue = ReturnType<typeof JSON.parse>;
/**
 * Enhanced Drag & Drop Directive
 *
 * Wraps Angular CDK Drag & Drop with additional features
 *
 * @example
 * ```html
 * <div cdkDropList (cdkDropListDropped)="onDrop($event)">
 *   <div *ngFor="let item of items" cdkDrag>
 *     {{ item.name }}
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[appDragDrop]',
  standalone: true
})
export class DragDropDirective {
  @Input() appDragDropData: LooseValue[] = [];
  @Output() itemsReordered = new EventEmitter<LooseValue[]>();

  onDrop(event: CdkDragDrop<LooseValue[]>): void {
    if (event.previousContainer === event.container) {
      // Reorder within same list
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Transfer between lists
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    this.itemsReordered.emit(event.container.data);
  }
}

/**
 * File Drop Zone Directive
 *
 * Handles file drag & drop
 *
 * @example
 * ```html
 * <div appFileDropZone (filesDropped)="onFilesDropped($event)">
 *   Drop files here
 * </div>
 * ```
 */
@Directive({
  selector: '[appFileDropZone]',
  standalone: true,
  host: {
    '[class.file-over]': 'fileOver',
    '[class.drop-zone]': 'true'
  }
})
export class FileDropZoneDirective {
  @Output() filesDropped = new EventEmitter<File[]>();
  @Input() acceptedTypes: string[] = ['*']; // e.g., ['image/*', 'application/pdf']

  fileOver = false;

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = false;

    const files = this.getFilesFromEvent(event);
    const validFiles = this.filterFiles(files);

    if (validFiles.length > 0) {
      this.filesDropped.emit(validFiles);
    }
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = true;
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.fileOver = false;
  }

  private getFilesFromEvent(event: DragEvent): File[] {
    if (!event.dataTransfer) return [];

    const files: File[] = [];

    if (event.dataTransfer.items) {
      // Use DataTransferItemList
      for (let i = 0; i < event.dataTransfer.items.length; i++) {
        const item = event.dataTransfer.items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
    } else {
      // Use DataTransfer
      for (let i = 0; i < event.dataTransfer.files.length; i++) {
        files.push(event.dataTransfer.files[i]);
      }
    }

    return files;
  }

  private filterFiles(files: File[]): File[] {
    if (this.acceptedTypes.includes('*')) {
      return files;
    }

    return files.filter(file => {
      return this.acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          const category = type.split('/')[0];
          return file.type.startsWith(category + '/');
        }
        return file.type === type;
      });
    });
  }
}
