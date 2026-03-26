import '@testing-library/jest-dom';
import { server } from './mock/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());