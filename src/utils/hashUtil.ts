import crypto from 'crypto';

/**
 * Calculates the SHA-256 hash of a buffer.
 * @param buffer The input buffer.
 * @returns The SHA-256 hash as a hexadecimal string.
 */
export function calculateSha256(buffer: Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(buffer);
    return hash.digest('hex');
}

// Example usage (optional, can be removed)
// const myBuffer = Buffer.from('This is a test buffer');
// const myHash = calculateSha256(myBuffer);
// console.log(`SHA-256 hash: ${myHash}`);
