import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-a11y', '@storybook/addon-docs'],

  framework: {
    name: '@storybook/angular',
    options: {}
  },
  webpackFinal: async config => {
    config.performance = {
      ...config.performance,
      hints: false
    };
    return config;
  }
};

export default config;
