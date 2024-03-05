import * as crypto from 'crypto';
import * as fs from 'fs';
import * as elliptic from 'elliptic';
import * as asn1 from 'asn1.js';
import stringify from 'json-stable-stringify';
import { base64ToUrlSafeBase64, urlSafeBase64ToBase64 } from './aixp.helper.functions';
import { AiXpandException } from '../aixpand.exception';
import { Buffer } from "node:buffer";

const ec = new elliptic.ec('secp256k1');

const EE_SIGN = 'EE_SIGN';
const EE_SENDER = 'EE_SENDER';
const EE_HASH = 'EE_HASH';
const ADDR_PREFIX = 'aixp_';
const NON_DATA_FIELDS = [EE_SIGN, EE_SENDER, EE_HASH];
const SPKI = asn1.define('SPKI', function () {
    this.seq().obj(
        this.key('algorithm').seq().obj(this.key('id').objid(), this.key('namedCurve').objid()),
        this.key('publicKey').bitstr(),
    );
});

export type AiXpandBlockchainOptions = {
    fromFile: boolean;
    filePath?: string;
    keyPair?: {
        publicKey: string;
        privateKey: string;
    } | null;
    debugMode?: boolean;
};

export class AiXpBC {
    private keyPair: { publicKey: Buffer; privateKey: crypto.KeyObject | Buffer };
    private readonly compressedPublicKey: string;
    private readonly debugMode: boolean;

    constructor(options: AiXpandBlockchainOptions) {
        if (options.fromFile) {
            this.keyPair = this.loadOrCreateKeys(options.filePath);
        } else if (options.keyPair && options.keyPair.privateKey && options.keyPair.publicKey) {
            this.keyPair = this.parseKeys(options.keyPair);
        } else {
            this.keyPair = this.generateAndSaveKeys();
        }
        this.debugMode = options.debugMode || false;
        this.compressedPublicKey = this.constructCompressedPublicKey();
        if (this.debugMode) {
            console.log('AiXpand Blockchain address: ' + this.getAddress());
        }
    }
    
    static generateKeys() {
        return crypto.generateKeyPairSync('ec', {
            namedCurve: 'secp256k1',
            publicKeyEncoding: {
                type: 'spki',
                format: 'der',
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'der',
            },
        });
    }

    static compressPublicKey(publicKey: Buffer): string {
        const publicKeyBytes = SPKI.decode(publicKey, 'der').publicKey.data;
        const compressedPublicKeyB64 = Buffer.from(
            ec.keyFromPublic(publicKeyBytes, 'hex').getPublic(true, 'hex'),
            'hex',
        ).toString('base64');

        return base64ToUrlSafeBase64(compressedPublicKeyB64);
    }

    static addressFromPublicKey(publicKey: Buffer): string {
        return ADDR_PREFIX + AiXpBC.compressPublicKey(publicKey);
    }

    getPublicKeyDER(): string {
        return this.keyPair.publicKey.toString('hex');
    }

    getPrivateKey(): crypto.KeyObject | Buffer {
        return this.keyPair.privateKey;
    }

    getAddress(): string {
        return ADDR_PREFIX + this.compressedPublicKey;
    }

    getHash(input: string | object) {
        let inputString;

        if (typeof input === 'object') {
            inputString = stringify(input);
        } else if (typeof input === 'string') {
            inputString = input;
        } else {
            throw new AiXpandException('Unsupported input type. Input must be a string or object.');
        }

        // Hash the input string
        const strDigest = crypto.createHash('sha256').update(inputString).digest('hex');
        const binDigest = Buffer.from(strDigest, 'hex');

        return {
            strHash: strDigest,
            binHash: binDigest,
        };
    }

    sign(input: string | object, format = 'json'): string | object {
        const { binHash } = this.getHash(input);
        const signatureB64 = this.signHash(binHash);

        return this.prepareMessage(input, signatureB64, format);
    }

