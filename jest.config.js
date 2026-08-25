/** @type {import('jest').Config} */
module.exports = {
    preset: 'jest-preset-angular',
    setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
    testEnvironment: 'jsdom',
    moduleNameMapper: {
        '^@core/(.*)$': '<rootDir>/src/app/core/$1',
        '^@shared/(.*)$': '<rootDir>/src/app/shared/$1',
        '^@store/(.*)$': '<rootDir>/src/app/store/$1',
        '^@features/(.*)$': '<rootDir>/src/app/features/$1',
        '^@testing/(.*)$': '<rootDir>/src/testing/$1'
    },
    collectCoverageFrom: ['src/app/**/*.ts', '!src/app/**/*.spec.ts'],
    coverageThreshold: {
        global: {
            lines: 80,
            statements: 80
        }
    }
};
