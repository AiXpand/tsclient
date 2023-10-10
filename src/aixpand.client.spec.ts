import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { AiXpandClient } from './aixpand.client';
import { AiXpandClientEvent, AiXpandClientOptions, AiXpandPlugin, CacheType } from './models';

const MOCK_SIGNATURE = 'MOCK_SIGNATURE';
// const MOCK_2_SIGNATURE = 'MOCK_2_SIGNATURE';

class MockPlugin extends AiXpandPlugin {
    static getSchema() {
        return {
            name: 'Mock Plugin',
            signature: MOCK_SIGNATURE,
            description: 'Mock Description',
        };
    }
}

const aixpOptions: AiXpandClientOptions = {
    mqtt: {
        protocol: 'not',
        host: 'unavailable',
        port: 0,
        username: '',
        password: '',
        session: {
            clean: true,
            clientId: null,
        },
    },
    name: 'jest-tests',
    options: {
        keyPair: {
            fromFile: false,
            publicKey: null,
            privateKey: null,
        },
        offlineTimeout: 60,
        bufferPayloadsWhileBooting: false,
        cacheType: CacheType.MEMORY,
    },
    fleet: ['test-1', 'test-2'],
    plugins: {
        [`${MOCK_SIGNATURE}`]: {
            instanceConfig: MockPlugin,
        },
    },
};

