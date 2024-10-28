import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Upload file to AWS S3
const useS3File = async (fileName: string, progressRef: Ref<string>) => {
  const runtimeConfig = useRuntimeConfig()

  const client = new S3Client({
    region: runtimeConfig.public.AWS_BUCKET_REGION,
    // credentials: {
    //   accessKeyId: runtimeConfig.public.AWS_ACCESS_KEY_ID,
    //   secretAccessKey: runtimeConfig.public.AWS_SECRET_ACCESS_KEY
    // }
  })

  const command = new GetObjectCommand({
    Bucket: runtimeConfig.public.AWS_BUCKET_NAME,
    Key: `open/bible-versions/${fileName}`,
  })

  progressRef.value = "0"
  let loadedBytes = 0
  const response = await client.send(command)
  // const str = await response.Body?.transformToString()
  const contentLength = response.ContentLength
  const totalBytes = contentLength || 0
  const reader = response.Body?.transformToWebStream().getReader()

  const stream = new ReadableStream({
    start(controller) {
      // console.log('starting')
      function push() {
        reader?.read().then(({ done, value }) => {
          if (done) {
            controller.close();
            return;
          }
          loadedBytes += value.length;
          progressRef.value = ((loadedBytes / totalBytes) * 100).toFixed(2)
          // console.log(`Downloaded ${loadedBytes} of ${totalBytes} bytes (${((loadedBytes / totalBytes) * 100).toFixed(2)}%)`);
          controller.enqueue(value);
          push();
        }).catch(error => {
          console.error('Error in reading stream:', error);
          controller.error(error);
        });
      }

      push();
    }
  });

  const json = await new Response(stream).json()

  return json;
}

export default useS3File
