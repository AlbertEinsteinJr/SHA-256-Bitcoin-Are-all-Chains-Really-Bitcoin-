/**
 * Domain model barrel. Every screen, service, and repository imports its types
 * from here, and the Zod schemas are reused as the API-response validators
 * (see src/services/apiClient.ts). Types are inferred from the schemas so the
 * runtime contract and the compile-time contract can never drift apart.
 */
export * from './location';
export * from './category';
export * from './vendor';
export * from './rating';
export * from './rate';
export * from './repair';
export * from './user';
export * from './fleet';
