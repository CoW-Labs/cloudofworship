import imageCompression from 'browser-image-compression';

const useCompressedImage = async (image: Blob) => {
  // console.log('originalFile instanceof Blob', image instanceof Blob); // true
  // console.log(`originalFile size ${image.size / 1024 / 1024} MB`);
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  }
  try {
    const compressedFile = await imageCompression(image, options);
    // console.log('compressedFile instanceof Blob', compressedFile instanceof Blob); // true
    // console.log(`compressedFile size ${compressedFile.size / 1024 / 1024} MB`);
    // console.log('compressedFile type', URL.createObjectURL(compressedFile));
    return compressedFile;

  } catch (error) {
    throw new Error(`Error compressing image: ${error}`);
  }
}

export default useCompressedImage;