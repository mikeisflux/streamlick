#!/bin/bash

# Studio Component Verification Script
STUDIO_FILE="/home/user/streamlick/frontend/src/pages/Studio.tsx"
COMPONENTS_DIR="/home/user/streamlick/frontend/src/components"

echo "========================================="
echo "STUDIO UI COMPONENT VERIFICATION REPORT"
echo "========================================="
echo ""

# Function to check component
check_component() {
    local name=$1
    local file=$2
    local import_pattern=$3
    local render_pattern=$4

    echo "[$name]"

    # Check file exists
    if [ -f "$COMPONENTS_DIR/$file" ]; then
        lines=$(wc -l < "$COMPONENTS_DIR/$file")
        echo "  ✅ File exists: $file ($lines lines)"
    else
        echo "  ❌ File missing: $file"
        return
    fi

    # Check import
    if grep -q "$import_pattern" "$STUDIO_FILE" 2>/dev/null; then
        echo "  ✅ Imported in Studio.tsx"
    else
        echo "  ⚠️  Not imported in Studio.tsx"
    fi

    # Check rendering
    if grep -q "$render_pattern" "$STUDIO_FILE" 2>/dev/null; then
        echo "  ✅ Rendered in Studio.tsx"
    else
        echo "  ⚠️  Not rendered in Studio.tsx"
    fi

    echo ""
}

echo "=== PANEL COMPONENTS ==="
echo ""
check_component "StylePanel" "StylePanel.tsx" "import.*StylePanel" "{activeRightTab === 'style'.*&&.*<StylePanel"
check_component "NotesPanel" "NotesPanel.tsx" "import.*NotesPanel" "{activeRightTab === 'notes'.*&&.*<NotesPanel"
check_component "MediaAssetsPanel" "MediaAssetsPanel.tsx" "import.*MediaAssetsPanel" "{activeRightTab === 'media'.*&&.*<MediaAssetsPanel"
check_component "PrivateChatPanel" "PrivateChatPanel.tsx" "import.*PrivateChatPanel" "{activeRightTab === 'chat'.*&&.*<PrivateChatPanel"
check_component "CommentsPanel" "CommentsPanel.tsx" "import.*CommentsPanel" "{activeRightTab === 'comments'.*&&.*<CommentsPanel"
check_component "ParticipantsPanel" "ParticipantsPanel.tsx" "import.*ParticipantsPanel" "{activeRightTab === 'people'.*&&.*<ParticipantsPanel"
check_component "RecordingControls" "RecordingControls.tsx" "import.*RecordingControls" "{activeRightTab === 'recording'.*&&"

echo "=== MODAL COMPONENTS ==="
echo ""
check_component "ClipManager" "ClipManager.tsx" "import.*ClipManager" "{showClipManager.*&&.*<ClipManager"
check_component "ProducerMode" "ProducerMode.tsx" "import.*ProducerMode" "{showProducerMode.*&&.*<ProducerMode"
check_component "SceneManager" "SceneManager.tsx" "import.*SceneManager" "{showSceneManager.*&&.*<SceneManager"

echo "=== DRAWER COMPONENTS ==="
echo ""
check_component "DestinationsPanel" "DestinationsPanel.tsx" "import.*DestinationsPanel" "showDestinationsDrawer.*onClose.*DestinationsPanel"
check_component "InviteGuestsPanel" "InviteGuestsPanel.tsx" "import.*InviteGuestsPanel" "showInviteDrawer.*onClose.*InviteGuestsPanel"
check_component "BannerEditorPanel" "BannerEditorPanel.tsx" "import.*BannerEditorPanel" "showBannerDrawer.*onClose.*BannerEditorPanel"
check_component "BrandSettingsPanel" "BrandSettingsPanel.tsx" "import.*BrandSettingsPanel" "showBrandDrawer.*onClose.*BrandSettingsPanel"

echo "=== SPECIALIZED COMPONENTS ==="
echo ""
check_component "ParticipantVideo" "ParticipantVideo.tsx" "import.*ParticipantVideo" "ParticipantVideo"
check_component "DraggableParticipant" "DraggableParticipant.tsx" "import.*DraggableParticipant" "DraggableParticipant"
check_component "ChatOverlay" "ChatOverlay.tsx" "import.*ChatOverlay" "ChatOverlay"

echo "=== CHECKING FEATURES ==="
echo ""

# Check LIVE indicator
if grep -q "animate-ping.*bg-red-400" "$STUDIO_FILE"; then
    echo "[LIVE Indicator] ✅ Present with animation"
else
    echo "[LIVE Indicator] ❌ Missing or no animation"
fi

# Check Layout bar with 9 layouts
if grep -q "\[1, 2, 3, 4, 5, 6, 7, 8, 9\].*map.*layoutId" "$STUDIO_FILE"; then
    echo "[Layout Bar] ✅ Present with 9 layouts"
else
    echo "[Layout Bar] ❌ Missing or incomplete"
fi

# Check Resolution badge
if grep -q "1080p HD" "$STUDIO_FILE"; then
    echo "[Resolution Badge] ✅ Present (1080p HD)"
else
    echo "[Resolution Badge] ❌ Missing"
fi

# Check AI Captions toggle
if grep -q "captionsEnabled" "$STUDIO_FILE"; then
    echo "[AI Captions Toggle] ✅ Present"
else
    echo "[AI Captions Toggle] ❌ Missing"
fi

# Check Clip Recording toggle
if grep -q "clipRecordingEnabled" "$STUDIO_FILE"; then
    echo "[Clip Recording Toggle] ✅ Present"
else
    echo "[Clip Recording Toggle] ❌ Missing"
fi

# Check Settings button
if grep -q "setShowSettings.*true" "$STUDIO_FILE"; then
    echo "[Settings Button] ✅ Present"
else
    echo "[Settings Button] ❌ Missing"
fi

echo ""
echo "========================================="
echo "VERIFICATION COMPLETE"
echo "========================================="
