import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImageStorageProvider } from './image-storage-provider.interface';

@Injectable()
export class LocalImageStorageProvider implements ImageStorageProvider {
  private readonly basePath: string;

  constructor(private readonly configService: ConfigService) {
    this.basePath = path.resolve(
      this.configService.get<string>('IMAGE_STORAGE_PATH') ?? './data/uploads',
    );
  }

  private resolveSafePath(storageKey: string): string {
    const normalizedKey = storageKey.replace(/\\/g, '/');
    if (
      normalizedKey.includes('..') ||
      normalizedKey.startsWith('/') ||
      path.isAbsolute(normalizedKey)
    ) {
      throw new Error('Invalid storage key');
    }

    const fullPath = path.resolve(this.basePath, normalizedKey);
    const relative = path.relative(this.basePath, fullPath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Path traversal detected');
    }

    return fullPath;
  }

  async save(storageKey: string, data: Buffer): Promise<void> {
    const fullPath = this.resolveSafePath(storageKey);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, data);
  }

  async read(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolveSafePath(storageKey);
    return readFile(fullPath);
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = this.resolveSafePath(storageKey);
    try {
      await unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await this.read(storageKey);
      return true;
    } catch {
      return false;
    }
  }
}