describe('AiXpand Client Tests', () => {
    let mockClient;

    beforeEach(() => {
        mockClient = new AiXpandClient(aixpOptions);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    test('getName() should return initiator name from config', () => {
        expect(mockClient.getName()).toBe('jest-tests');
    });

    test('registerMessageDecoder() should add callback for decoder type', () => {
        expect(Object.keys(mockClient['registeredMessageDecoders'])).toEqual(['cavi2']);

        mockClient.registerMessageDecoder('jest', () => {
            return 'jest-test';
        });

        expect(Object.keys(mockClient['registeredMessageDecoders'])).toEqual(['cavi2', 'jest']);
        expect(mockClient['registeredMessageDecoders']['jest']()).toEqual('jest-test');
    });

    test('getFleet() should return configured fleet.', () => {
        const expected = [
            { name: 'test-1', status: { lastSeen: null, online: false } },
            { name: 'test-2', status: { lastSeen: null, online: false } },
        ];

        expect(mockClient.getFleet()).toEqual(expected);
    });

    test('registerExecutionEngine() should add to fleet', () => {
        const newEngine = 'test-3';
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        const expectedFleet = [
            { name: 'test-1', status: { lastSeen: null, online: false } },
            { name: 'test-2', status: { lastSeen: null, online: false } },
            { name: 'test-3', status: { lastSeen: null, online: false } },
        ];

        mockClient.registerExecutionEngine(newEngine);

        expect(mockClient.getFleet()).toEqual(expectedFleet);
        expect(emitMock).toBeCalledWith(AiXpandClientEvent.AIXP_ENGINE_REGISTERED, { executionEngine: 'test-3' });
    });

    test('registerExecutionEngine() should not add to fleet if called with existing node', () => {
        const newEngine = 'test-2';
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        const expectedFleet = [
            { name: 'test-1', status: { lastSeen: null, online: false } },
            { name: 'test-2', status: { lastSeen: null, online: false } },
        ];

        mockClient.registerExecutionEngine(newEngine);

        expect(mockClient.getFleet()).toEqual(expectedFleet);
        expect(emitMock).not.toBeCalled();
    });

    test('deregisterExecutionEngine() should remove from fleet', () => {
        const engine = 'test-2';
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        const expectedFleet = [{ name: 'test-1', status: { lastSeen: null, online: false } }];

        mockClient.deregisterExecutionEngine(engine);

        expect(mockClient.getFleet()).toEqual(expectedFleet);
        expect(emitMock).toBeCalledWith(AiXpandClientEvent.AIXP_ENGINE_DEREGISTERED, { executionEngine: 'test-2' });
    });

    test('deregisterExecutionEngine() should not remove from fleet if called with non-existing node', () => {
        const newEngine = 'test-3';
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        const expectedFleet = [
            { name: 'test-1', status: { lastSeen: null, online: false } },
            { name: 'test-2', status: { lastSeen: null, online: false } },
        ];

        mockClient.deregisterExecutionEngine(newEngine);

        expect(mockClient.getFleet()).toEqual(expectedFleet);
        expect(emitMock).not.toBeCalled();
    });

    test('restartExecutionEngine() should publish RESTART', () => {
        const publishMock = jest.spyOn(AiXpandClient.prototype, 'publish').mockImplementation((eventName, data) => {
            return new Promise(() => {
                return 'done.';
            });
        });
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        const expectedMessage = {
            ACTION: 'RESTART',
        };

        mockClient.restartExecutionEngine('test-2').then((result) => {
            expect(result).toEqual('done.');
        });

        expect(publishMock).toBeCalledWith('test-2', expectedMessage);
        expect(emitMock).not.toBeCalled();
    });

    test('restartExecutionEngine() should not publish RESTART for unknown E2, should emit instead', () => {
        const publishMock = jest.spyOn(AiXpandClient.prototype, 'publish').mockImplementation((eventName, data) => {
            return new Promise(() => {
                return 'done.';
            });
        });
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        mockClient.restartExecutionEngine('test-3').then((result) => {
            expect(result).toEqual({
                data: {
                    notification: 'Unknown execution engine.',
                },
            });
        });

        expect(publishMock).not.toBeCalled();
        expect(emitMock).toBeCalledWith(AiXpandClientEvent.AIXP_EXCEPTION, {
            error: true,
            message: `Cannot restart an Execution Engine not in your fleet: "test-3"`,
        });
    });

    test('shutdownExecutionEngine() should publish STOP', () => {
        const publishMock = jest.spyOn(AiXpandClient.prototype, 'publish').mockImplementation((eventName, data) => {
            return new Promise(() => {
                return 'done.';
            });
        });
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        const expectedMessage = {
            ACTION: 'STOP',
        };

        mockClient.shutdownExecutionEngine('test-2').then((result) => {
            expect(result).toEqual('done.');
        });

        expect(publishMock).toBeCalledWith('test-2', expectedMessage);
        expect(emitMock).not.toBeCalled();
    });

    test('shutdownExecutionEngine() should not publish STOP for unknown E2, should emit instead', () => {
        const publishMock = jest.spyOn(AiXpandClient.prototype, 'publish').mockImplementation((eventName, data) => {
            return new Promise(() => {
                return 'done.';
            });
        });
        const emitMock = jest.spyOn(AiXpandClient.prototype, 'emit').mockImplementation((eventName, data) => {
            return true;
        });

        mockClient.shutdownExecutionEngine('test-3').then((result) => {
            expect(result).toEqual({
                data: {
                    notification: 'Unknown execution engine.',
                },
            });
        });

        expect(publishMock).not.toBeCalled();
        expect(emitMock).toBeCalledWith(AiXpandClientEvent.AIXP_EXCEPTION, {
            error: true,
            message: `Cannot shutdown an Execution Engine not in your fleet: "test-3"`,
        });
    });

    test('getRegisteredDCTTypes()', () => {
        const expected = [
            {
                type: 'VideoStream',
                name: 'Video Stream',
                description: 'A DCT designed to consume real-time video streams.',
            },
            {
                type: 'MetaStream',
                name: 'Meta Stream',
                description: 'A DCT designed to consume other pipelines.',
            },
            {
                type: 'SingleCropMetaStream',
                name: 'Single Crop Meta Stream',
                description: 'A DCT designed to consume a crop of other video streams.',
            },
            {
                type: 'ADummyStructStream',
                name: 'Dummy Stream',
                description: 'A dummy acquisition stream.',
            },
            {
                type: 'VideoFile',
                name: 'Video File',
                description: 'A DCT dedicated to consuming video files accessible at an URL.',
            },
            {
                type: 'VOID',
                name: 'Void',
                description: 'A DCT to be used when no acquisition is necessary.',
            },
        ];

        expect(mockClient.getRegisteredDCTTypes()).toEqual(expected);
    });

    test('getRegisteredPluginTypes()', () => {
        const expected = [
            {
                name: 'Mock Plugin',
                description: 'Mock Description',
                signature: MOCK_SIGNATURE,
            },
        ];

        expect(mockClient.getRegisteredPluginTypes()).toEqual(expected);
    });

    test('private checkHost()', () => {});
});
