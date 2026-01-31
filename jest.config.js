export default {
  projects: [
    {
      displayName: 'client',
      testMatch: ['<rootDir>/tests/client/**/*.test.js'],
      testEnvironment: 'jsdom',
      transform: {},
    },
    {
      displayName: 'server',
      testMatch: ['<rootDir>/tests/server/**/*.test.js'],
      testEnvironment: 'node',
      transform: {},
    },
  ],
};
