export const exercises: { id: string; name: string; group: string; equipment: string; sets: number; reps: number; weight: number }[];
export function storageKey(base?: string): string;
export function createLocalStore(storage: Pick<Storage, 'getItem' | 'setItem'>, base?: string, uuid?: () => string): {
  read(): any;
  export(): string;
  import(raw: string): void;
  request(url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }): Promise<{ ok: boolean; json(): Promise<any> }>;
};
