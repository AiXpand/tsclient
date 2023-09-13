import { describe, expect, test } from '@jest/globals';
import { DataCaptureThread } from './data.capture.thread.decorator';

describe('Data Capture Thread Decorator Tests', () => {
    test('@DataCaptureThread() basic config', () => {
        @DataCaptureThread()
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const isDataCaptureThread = Reflect.getMetadata('data-capture-thread', mockObj.constructor);

        expect(isDataCaptureThread).toEqual(true);
    });
});
