import imageCompression from 'browser-image-compression';

const IMAGE_TYPES = ['image/jpeg', 'image/png'];

export async function compressFile(file: File): Promise<File> {
  if (!IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  return imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
  });
}
