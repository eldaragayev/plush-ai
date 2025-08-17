import { Operation, EditSession } from '../types';

export class OperationStackManager {
  private operations: Operation[];
  private undoStack: Operation[][];
  private redoStack: Operation[][];
  private maxStackSize: number = 50;
  private onChangeCallback?: (ops: Operation[]) => void;

  constructor(initialOps: Operation[] = []) {
    this.operations = [...initialOps];
    this.undoStack = [];
    this.redoStack = [];
  }

  addOperation(operation: Operation): void {
    this.operations.push(operation);
    this.undoStack.push([operation]);
    this.redoStack = [];
    
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    this.notifyChange();
  }

  addOperations(operations: Operation[]): void {
    this.operations.push(...operations);
    this.undoStack.push(operations);
    this.redoStack = [];
    
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift();
    }

    this.notifyChange();
  }

  undo(): Operation[] | null {
    if (!this.canUndo()) {
      return null;
    }

    const opsToUndo = this.undoStack.pop()!;
    const undoCount = opsToUndo.length;
    
    const removedOps = this.operations.splice(
      this.operations.length - undoCount,
      undoCount
    );
    
    this.redoStack.push(removedOps);
    
    if (this.redoStack.length > this.maxStackSize) {
      this.redoStack.shift();
    }

    this.notifyChange();
    return removedOps;
  }

  redo(): Operation[] | null {
    if (!this.canRedo()) {
      return null;
    }

    const opsToRedo = this.redoStack.pop()!;
    this.operations.push(...opsToRedo);
    this.undoStack.push(opsToRedo);

    this.notifyChange();
    return opsToRedo;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  getOperations(): Operation[] {
    return [...this.operations];
  }

  getOperationsByType(type: Operation['type']): Operation[] {
    return this.operations.filter(op => op.type === type);
  }

  getLastOperationOfType(type: Operation['type']): Operation | undefined {
    const ops = this.getOperationsByType(type);
    return ops[ops.length - 1];
  }

  updateLastOperation(operation: Operation): void {
    if (this.operations.length === 0) {
      this.addOperation(operation);
      return;
    }

    const lastOp = this.operations[this.operations.length - 1];
    
    if (lastOp.type === operation.type) {
      this.operations[this.operations.length - 1] = operation;
      this.notifyChange();
    } else {
      this.addOperation(operation);
    }
  }

  replaceOperationsOfType(type: Operation['type'], operation: Operation): void {
    this.operations = this.operations.filter(op => op.type !== type);
    this.operations.push(operation);
    
    this.undoStack.push([operation]);
    this.redoStack = [];
    
    this.notifyChange();
  }

  clearOperationsOfType(type: Operation['type']): void {
    const removedOps = this.operations.filter(op => op.type === type);
    
    if (removedOps.length > 0) {
      this.operations = this.operations.filter(op => op.type !== type);
      this.undoStack.push(removedOps.map(op => ({ ...op })));
      this.redoStack = [];
      this.notifyChange();
    }
  }

  resetTool(toolType: Operation['type']): void {
    const toolOps = this.operations.filter(op => op.type === toolType);
    
    if (toolOps.length > 0) {
      this.operations = this.operations.filter(op => op.type !== toolType);
      this.undoStack.push(toolOps);
      this.redoStack = [];
      this.notifyChange();
    }
  }

  clear(): void {
    if (this.operations.length > 0) {
      this.undoStack.push([...this.operations]);
      this.operations = [];
      this.redoStack = [];
      this.notifyChange();
    }
  }

  reset(): void {
    this.operations = [];
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  onChange(callback: (ops: Operation[]) => void): void {
    this.onChangeCallback = callback;
  }

  private notifyChange(): void {
    if (this.onChangeCallback) {
      this.onChangeCallback(this.getOperations());
    }
  }

  getState(): {
    operations: Operation[];
    canUndo: boolean;
    canRedo: boolean;
    undoCount: number;
    redoCount: number;
  } {
    return {
      operations: this.getOperations(),
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length,
    };
  }

  optimizeOperations(): void {
    const optimized: Operation[] = [];
    const typeGroups = new Map<string, Operation[]>();

    for (const op of this.operations) {
      const key = `${op.type}`;
      if (!typeGroups.has(key)) {
        typeGroups.set(key, []);
      }
      typeGroups.get(key)!.push(op);
    }

    for (const [key, ops] of typeGroups.entries()) {
      if (ops.length === 1) {
        optimized.push(ops[0]);
      } else {
        const type = ops[0].type;
        
        switch (type) {
          case 'liquify':
            const liquifyOps = ops.filter(op => op.type === 'liquify');
            const allStrokes = liquifyOps.flatMap(op => op.strokes);
            
            if (allStrokes.length > 0) {
              const lastLiquifyOp = liquifyOps[liquifyOps.length - 1];
              optimized.push({
                type: 'liquify',
                strokes: allStrokes,
                freezeMaskUri: lastLiquifyOp.freezeMaskUri,
              });
            }
            break;
            
          case 'bodyParam':
          case 'faceParam':
            const paramMap = new Map();
            for (const op of ops) {
              if (op.type === 'bodyParam' || op.type === 'faceParam') {
                paramMap.set(op.key, op);
              }
            }
            optimized.push(...paramMap.values());
            break;
            
          case 'color':
            const lastColorOp = ops[ops.length - 1];
            optimized.push(lastColorOp);
            break;
            
          default:
            optimized.push(...ops);
        }
      }
    }

    this.operations = optimized;
    this.notifyChange();
  }

  clone(): OperationStackManager {
    const cloned = new OperationStackManager(this.operations);
    cloned.undoStack = this.undoStack.map(ops => [...ops]);
    cloned.redoStack = this.redoStack.map(ops => [...ops]);
    return cloned;
  }

  toJSON(): string {
    return JSON.stringify({
      operations: this.operations,
      undoStack: this.undoStack,
      redoStack: this.redoStack,
    });
  }

  static fromJSON(json: string): OperationStackManager {
    try {
      const data = JSON.parse(json);
      const manager = new OperationStackManager(data.operations || []);
      manager.undoStack = data.undoStack || [];
      manager.redoStack = data.redoStack || [];
      return manager;
    } catch (error) {
      console.error('Failed to parse operation stack:', error);
      return new OperationStackManager();
    }
  }
}