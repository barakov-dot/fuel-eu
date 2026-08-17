import sharp from 'sharp';

export async function createTestBoardPng(
  lines: string[] = ['E10    1.799', 'DIESEL 1.679', '98     1.899'],
): Promise<Buffer> {
  const lineHeight = 48;
  const height = lines.length * lineHeight + 40;
  const svg = `
    <svg width="640" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f4f4f4"/>
      ${lines
        .map(
          (line, index) =>
            `<text x="24" y="${40 + index * lineHeight}" font-family="Arial, sans-serif" font-size="32" fill="#111">${line}</text>`,
        )
        .join('')}
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function createInvalidUploadBuffer(): Buffer {
  return Buffer.from('not-an-image');
}
