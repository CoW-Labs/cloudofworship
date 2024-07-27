function mergeArrays(arr1: any[], arr2: any[]): any[] {
  const mergedArray: any[] = [...arr1];
  const idSet: Set<string> = new Set(arr1.map(item => item?._id));

  for (const item of arr2) {
    if (!idSet.has(item?._id)) {
      mergedArray.push(item);
      idSet.add(item?._id);
    }
  }

  return mergedArray;
}

export default mergeArrays;