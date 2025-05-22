import { createContext, useContext, useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { serverAddress } from "../constants";

const SocketContext = createContext();

/**
 * Custom hook to use the SocketContext.
 *
 * @returns {Object} - The socket and connection status.
 */
export const useSocket = () => {
  return useContext(SocketContext);
};

/**
 * SocketProvider component to provide the socket instance and connection status
 * to the rest of the application.
 *
 * @param {Object} children - The child components that will consume the socket context.
 */
export const SocketProvider = ({ children }) => {
  const socket = useRef(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Initialize the socket connection
  useEffect(() => {
    socket.current = io(serverAddress);

    // Set connection status to true when connected
    socket.current.on("connect", () => {
      setIsSocketConnected(true);
      console.log("Socket connected:", socket.current.id);
    });

    // Set connection status to false when disconnected
    socket.current.on("disconnect", () => {
      setIsSocketConnected(false);
      console.log("Socket disconnected");
    });

    // Cleanup the socket connection on component unmount
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{ socket: socket.current, isSocketConnected }}
    >
      {children}
    </SocketContext.Provider>
  );
};
