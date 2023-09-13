import { describe, expect, test } from '@jest/globals';
import { Pipeline } from './pipeline.decorator';

describe('Pipeline Decorator Tests', () => {
    test('@Pipeline() basic config', () => {
        @Pipeline()
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const isPipeline = Reflect.getMetadata('aixpand-pipeline', mockObj.constructor);

        expect(isPipeline).toEqual(true);
    });
});
