import imageCompression from 'browser-image-compression';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];

export async function compressFile(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
  });

  // browser-image-compression may return a Blob without original filename
  return new File([compressed], file.name, { type: compressed.type || file.type });
}
