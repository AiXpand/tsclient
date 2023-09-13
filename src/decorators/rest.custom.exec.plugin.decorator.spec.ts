import { describe, expect, test } from '@jest/globals';
import { RestCustomExecPlugin } from './rest.custom.exec.plugin.decorator';

describe('Rest Custom Exec Plugin Decorator Tests', () => {
    test('@RestCustomExecPlugin() basic config', () => {
        @RestCustomExecPlugin()
        class MockClass {
            mockProp: string;
        }

        const mockObj = new MockClass();

        const isRestCustomExec = Reflect.getMetadata('is-rest-custom-exec', mockObj.constructor);

        expect(isRestCustomExec).toEqual(true);
    });
});
