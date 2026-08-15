module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@models': './src/models',
            '@services': './src/services',
            '@components': './src/components',
            '@screens': './src/screens',
            '@store': './src/store',
            '@hooks': './src/hooks',
            '@theme': './src/theme',
            '@config': './src/config',
          },
        },
      ],
      // react-native-reanimated/plugin MUST be last.
      'react-native-reanimated/plugin',
    ],
  };
};
