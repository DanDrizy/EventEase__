const path = require('path');

const audioApiAndroidPath = process.env.RN_AUDIO_API_ANDROID_PATH;
const audioApiPackageRoot = path.dirname(require.resolve('react-native-audio-api/package.json'));

module.exports = {
  dependencies: {
    'react-native-audio-api': {
      platforms: {
        android: {
          sourceDir: audioApiAndroidPath
            ? path.relative(audioApiPackageRoot, audioApiAndroidPath)
            : undefined,
        },
      },
    },
  },
};
