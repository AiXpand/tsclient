import { describe, expect, test } from '@jest/globals';
import { DataCaptureThreadConfig } from './data.capture.thread.config.decorator';

describe('Data Capture Thread Config Decorator Tests', () => {
    test('@DataCaptureThreadConfig() basic config', () => {
        @DataCaptureThreadConfig()
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const isDataCaptureThread = Reflect.getMetadata('data-capture-thread-config', mockObj.constructor);

        expect(isDataCaptureThread).toEqual(true);
    });
});
