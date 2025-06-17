import { calculateSha256 } from './hashUtil'; // Adjust path if necessary

describe('hashUtil', () => {
  describe('calculateSha256', () => {
    it('should generate a consistent SHA-256 hash for a given buffer', () => {
      const inputBuffer = Buffer.from('Hello, World!');
      // Pre-calculated SHA-256 hash for "Hello, World!"
      const expectedHash = 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f';

      const generatedHash = calculateSha256(inputBuffer);

      expect(generatedHash).toBe(expectedHash);
    });

    it('should generate a different hash for a different buffer', () => {
      const inputBuffer1 = Buffer.from('Hello, World!');
      const inputBuffer2 = Buffer.from('Hello, Jest!');

      const hash1 = calculateSha256(inputBuffer1);
      const hash2 = calculateSha256(inputBuffer2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty buffer input', () => {
        const inputBuffer = Buffer.from('');
        // Pre-calculated SHA-256 hash for "" (empty buffer)
        const expectedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

        const generatedHash = calculateSha256(inputBuffer);

        expect(generatedHash).toBe(expectedHash);
      });
  });
});
