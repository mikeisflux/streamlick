import { useState } from 'react';

export function useDrawers() {
  const [showDestinationsDrawer, setShowDestinationsDrawer] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [showBannerDrawer, setShowBannerDrawer] = useState(false);
  const [showBrandDrawer, setShowBrandDrawer] = useState(false);
  const [showRecordingDrawer, setShowRecordingDrawer] = useState(false);

  return {
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
  };
}
