import { useAppStore } from "~/store/app"

export const useSocket = async (scheduleId: string) => {
  const runtimeConfig = useRuntimeConfig()
  // let host = 'localhost'
  // let port = 6787
  // const promise = await useFetch('http://localhost:6788')
  // host = JSON.parse(promise.data.value as string).ip
  let socket = new WebSocket(`${process.env.NODE_ENV === 'development' ? 'ws' : 'wss'}://${runtimeConfig.public.BASE_URL?.split('://')?.[1]}/schedules?schedule_id=${scheduleId}`)
  return socket
}