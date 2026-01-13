package io.antmedia.test.eRTMP;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.apache.mina.core.buffer.IoBuffer;
import org.junit.Before;
import org.junit.Test;
import org.red5.codec.AVCVideo;
import org.red5.server.net.rtmp.event.VideoData;
import org.red5.server.net.rtmp.event.VideoData.ExVideoPacketType;
import org.red5.server.net.rtmp.event.VideoData.VideoFourCC;

import io.antmedia.eRTMP.HEVCVideoEnhancedRTMP;

public class HEVCVideoEnhancedRTMPTest {

	private HEVCVideoEnhancedRTMP hevcVideo;

	@Before
	public void setUp() {
		hevcVideo = new HEVCVideoEnhancedRTMP();
	}

	@Test
	public void testCanHandleDataWithNonExVideoHeader() {
		// Test with non-extended video header (first bit is 0)
		IoBuffer data = createIoBufferWithData((byte) 0x00, (byte) 0x01);
		assertFalse(hevcVideo.canHandleData(data));

		data = createIoBufferWithData((byte) 0x00, (byte) 0x02);
		assertFalse(hevcVideo.canHandleData(data));
	}

	@Test
	public void testCanHandleDataWithExVideoHeaderAndHEVC() {
		// Test with extended video header and HEVC fourcc
		// First byte: exVideoHeader bit (0x80) + frame type + packet type
		byte firstByte = (byte) (VideoData.MASK_EX_VIDEO_TAG_HEADER | (VideoData.FLAG_FRAMETYPE_KEYFRAME << 4) | ExVideoPacketType.SEQUENCE_START.value);

		// HEVC FourCC bytes
		byte[] fourccBytes = new byte[4];
		fourccBytes[0] = (byte) (VideoFourCC.HEVC_FOURCC.value & 0xFF);
		fourccBytes[1] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 8) & 0xFF);
		fourccBytes[2] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 16) & 0xFF);
		fourccBytes[3] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 24) & 0xFF);

		IoBuffer data = createIoBufferWithData(firstByte, fourccBytes[0], fourccBytes[1], fourccBytes[2], fourccBytes[3]);
		assertTrue(hevcVideo.canHandleData(data));
	}

	@Test
	public void testCanHandleDataWithEmptyBuffer() {
		IoBuffer data = IoBuffer.allocate(0);
		assertFalse(hevcVideo.canHandleData(data));
	}

	@Test
	public void testCanHandleDataWithExVideoHeaderButNotHEVC() {
		// Test with extended video header but different codec
		byte firstByte = (byte) (VideoData.MASK_EX_VIDEO_TAG_HEADER | (VideoData.FLAG_FRAMETYPE_KEYFRAME << 4) | ExVideoPacketType.SEQUENCE_START.value);

		// Not HEVC fourcc (using 0x00000000)
		IoBuffer data = createIoBufferWithData(firstByte, (byte) 0x00, (byte) 0x00, (byte) 0x00, (byte) 0x00);
		assertFalse(hevcVideo.canHandleData(data));
	}

	@Test
	public void testGetName() {
		assertEquals("HEVC", hevcVideo.getName());
	}

	@Test
	public void testCanDropFrames() {
		assertTrue(hevcVideo.canDropFrames());
	}

	@Test
	public void testAddDataSequenceStart() {
		// Create sequence start packet
		byte firstByte = (byte) (VideoData.MASK_EX_VIDEO_TAG_HEADER | (VideoData.FLAG_FRAMETYPE_KEYFRAME << 4) | ExVideoPacketType.SEQUENCE_START.value);

		byte[] fourccBytes = new byte[4];
		fourccBytes[0] = (byte) (VideoFourCC.HEVC_FOURCC.value & 0xFF);
		fourccBytes[1] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 8) & 0xFF);
		fourccBytes[2] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 16) & 0xFF);
		fourccBytes[3] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 24) & 0xFF);

		IoBuffer data = createIoBufferWithData(firstByte, fourccBytes[0], fourccBytes[1], fourccBytes[2], fourccBytes[3],
				(byte) 0x00, (byte) 0x00, (byte) 0x00); // Some decoder config data

		assertTrue(hevcVideo.addData(data, 0));
		assertNotNull(hevcVideo.getDecoderConfiguration());
	}

	@Test
	public void testAddDataKeyframe() {
		// Create keyframe packet (CODED_FRAMES)
		byte firstByte = (byte) (VideoData.MASK_EX_VIDEO_TAG_HEADER | (VideoData.FLAG_FRAMETYPE_KEYFRAME << 4) | ExVideoPacketType.CODED_FRAMES.value);

		byte[] fourccBytes = new byte[4];
		fourccBytes[0] = (byte) (VideoFourCC.HEVC_FOURCC.value & 0xFF);
		fourccBytes[1] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 8) & 0xFF);
		fourccBytes[2] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 16) & 0xFF);
		fourccBytes[3] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 24) & 0xFF);

		IoBuffer data = createIoBufferWithData(firstByte, fourccBytes[0], fourccBytes[1], fourccBytes[2], fourccBytes[3],
				(byte) 0x00, (byte) 0x00, (byte) 0x00, (byte) 0x00); // Composition time + frame data

		assertTrue(hevcVideo.addData(data, 1000));
		assertNotNull(hevcVideo.getKeyframe());
	}

	@Test
	public void testAddDataInterframe() {
		// First add a keyframe
		byte keyframeByte = (byte) (VideoData.MASK_EX_VIDEO_TAG_HEADER | (VideoData.FLAG_FRAMETYPE_KEYFRAME << 4) | ExVideoPacketType.CODED_FRAMES.value);
		byte[] fourccBytes = new byte[4];
		fourccBytes[0] = (byte) (VideoFourCC.HEVC_FOURCC.value & 0xFF);
		fourccBytes[1] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 8) & 0xFF);
		fourccBytes[2] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 16) & 0xFF);
		fourccBytes[3] = (byte) ((VideoFourCC.HEVC_FOURCC.value >> 24) & 0xFF);

		IoBuffer keyframeData = createIoBufferWithData(keyframeByte, fourccBytes[0], fourccBytes[1], fourccBytes[2], fourccBytes[3],
				(byte) 0x00, (byte) 0x00, (byte) 0x00, (byte) 0x00);
		hevcVideo.addData(keyframeData, 1000);

		// Now add an interframe
		byte interframeByte = (byte) (VideoData.MASK_EX_VIDEO_TAG_HEADER | (VideoData.FLAG_FRAMETYPE_INTERFRAME << 4) | ExVideoPacketType.CODED_FRAMES.value);
		IoBuffer interframeData = createIoBufferWithData(interframeByte, fourccBytes[0], fourccBytes[1], fourccBytes[2], fourccBytes[3],
				(byte) 0x00, (byte) 0x00, (byte) 0x00, (byte) 0x00);

		assertTrue(hevcVideo.addData(interframeData, 1033));
		assertEquals(1, hevcVideo.getNumInterframes());
	}

	/**
	 * Helper method to create IoBuffer with given byte data
	 */
	public static IoBuffer createIoBufferWithData(byte... data) {
		return IoBuffer.wrap(data);
	}
}
