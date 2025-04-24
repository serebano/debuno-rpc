import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Atomically writes JSON data to a file.
 * The data is first written to a temporary file, then renamed to the target path.
 *
 * @param filePath - The target file path.
 * @param data - The JSON-serializable data to write.
 */
export async function atomicWriteJSON(filePath: string, data: any): Promise<void> {
    // Convert the data to a pretty JSON string (or use JSON.stringify(data) for compact output)
    const jsonData = JSON.stringify(data, null, 2);

    // Create a temporary file name in the same directory as the target file.
    // Including the process ID and a timestamp helps ensure uniqueness.
    const tempFilePath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath)}.${performance.now()}.tmp`
    );

    try {
        // Write the JSON string to the temporary file.
        await fs.promises.writeFile(tempFilePath, jsonData, 'utf8');

        // Rename the temporary file to the target file.
        // The rename operation is atomic on most platforms.
        await fs.promises.rename(tempFilePath, filePath);
    } catch (error) {
        // If an error occurs, clean up the temporary file if it exists.
        try {
            await fs.promises.unlink(tempFilePath);
        } catch {
            // Ignore errors from unlinking.
        }
        throw error;
    }
}

/**
 * Reads and parses JSON data from a file.
 *
 * @param filePath - The path to the JSON file.
 * @returns The parsed JSON data.
 */
export async function readJSON(filePath: string): Promise<any> {
    const fileContent = await fs.promises.readFile(filePath.replace('file:///', '/'), 'utf8');
    return JSON.parse(fileContent);
}