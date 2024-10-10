function mergeArrays(arr1: any[], arr2: any[]): any[] {
  const mergedArray: any[] = [...arr1];
  const idSet: Set<string> = new Set(arr1.map(item => item?._id));

  for (const item of arr2) {
    const itemId = item?._id || item?.id;
    if (!idSet.has(itemId)) {
      mergedArray.push(item);
      idSet.add(item?.itemId);
    }
  }

  return mergedArray;
}

export default mergeArrays;