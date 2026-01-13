package io.antmedia.enterprise.muxer;

import io.antmedia.muxer.Muxer;

/**
 * Enterprise DASHMuxer stub for StreamLick
 */
public class DASHMuxer extends Muxer {

	public DASHMuxer(String storageName, int resolution, String s3FolderPath, int time2log) {
		super(storageName, resolution, s3FolderPath, time2log);
	}

	@Override
	public String getFormat() {
		return "dash";
	}
}
