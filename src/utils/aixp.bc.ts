import * as crypto from 'crypto';
import * as elliptic from 'elliptic';
import * as asn1 from 'asn1.js';
import stringify from 'json-stable-stringify';
import hkdf from 'futoin-hkdf';
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
        this.key('algorithm').seq().obj(
            this.key('id').objid(),
            this.key('namedCurve').objid()
        ),
        this.key('publicKey').bitstr(),
    );
});

const PKCS8 = asn1.define('PKCS8PrivateKeyInfo', function () {
    this.seq().obj(
        this.key('version').int(),
        this.key('algorithm').seq().obj(
            this.key('id').objid(),
            this.key('params').optional().any()
        ),
        this.octstr(
            this.seq(
                this.key('flag').int(),
                this.key('content').octstr(),
            ),
        ),
    );
});

export type AiXpandBlockchainOptions = {
    key: string;
    debug?: boolean;
};

export class AiXpBC {
    keyPair;

    private readonly compressedPublicKey: string;

    private readonly debugMode: boolean;

    constructor(options) {
        if (options.key) {
            this.keyPair = AiXpBC.deriveKeyPairFromDERHex(options.key);
        } else {
            this.keyPair = AiXpBC.generateKeys();
        }

        this.debugMode = options.debug || false;
        this.compressedPublicKey = AiXpBC.compressPublicKeyObject(this.keyPair.publicKey);

        if (this.debugMode) {
            console.log('AiXpand Blockchain address: ' + this.getAddress());
        }
    }

    static generateKeys() {
        return crypto.generateKeyPairSync('ec', {
            namedCurve: 'secp256k1',
        });
    }

    static deriveKeyPairFromDERHex(hexString: string) {
        const privateKeyBuffer = Buffer.from(hexString, 'hex');
        const privateKey = crypto.createPrivateKey({
            key: privateKeyBuffer,
            format: 'der',
            type: 'pkcs8'
        });

        const publicKey = crypto.createPublicKey(privateKey);
        return {
            privateKey,
            publicKey
        };
    }

    static publicKeyObjectToECKeyPair(publicKey: crypto.KeyObject) {
        const key = Buffer.from(publicKey.export({ type: 'spki', format: 'der'}));
        const publicKeyBytes = SPKI.decode(key, 'der').publicKey.data;

        return ec.keyFromPublic(publicKeyBytes, 'hex');
    }

    static privateKeyObjectToECKeyPair(privateKeyObject: crypto.KeyObject) {
        const hexPrivKey = Buffer.from(privateKeyObject.export({ type: 'pkcs8', format: 'der' }));
        const definition = PKCS8.decode(hexPrivKey, 'der');
        const privateKeyData = definition.content;

        return ec.keyFromPrivate(privateKeyData, 'hex');
    }

    static addressToECPublicKey(address: string) {
        const pkB64 = address.replace(ADDR_PREFIX, '');
        return ec.keyFromPublic(
            Buffer.from(urlSafeBase64ToBase64(pkB64), 'base64').toString('hex'),
            'hex',
        );
    }

    static compressPublicKeyObject(publicKey: crypto.KeyObject): string {
        const compressedPublicKeyB64 = Buffer.from(
            AiXpBC.publicKeyObjectToECKeyPair(publicKey).getPublic(true, 'hex'),
            'hex',
        ).toString('base64');

        return base64ToUrlSafeBase64(compressedPublicKeyB64);
    }

    static addressFromPublicKey(publicKey: crypto.KeyObject): string {
        return ADDR_PREFIX + AiXpBC.compressPublicKeyObject(publicKey);
    }

    static addressToPublicKeyUncompressed(address: string) {
        return  AiXpBC.addressToECPublicKey(address).getPublic(false, 'hex');
    }

    static addressToPublicKeyObject(address: string): crypto.KeyObject {
        const uncompressedPublicKeyHex = this.addressToPublicKeyUncompressed(address);

        // Manually create DER formatted public key
        const publicKeyDerManual = '3056301006072a8648ce3d020106052b8104000a034200' + uncompressedPublicKeyHex;
        const publicKeyObj = crypto.createPublicKey({
            key: Buffer.from(publicKeyDerManual, 'hex'),
            format: 'der',
            type: 'spki',
        });

        return publicKeyObj;
    }

    getPublicKeyDER(): string {
        return this.keyPair.publicKey.toString('hex');
    }

    getAddress(): string {
        return ADDR_PREFIX + this.compressedPublicKey;
    }

    exportAsPem() {
        // @ts-ignore
        return this.keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
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

            const publicKeyObj = AiXpBC.addressToPublicKeyObject(pkB64);

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

    encrypt(message: string, destinationAddress: string): string {
        console.log('DESTINATION ADDRESS: ', destinationAddress);


        const destinationPublicKey = AiXpBC.addressToPublicKeyObject(destinationAddress);
        const sharedKey = this.deriveSharedKey(destinationPublicKey);

        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', sharedKey, iv);
        let encrypted = cipher.update(message, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const encryptedData = Buffer.concat([iv, encrypted, cipher.getAuthTag()]);

        return encryptedData.toString('base64');
    }

    decrypt(encryptedDataB64: string, sourceAddress: string): string {
        if (encryptedDataB64 === null) { return null; }

        const sourcePublicKey = AiXpBC.addressToPublicKeyObject(sourceAddress);
        const encryptedData = Buffer.from(encryptedDataB64, 'base64');

        // Extract nonce and ciphertext
        const nonce = encryptedData.slice(0, 12);
        const ciphertext = encryptedData.slice(12, encryptedData.length - 16);
        const authTag = encryptedData.slice(encryptedData.length - 16);

        // Derive shared key
        const sharedKey = this.deriveSharedKey(sourcePublicKey);

        // AES-GCM Decryption
        const decipher = crypto.createDecipheriv('aes-256-gcm', sharedKey, nonce);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext);

        try {
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            return decrypted.toString('utf8');
        } catch (e) {
            return null;
        }
    }

    private getPrivateKey(): crypto.KeyObject {
        return this.keyPair.privateKey;
    }

    private getHash(input: string | object) {
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

    private deriveSharedKey(peerPublicKey: crypto.KeyObject): Buffer {
        const ecdh = crypto.createECDH('secp256k1');
        const privateKeyHex = AiXpBC.privateKeyObjectToECKeyPair(this.keyPair.privateKey).getPrivate().toString(16);
        ecdh.setPrivateKey(Buffer.from(privateKeyHex, 'hex'));

        const publicKeyHex = AiXpBC.publicKeyObjectToECKeyPair(peerPublicKey).getPublic('hex');
        const sharedSecret = ecdh.computeSecret(Buffer.from(publicKeyHex, 'hex'));

        const key = hkdf(sharedSecret, 32, {
          info: 'AiXp handshake data',
          salt: Buffer.alloc(0),
          hash: 'SHA-256',
        });
      
        const hkdfKey = Buffer.from(key);        

        return hkdfKey;
    }
}


