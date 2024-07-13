import {ref, onMounted, onBeforeUnmount, watch, type Ref} from "vue";
import {io, Socket} from "socket.io-client";

const useScheduleWebsocket = (
  url: string,
  scheduleId: Ref<string | undefined>
) => {
  const socket = ref<Socket | null>(null);
  const currentScheduleId = ref<string | undefined>(undefined);

  const initializeSocket = () => {
    socket.value = io(url);

    socket.value.on("connect", () => {
      console.log("Connected to WebSocket server");
      if (currentScheduleId.value) {
        socket.value!.emit("join_schedule", currentScheduleId.value);
      }
    });

    socket.value.on("disconnect", () => {
      console.log("Disconnected from WebSocket server");
    });

    socket.value.on("connect_error", (error) => {
      console.error("Connection error: ", error);
    });
  };

  const cleanupSocket = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  };

  onMounted(() => {
    initializeSocket();
  });

  onBeforeUnmount(() => {
    if (currentScheduleId.value && socket.value) {
      socket.value.emit("leave_schedule", currentScheduleId.value);
    }
    cleanupSocket();
  });

  watch(
    () => scheduleId.value,
    (newScheduleId, oldScheduleId) => {
      console.log(
        "New Schedule ID:",
        newScheduleId,
        "Old Schedule ID:",
        oldScheduleId
      );
      if (socket.value && oldScheduleId) {
        socket.value.emit("leave_schedule", oldScheduleId);
      }
      if (socket.value && newScheduleId) {
        socket.value.emit("join_schedule", newScheduleId);
      }
      currentScheduleId.value = newScheduleId;
    },
    {immediate: true}
  );
};

export default useScheduleWebsocket;