    verify(fullJSONMessage: string): boolean {
        let hashResult = false;
        let signatureResult = false;
        let objReceived;

        try {
            objReceived = JSON.parse(fullJSONMessage);
        } catch (e) {
            return false;
        }

        const signatureB64 = objReceived[EE_SIGN];
        const pkB64 = objReceived[EE_SENDER] ? objReceived[EE_SENDER].replace(ADDR_PREFIX, '') : null;
        const receivedHash = objReceived[EE_HASH];
        const objData = Object.fromEntries(
            Object.entries(objReceived).filter(([key]) => !NON_DATA_FIELDS.includes(key)),
        );
        const strData = stringify(objData);
        const hash = crypto.createHash('sha256').update(strData).digest();
        const hashHex = hash.toString('hex');

        if (hashHex != receivedHash) {
          hashResult = false;          
          if (this.debugMode) {
            console.log(
              "Hashes do not match or public key is missing:\n",
              "  Computed: " + hashHex + "\n",
              "  Received: " + receivedHash + "\n", 
              "  Public key:" + pkB64 + "\n",
              "  Data: " + JSON.stringify(objData) + "\n",
              "  Stringify: '" + strData + "'",
            );  
          }
        }
        else {
          hashResult = true;
        }

        if (pkB64) {
            const signatureBuffer = Buffer.from(urlSafeBase64ToBase64(signatureB64), 'base64');
            const uncompressedPublicKeyHex = ec
                .keyFromPublic(Buffer.from(urlSafeBase64ToBase64(pkB64), 'base64').toString('hex'), 'hex')
                .getPublic(false, 'hex');

            // Manually create DER formatted public key
            const publicKeyDerManual = '3056301006072a8648ce3d020106052b8104000a034200' + uncompressedPublicKeyHex;
            const publicKeyObj = crypto.createPublicKey({
                key: Buffer.from(publicKeyDerManual, 'hex'),
                format: 'der',
                type: 'spki',
            });

            signatureResult = crypto.verify(
                null,
                hash,
                {
                    key: publicKeyObj,
                    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                },
                signatureBuffer,
            );

            if (this.debugMode) {
                console.log('Verify local hash: ' + signatureResult);
                const bHash = Buffer.from(receivedHash, 'hex');
                const signatureRecvResult = crypto.verify(
                    null,
                    bHash,
                    {
                        key: publicKeyObj,
                        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
                    },
                    signatureBuffer,
                );

                if (signatureRecvResult) {
                    console.log(
                        'Signature is valid for received hash & signature meaning that the public key is valid as well as the signature. Most likely someone or something modified the payload',
                    );
                } else {
                    console.log('Verify ONLY on received hash & signature FAILED: ' + signatureRecvResult);
                }
            }
        }
        return hashResult && signatureResult;
    }

    // TODO:
    encrypt(message, destinationAddress) {
        // encrypt key: own private-key + destination public-key
    }

    // TODO:
    decrypt(message, sourceAddress) {
        // decrypt key: own private-key + source public-key
    }

    private loadOrCreateKeys(filePath) {
        try {
            const savedKeys = fs.readFileSync(filePath, { encoding: 'utf8' });

            return this.parseKeys(JSON.parse(savedKeys));
        } catch (error) {
            return this.generateAndSaveKeys(filePath);
        }
    }

    private parseKeys(parsedKeys: { publicKey: string; privateKey: string }) {
        return {
            publicKey: Buffer.from(parsedKeys.publicKey, 'hex'),
            privateKey: this.createPrivateKey(Buffer.from(parsedKeys.privateKey, 'hex')),
        };
    }

    private createPrivateKey(buffer: Buffer): crypto.KeyObject {
        return crypto.createPrivateKey({
            key: buffer,
            format: 'der',
            type: 'pkcs8',
        });
    }

    private generateAndSaveKeys(filePath?: string) {
        const keyPair = AiXpBC.generateKeys();

        if (filePath) {
            const savedKeys = {
                publicKey: keyPair.publicKey.toString('hex'),
                privateKey: keyPair.privateKey.toString('hex'),
            };

            fs.writeFileSync(filePath, JSON.stringify(savedKeys, null, 2), { encoding: 'utf8' });
        }

        return keyPair;
    }

    private constructCompressedPublicKey(): string {
        return AiXpBC.compressPublicKey(this.keyPair.publicKey);
    }

    private signHash(binHash: Buffer): string {
        const signature = crypto.sign(null, binHash, {
            // @ts-ignore
            key: this.getPrivateKey(),
            format: 'der',
            type: 'pkcs8',
        });

        return base64ToUrlSafeBase64(signature.toString('base64'));
    }

    private prepareMessage(input: string | object, signatureB64: string, format: string): string | object {
        const message = Object.assign({}, input, {
            [EE_SIGN]: signatureB64,
            [EE_SENDER]: this.getAddress(),
            [EE_HASH]: this.getHash(input).strHash,
        });

        if (format === 'json') {
            return JSON.stringify(message);
        } else if (format === 'object') {
            return message;
        } else {
            throw new AiXpandException('Unsupported format. Format must be either "object" or "json".');
        }
    }
}
