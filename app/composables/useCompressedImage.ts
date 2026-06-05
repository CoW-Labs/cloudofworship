import imageCompression from 'browser-image-compression';

const useCompressedImage = async (image: Blob) => {
  const TARGET_SIZE_BYTES = 0.5 * 1024 * 1024
  if (image.size <= TARGET_SIZE_BYTES) {
    return image
  }
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  }
  try {
    const compressedFile = await imageCompression((image as File), options);
    return compressedFile;

  } catch (error) {
    throw new Error(`Error compressing image: ${error}`);
  }
}

export default useCompressedImage;