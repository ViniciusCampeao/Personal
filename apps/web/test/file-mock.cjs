/**
 * Vite turns an image import into a URL string; ts-jest would try to parse the PNG.
 * Tests only ever assert on `alt` text, so any stable string will do.
 */
module.exports = 'test-file-stub.png';
