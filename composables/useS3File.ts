import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Upload file to AWS S3
const useS3File = async (fileName: string) => {
  const runtimeConfig = useRuntimeConfig()

  const client = new S3Client({
    region: runtimeConfig.public.CLOUD_AWS_BUCKET_REGION,
    credentials: {
      accessKeyId: runtimeConfig.public.CLOUD_AWS_ACCESS_KEY_ID,
      secretAccessKey: runtimeConfig.public.CLOUD_AWS_SECRET_ACCESS_KEY
    }
  })

  const command = new GetObjectCommand({
    Bucket: runtimeConfig.public.CLOUD_AWS_BUCKET_NAME,
    Key: fileName
  })

  const response = await client.send(command)
  const str = await response.Body?.transformToString()
  return JSON.parse(str)
}

export default useS3File
