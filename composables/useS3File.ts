import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Upload file to AWS S3
const useS3File = async (fileName: string) => {
  const runtimeConfig = useRuntimeConfig()

  const client = new S3Client({
    region: runtimeConfig.public.AWS_BUCKET_REGION,
    credentials: {
      accessKeyId: runtimeConfig.public.AWS_ACCESS_KEY_ID,
      secretAccessKey: runtimeConfig.public.AWS_SECRET_ACCESS_KEY
    }
  })

  const command = new GetObjectCommand({
    Bucket: runtimeConfig.public.AWS_BUCKET_NAME,
    Key: fileName
  })

  const response = await client.send(command)
  const str = await response.Body?.transformToString()
  return str
}

export default useS3File
