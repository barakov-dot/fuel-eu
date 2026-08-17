export interface ImageStorageProvider {
  save(storageKey: string, data: Buffer): Promise<void>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
  exists(storageKey: string): Promise<boolean>;
}

export const IMAGE_STORAGE_PROVIDER = Symbol('IMAGE_STORAGE_PROVIDER');
