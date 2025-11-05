import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import http from 'http';
import initializeSocket from '../../socket';
import prisma from '../../database/prisma';
import { generateAccessToken } from '../../auth/jwt';

describe('WebRTC/MediaSoup Integration Tests', () => {
  let httpServer: http.Server;
  let io: Server;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let testUser1: any;
  let testUser2: any;
  let testBroadcast: any;
  let token1: string;
  let token2: string;

  beforeAll((done) => {
    // Create HTTP server and Socket.IO instance
    httpServer = http.createServer();
    io = initializeSocket(httpServer);

    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;

      // Create test users and broadcast
      Promise.all([
        prisma.user.create({
          data: {
            email: 'host@webrtc.test',
            name: 'Host User',
            planType: 'core',
          },
        }),
        prisma.user.create({
          data: {
            email: 'guest@webrtc.test',
            name: 'Guest User',
            planType: 'free',
          },
        }),
      ]).then(([user1, user2]) => {
        testUser1 = user1;
        testUser2 = user2;
        token1 = generateAccessToken({ userId: user1.id, email: user1.email });
        token2 = generateAccessToken({ userId: user2.id, email: user2.email });

        return prisma.broadcast.create({
          data: {
            userId: user1.id,
            title: 'WebRTC Test Stream',
            status: 'live',
            startedAt: new Date(),
          },
        });
      }).then((broadcast) => {
        testBroadcast = broadcast;

        // Create participants
        return Promise.all([
          prisma.participant.create({
            data: {
              broadcastId: broadcast.id,
              userId: testUser1.id,
              name: 'Host User',
              role: 'host',
              status: 'joined',
            },
          }),
          prisma.participant.create({
            data: {
              broadcastId: broadcast.id,
              userId: testUser2.id,
              name: 'Guest User',
              role: 'guest',
              status: 'invited',
            },
          }),
        ]);
      }).then(() => {
        // Connect client sockets
        clientSocket1 = ioClient(`http://localhost:${port}`, {
          auth: { token: token1 },
        });
        clientSocket2 = ioClient(`http://localhost:${port}`, {
          auth: { token: token2 },
        });

        Promise.all([
          new Promise((resolve) => clientSocket1.on('connect', resolve)),
          new Promise((resolve) => clientSocket2.on('connect', resolve)),
        ]).then(() => done());
      });
    });
  });

  afterAll((done) => {
    io.close();
    clientSocket1.disconnect();
    clientSocket2.disconnect();
    httpServer.close(done);
  });

  describe('Studio Connection', () => {
    it('should allow host to join studio', (done) => {
      clientSocket1.emit('join-studio', {
        broadcastId: testBroadcast.id,
        participantId: testUser1.id,
      });

      clientSocket1.on('studio-joined', (data) => {
        expect(data).toHaveProperty('broadcastId', testBroadcast.id);
        expect(data).toHaveProperty('participants');
        expect(data.participants).toBeInstanceOf(Array);
        done();
      });
    });

    it('should allow guest to join studio', (done) => {
      clientSocket2.emit('join-studio', {
        broadcastId: testBroadcast.id,
        participantId: testUser2.id,
      });

      clientSocket2.on('studio-joined', (data) => {
        expect(data).toHaveProperty('broadcastId', testBroadcast.id);
        done();
      });
    });

    it('should notify other participants when someone joins', (done) => {
      const socket3 = ioClient(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: token2 },
      });

      clientSocket1.on('participant-joined', (data) => {
        expect(data).toHaveProperty('participantId');
        expect(data).toHaveProperty('name');
        socket3.disconnect();
        done();
      });

      socket3.on('connect', () => {
        socket3.emit('join-studio', {
          broadcastId: testBroadcast.id,
          participantId: testUser2.id,
        });
      });
    });
  });

  describe('Media State Management', () => {
    it('should broadcast media state changes', (done) => {
      clientSocket2.on('media-state-changed', (data) => {
        expect(data).toMatchObject({
          participantId: testUser1.id,
          audio: false,
          video: true,
        });
        done();
      });

      clientSocket1.emit('media-state-changed', {
        participantId: testUser1.id,
        audio: false,
        video: true,
      });
    });

    it('should handle participant ready signal', (done) => {
      clientSocket1.emit('participant-ready', {
        participantId: testUser1.id,
        mediaCapabilities: {
          audio: true,
          video: true,
          screen: false,
        },
      });

      setTimeout(() => {
        // Should not throw error
        done();
      }, 100);
    });

    it('should notify when participant mutes audio', (done) => {
      clientSocket2.on('media-state-changed', (data) => {
        expect(data.audio).toBe(false);
        done();
      });

      clientSocket1.emit('media-state-changed', {
        participantId: testUser1.id,
        audio: false,
        video: true,
      });
    });

    it('should notify when participant turns off video', (done) => {
      clientSocket2.on('media-state-changed', (data) => {
        expect(data.video).toBe(false);
        done();
      });

      clientSocket1.emit('media-state-changed', {
        participantId: testUser1.id,
        audio: true,
        video: false,
      });
    });
  });

  describe('Layout Management', () => {
    it('should broadcast layout updates', (done) => {
      const newLayout = {
        type: 'grid',
        participants: [
          { id: testUser1.id, position: { x: 0, y: 0, width: 960, height: 540 } },
          { id: testUser2.id, position: { x: 960, y: 0, width: 960, height: 540 } },
        ],
      };

      clientSocket2.on('layout-updated', (data) => {
        expect(data).toEqual(newLayout);
        done();
      });

      clientSocket1.emit('layout-updated', newLayout);
    });

    it('should broadcast participant position changes', (done) => {
      clientSocket2.on('participant-position-changed', (data) => {
        expect(data).toMatchObject({
          participantId: testUser1.id,
          position: { x: 100, y: 100, width: 800, height: 600 },
        });
        done();
      });

      clientSocket1.emit('participant-position-changed', {
        participantId: testUser1.id,
        position: { x: 100, y: 100, width: 800, height: 600 },
      });
    });
  });

  describe('WebRTC Signaling', () => {
    it('should relay WebRTC offer', (done) => {
      const mockOffer = {
        type: 'offer',
        sdp: 'mock-sdp-offer',
      };

      clientSocket2.on('webrtc-offer', (data) => {
        expect(data.from).toBe(testUser1.id);
        expect(data.offer).toEqual(mockOffer);
        done();
      });

      clientSocket1.emit('webrtc-offer', {
        to: testUser2.id,
        offer: mockOffer,
      });
    });

    it('should relay WebRTC answer', (done) => {
      const mockAnswer = {
        type: 'answer',
        sdp: 'mock-sdp-answer',
      };

      clientSocket1.on('webrtc-answer', (data) => {
        expect(data.from).toBe(testUser2.id);
        expect(data.answer).toEqual(mockAnswer);
        done();
      });

      clientSocket2.emit('webrtc-answer', {
        to: testUser1.id,
        answer: mockAnswer,
      });
    });

    it('should relay ICE candidates', (done) => {
      const mockCandidate = {
        candidate: 'mock-ice-candidate',
        sdpMLineIndex: 0,
        sdpMid: 'video',
      };

      clientSocket2.on('ice-candidate', (data) => {
        expect(data.from).toBe(testUser1.id);
        expect(data.candidate).toEqual(mockCandidate);
        done();
      });

      clientSocket1.emit('ice-candidate', {
        to: testUser2.id,
        candidate: mockCandidate,
      });
    });
  });

  describe('Screen Sharing', () => {
    it('should notify when screen sharing starts', (done) => {
      clientSocket2.on('screen-share-started', (data) => {
        expect(data.participantId).toBe(testUser1.id);
        done();
      });

      clientSocket1.emit('screen-share-started', {
        participantId: testUser1.id,
      });
    });

    it('should notify when screen sharing stops', (done) => {
      clientSocket2.on('screen-share-stopped', (data) => {
        expect(data.participantId).toBe(testUser1.id);
        done();
      });

      clientSocket1.emit('screen-share-stopped', {
        participantId: testUser1.id,
      });
    });
  });

  describe('Participant Lifecycle', () => {
    it('should notify when participant leaves', (done) => {
      clientSocket1.on('participant-left', (data) => {
        expect(data).toHaveProperty('participantId');
        done();
      });

      clientSocket2.emit('leave-studio', {
        broadcastId: testBroadcast.id,
        participantId: testUser2.id,
      });
    });

    it('should handle participant disconnect', (done) => {
      const socket3 = ioClient(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token: token2 },
      });

      socket3.on('connect', () => {
        socket3.emit('join-studio', {
          broadcastId: testBroadcast.id,
          participantId: testUser2.id,
        });
      });

      clientSocket1.on('participant-left', (data) => {
        expect(data.participantId).toBe(testUser2.id);
        done();
      });

      socket3.on('studio-joined', () => {
        socket3.disconnect();
      });
    });
  });

  describe('Broadcast Controls', () => {
    it('should notify all participants when broadcast starts', (done) => {
      clientSocket2.on('broadcast-status', (data) => {
        expect(data.status).toBe('live');
        done();
      });

      clientSocket1.emit('start-broadcast', {
        broadcastId: testBroadcast.id,
      });
    });

    it('should notify all participants when broadcast ends', (done) => {
      clientSocket2.on('broadcast-status', (data) => {
        expect(data.status).toBe('ended');
        done();
      });

      clientSocket1.emit('end-broadcast', {
        broadcastId: testBroadcast.id,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid broadcast ID', (done) => {
      clientSocket1.emit('join-studio', {
        broadcastId: 'invalid-id',
        participantId: testUser1.id,
      });

      clientSocket1.on('error', (data) => {
        expect(data).toHaveProperty('message');
        done();
      });
    });

    it('should handle unauthorized access', (done) => {
      const unauthorizedSocket = ioClient(`http://localhost:${(httpServer.address() as any).port}`);

      unauthorizedSocket.on('connect_error', (error) => {
        expect(error.message).toContain('unauthorized');
        unauthorizedSocket.disconnect();
        done();
      });
    });
  });
});
