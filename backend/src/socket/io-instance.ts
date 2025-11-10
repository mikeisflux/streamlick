import { Server as SocketServer } from 'socket.io';

// Global socket.io instance
let ioInstance: SocketServer | null = null;

export function setIOInstance(io: SocketServer) {
  ioInstance = io;
}

export function getIOInstance(): SocketServer {
  if (!ioInstance) {
    throw new Error('Socket.IO instance not initialized');
  }
  return ioInstance;
}
