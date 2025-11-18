import { Drawer } from '../Drawer';
import { DestinationsPanel } from '../DestinationsPanel';
import { InviteGuestsPanel } from '../InviteGuestsPanel';
import { BannerEditorPanel } from '../BannerEditorPanel';
import { BrandSettingsPanel } from '../BrandSettingsPanel';
import { RecordingControls } from '../RecordingControls';

interface StudioDrawersProps {
  broadcastId: string | undefined;
  showDestinationsDrawer: boolean;
  setShowDestinationsDrawer: (show: boolean) => void;
  showInviteDrawer: boolean;
  setShowInviteDrawer: (show: boolean) => void;
  showBannerDrawer: boolean;
  setShowBannerDrawer: (show: boolean) => void;
  showBrandDrawer: boolean;
  setShowBrandDrawer: (show: boolean) => void;
  showRecordingDrawer: boolean;
  setShowRecordingDrawer: (show: boolean) => void;
  selectedDestinations: string[];
  onDestinationSelectionChange: (selected: string[]) => void;
}

export function StudioDrawers({
  broadcastId,
  showDestinationsDrawer,
  setShowDestinationsDrawer,
  showInviteDrawer,
  setShowInviteDrawer,
  showBannerDrawer,
  setShowBannerDrawer,
  showBrandDrawer,
  setShowBrandDrawer,
  showRecordingDrawer,
  setShowRecordingDrawer,
  selectedDestinations,
  onDestinationSelectionChange,
}: StudioDrawersProps) {
  return (
    <>
      <Drawer
        isOpen={showDestinationsDrawer}
        onClose={() => setShowDestinationsDrawer(false)}
        title="Streaming Destinations"
        size="lg"
      >
        <DestinationsPanel
          broadcastId={broadcastId}
          selectedDestinations={selectedDestinations}
          onSelectionChange={onDestinationSelectionChange}
        />
      </Drawer>

      <Drawer isOpen={showInviteDrawer} onClose={() => setShowInviteDrawer(false)} title="Invite Guests" size="md">
        <InviteGuestsPanel broadcastId={broadcastId || ''} />
      </Drawer>

      <Drawer
        isOpen={showBannerDrawer}
        onClose={() => setShowBannerDrawer(false)}
        title="Banner & Overlay Editor"
        size="xl"
      >
        <BannerEditorPanel />
      </Drawer>

      <Drawer isOpen={showBrandDrawer} onClose={() => setShowBrandDrawer(false)} title="Brand Settings" size="lg">
        <BrandSettingsPanel />
      </Drawer>

      <Drawer
        isOpen={showRecordingDrawer}
        onClose={() => setShowRecordingDrawer(false)}
        title="Recording Controls"
        size="md"
      >
        <RecordingControls broadcastId={broadcastId} />
      </Drawer>
    </>
  );
}
