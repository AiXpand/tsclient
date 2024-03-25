import { beforeAll, describe, expect, test } from '@jest/globals';
import { AiXpBC } from './aixp.bc';
import { Buffer } from 'node:buffer';
import { base64ToUrlSafeBase64 } from './aixp.helper.functions';

describe('AiXpand Blockchain Tests', () => {
    let mockAiXpandBCEngine;

    beforeAll(() => {
        mockAiXpandBCEngine = new AiXpBC({
            debug: false,
            key: '308184020100301006072a8648ce3d020106052b8104000a046d306b020101042054bf5b9c2e0df0bcb2bbfc250df7a561b3443562851800d087434af937bec0ffa144034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f',
        });
    });

    test('sign', () => {
        const message = {
            SERVER: 'gts-test',
            COMMAND: 'UPDATE_CONFIG',
            PAYLOAD: { GIGI: 'BUNA' },
        };

        const messageToSend = JSON.parse(mockAiXpandBCEngine.sign(message));

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

    test('export as PEM', () => {
        const pem = mockAiXpandBCEngine.exportAsPem();

        console.log(pem);
    });

    test('KeyObject to EC KeyPair Conversion', () => {
        const hexString =
            '308184020100301006072a8648ce3d020106052b8104000a046d306b020101042054bf5b9c2e0df0bcb2bbfc250df7a561b3443562851800d087434af937bec0ffa144034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f';
        const { privateKey: privateKeyObject, publicKey: publicKeyObject } = AiXpBC.deriveKeyPairFromDERHex(hexString);
        const ecKeyPair = AiXpBC.privateKeyObjectToECKeyPair(privateKeyObject);

        const addressFromPublicKeyObject = AiXpBC.compressPublicKeyObject(publicKeyObject);

        const compressedECKeyPair = ecKeyPair.getPublic(true, 'hex');
        const pkb64 = Buffer.from(compressedECKeyPair, 'hex').toString('base64');
        const addressFromECKeyPair = base64ToUrlSafeBase64(pkb64);

        expect(addressFromECKeyPair).toEqual(addressFromPublicKeyObject);
        expect(addressFromPublicKeyObject).toEqual('A3vtcVIv_yL7k945IuhNjLUXKj2DPvbapoH4D6ZairfT');
    });

    test('decrypt', () => {
        // const encryptedMessage =  `{
        //     "EE_IS_ENCRYPTED": true,
        //     "EE_ENCRYPTED_DATA": "Fyb6xwCJNph6Khv/TYwZhBSIE9UAbUrNnOWTtZ+3h3zCio9mda/UrYVgFNRhanI1qPA+TA==",
        //     "EE_SIGN": "MEYCIQCdmfGNooo1vdxSgM94Qe5f3FNf0RxHWcQBt_dPqfwvLAIhAISWV5lBZOX2H0C_ue9nMuS0bjDuFZtFRx7duWkXrfl5",
        //     "EE_SENDER": "aixp_AwwqvbL_Fw3y0MQzllx69JZSLYT3ybF9zanfrmcgAlEp",
        //     "EE_HASH": "f21dbbfb1630f4c508ca6034c5322dfe093f15f5878767f565be2fa4a016299b"
        // }`;

        // const encryptedMessage = `{
        //     "EE_ENCRYPTED_DATA": true,
        //     "ENCRYPTED_DATA": "Fyb6xwCJNph6Khv/TYwZhBSIE9UAbUrNnOWTtZ+3h3zCio9mda/UrYVgFNRhanI1qPA+TA==",
        //     "EE_SIGN": "MEYCIQCdmfGNooo1vdxSgM94Qe5f3FNf0RxHWcQBt_dPqfwvLAIhAISWV5lBZOX2H0C_ue9nMuS0bjDuFZtFRx7duWkXrfl5",
        //     "EE_SENDER": "aixp_AwwqvbL_Fw3y0MQzllx69JZSLYT3ybF9zanfrmcgAlEp",
        //     "EE_HASH": "f21dbbfb1630f4c508ca6034c5322dfe093f15f5878767f565be2fa4a016299b"
        //   }`;

        const encryptedMessage = `{
            "EE_ENCRYPTED_DATA": true,
            "ENCRYPTED_DATA": "Fyb6xwCJNph6Khv/TYwZhBSIE9UAbUrNnOWTtZ+3h3zCio9mda/UrYVgFNRhanI1qPA+TA==",
            "EE_SIGN": "MEQCIH4xIEdictabdLpy+wZ5uvSe9GhYUAHGm/uh5Uni6XfIAiAqA1FCKJtamgZVA4grE6EZ9j6DukwPj7nfmwg5oN9VWg==",
            "EE_SENDER": "aixp_A7Bpaqg6AN2INZLTVFcAPMU30ZZjckS0_o4nsJVazZWC",
            "EE_HASH": "f21dbbfb1630f4c508ca6034c5322dfe093f15f5878767f565be2fa4a016299b"
          }`;


        const verif = mockAiXpandBCEngine.verify(encryptedMessage);
        expect(verif).toEqual(true);

        // const asObject = JSON.parse(encryptedMessage);
        // const data = mockAiXpandBCEngine.decrypt(asObject['EE_ENCRYPTED_DATA'], asObject['EE_SENDER']);
        //
        // expect(data).toEqual('{"value": "Hello World"}');
    });

    test('encrypt', () => {
        const data = '{"value": "Hello World"}';
        const destinationAddress = 'aixp_A3vtcVIv_yL7k945IuhNjLUXKj2DPvbapoH4D6ZairfT';

        const encryptedData = mockAiXpandBCEngine.encrypt(data, destinationAddress);
        const decryptedData = mockAiXpandBCEngine.decrypt(encryptedData, destinationAddress);

        expect(decryptedData).toEqual(data);
    });
});
