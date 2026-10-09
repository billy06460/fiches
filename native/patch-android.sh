#!/usr/bin/env bash
# Ajoute le code natif d'envoi MMS au projet Android généré par Capacitor.
set -euo pipefail
PKG_DIR="android/app/src/main/java/com/prejmarseille/missions"
mkdir -p "$PKG_DIR"
cp native/MainActivity.java native/SmsComposerPlugin.java native/MmsPduBuilder.java "$PKG_DIR/"

MANIFEST="android/app/src/main/AndroidManifest.xml"
if ! grep -q "android.permission.SEND_SMS" "$MANIFEST"; then
  sed -i 's#</manifest>#    <uses-permission android:name="android.permission.SEND_SMS" />\n    <uses-feature android:name="android.hardware.telephony" android:required="false" />\n</manifest>#' "$MANIFEST"
fi

mkdir -p android/app/src/main/res/xml
cp native/file_paths.xml android/app/src/main/res/xml/file_paths.xml

echo "--- AndroidManifest.xml ---"
cat "$MANIFEST"
