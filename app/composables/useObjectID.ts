import ObjectId from 'bson-objectid';
// Function to generate a MongoDB-like ObjectId

export default function useObjectID() {
  const objectId = new ObjectId();
  return objectId.toHexString();
}
