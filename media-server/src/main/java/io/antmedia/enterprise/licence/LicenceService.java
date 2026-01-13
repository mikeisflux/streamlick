package io.antmedia.enterprise.licence;

import io.antmedia.datastore.db.types.Licence;
import io.antmedia.licence.ILicenceService;
import io.antmedia.settings.ServerSettings;

/**
 * Enterprise LicenceService stub for StreamLick
 * Implements ILicenceService to satisfy Spring configuration
 */
public class LicenceService implements ILicenceService {

	private ServerSettings serverSettings;

	@Override
	public void start() {
		// StreamLick: No license validation needed
	}

	@Override
	public Licence checkLicence(String key) {
		// StreamLick: Always return valid license
		Licence licence = new Licence();
		licence.setStatus("ACTIVE");
		licence.setLicenceId("streamlick-enterprise");
		return licence;
	}

	@Override
	public void setServerSettings(ServerSettings serverSettings) {
		this.serverSettings = serverSettings;
	}

	@Override
	public Licence getLastLicenseStatus() {
		Licence licence = new Licence();
		licence.setStatus("ACTIVE");
		licence.setLicenceId("streamlick-enterprise");
		return licence;
	}

	@Override
	public boolean isLicenceSuspended() {
		return false;
	}

	@Override
	public String getLicenseType() {
		return LICENCE_TYPE_STANDARD;
	}
}
