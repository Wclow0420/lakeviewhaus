const { withAndroidManifest } = require('@expo/config-plugins');

const withPermissionDescriptions = (config) => {
  return withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults;

    if (!androidManifest.manifest) {
      androidManifest.manifest = {};
    }

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }

    if (!androidManifest.manifest['uses-feature']) {
      androidManifest.manifest['uses-feature'] = [];
    }

    // Device features — restrict to phones, portrait only
    const deviceFeatures = [
      {
        $: {
          'android:name': 'android.hardware.telephony',
          'android:required': 'true'
        }
      },
      {
        $: {
          'android:name': 'android.hardware.screen.portrait',
          'android:required': 'true'
        }
      }
    ];

    deviceFeatures.forEach(feature => {
      const exists = androidManifest.manifest['uses-feature'].find(
        f => f.$ && f.$['android:name'] === feature.$['android:name']
      );
      if (!exists) {
        androidManifest.manifest['uses-feature'].push(feature);
      }
    });

    // Permissions required by Lakeview Haus
    const permissions = [
      'android.permission.INTERNET',
      'android.permission.CAMERA',
      'android.permission.USE_BIOMETRIC',
      'android.permission.USE_FINGERPRINT',
    ];

    permissions.forEach(permission => {
      const exists = androidManifest.manifest['uses-permission'].find(
        p => p.$ && p.$['android:name'] === permission
      );
      if (!exists) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': permission }
        });
      }
    });

    console.log('withPermissionDescriptions: Android permissions and device features configured');
    return config;
  });
};

module.exports = withPermissionDescriptions;
