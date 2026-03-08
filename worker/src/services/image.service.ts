import sharp from 'sharp';

/**
 * Process image: resize to width 512, convert to grayscale.
 * Returns JPEG buffer.
 */
export async function processImage(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .resize(512)
    .grayscale()
    .jpeg()
    .toBuffer();
}
