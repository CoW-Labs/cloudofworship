async function useDetailedFetch(url: string, progressRef: Ref<string>, options?: RequestInit) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
  let loadedBytes = 0;

  const reader = response?.body?.getReader();
  const stream = new ReadableStream({
    start(controller) {
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

  return new Response(stream, {
    headers: response.headers
  });
}

export default useDetailedFetch;