import { promises as fs } from 'node:fs';
import * as path from 'node:path';

/**
 * Recursively copies the contents of the source folder to the destination folder (async).
 */
export async function copyFolder(src: string, dest: string): Promise<void> {
    const entries = await fs.readdir(src, { withFileTypes: true });

    await fs.mkdir(dest, { recursive: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyFolder(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}