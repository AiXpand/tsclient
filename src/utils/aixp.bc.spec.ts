import { beforeAll, describe, expect, test } from '@jest/globals';
import { AiXpBC } from './aixp.bc';

describe('AiXpand Blockchain Tests', () => {
    let mockAiXpandBCEngine;

    beforeAll(() => {
        mockAiXpandBCEngine = new AiXpBC({
            fromFile: false,
            //debugMode: true,
            keyPair: {
                publicKey:
                    '3056301006072a8648ce3d020106052b8104000a034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f',
                privateKey:
                    '308184020100301006072a8648ce3d020106052b8104000a046d306b020101042054bf5b9c2e0df0bcb2bbfc250df7a561b3443562851800d087434af937bec0ffa144034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f',
            },
        });
    });

    test('sign', () => {
        const message = {
            SERVER: 'gts-test',
            COMMAND: 'UPDATE_CONFIG',
            PAYLOAD: { GIGI: 'BUNA' },
        };

        let messageToSend = JSON.parse(mockAiXpandBCEngine.sign(message));

        expect(messageToSend['EE_SIGN']).not.toBeNull();
        expect(messageToSend['EE_HASH']).toEqual('feca4c4882b2b0cfb872c73bda948b77048ced67b9eeae10c8bdd9028f9d20a1');
        expect(messageToSend['EE_SENDER']).toEqual('aixp_A3vtcVIv_yL7k945IuhNjLUXKj2DPvbapoH4D6ZairfT');
    });

    test('verify with good signature', () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "aixp_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINJzGzPQ==", "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"}';

        expect(mockAiXpandBCEngine.verify(receivedMessage)).toBe(true);
    });

    test('verify with bad signature', () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "aixp_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINnzGzPQ==", "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"}';

        expect(mockAiXpandBCEngine.verify(receivedMessage)).toBe(false);
    });

    test('verify with bad hash', () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "aixp_AsteqC-MZKBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEUCIH9Pm3KyxXSPgsAQ_VmvBP09k69FGJ0U9Ikd1_MgQiasAiEAx_nENZRt2DcPNLj_ReWSFczXIWyYuR9-St3eENVh6TA=", "EE_HASH": "5b5fc7b39c2cd4db70728fae3a665e7a370ceb9ef6a29f511aeb03daf50156fb"}';

        expect(mockAiXpandBCEngine.verify(receivedMessage)).toBe(false);
    });

    test('verify with bad address', () => {
        const receivedMessage =
            '{"SERVER": "gigi", "COMMAND": "get", "PARAMS": "1", "EE_SENDER": "aixp_AsteqC-MZkBK6JCkSxfM-kU46AV0MP6MxiB4K1XAcjzo", "EE_SIGN": "MEQCIBML0hRjJtzKJnaZhLwki2awVTNKE_-TanMrapmkpsI2AiADjkUb8TuKCtysAIfBwKwwPzys-48X6zB9HyINJzGzPQ==", "EE_HASH": "e00e86d172c160edc66177b0c4cbc464ababc2f1827433789e68322c6eb766ed"}';

        expect(mockAiXpandBCEngine.verify(receivedMessage)).toBe(false);
    });
});
