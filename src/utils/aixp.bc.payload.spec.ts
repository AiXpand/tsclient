/*

git clone git@github.com:AiXpand/tsclient.git
npm install 
npm run test:watch -- aixp.bc.payload.spec.ts

*/
import { beforeAll, describe, expect, test } from '@jest/globals';
import { AiXpBC } from './aixp.bc';

describe('AiXpand Blockchain Tests', () => {
    let mockAiXpandBCEngine;

    beforeAll(() => {
        mockAiXpandBCEngine = new AiXpBC({
            debugMode: true,
            fromFile: false,
            keyPair: {
                publicKey:
                    '3056301006072a8648ce3d020106052b8104000a034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f',
                privateKey:
                    '308184020100301006072a8648ce3d020106052b8104000a046d306b020101042054bf5b9c2e0df0bcb2bbfc250df7a561b3443562851800d087434af937bec0ffa144034200047bed71522fff22fb93de3922e84d8cb5172a3d833ef6daa681f80fa65a8ab7d3c4183504b4b2b1ff390e6c62dca4109a4851e7588cfb19bf427a8dffd539102f',
            },
        });
    });

    test('verify with strange payload', () => {
      const payload = {
        "messageID": "a512448e-8f9e-4e9b-a3b3-d8071bbaee3f", 
        "type": "notification", 
        "category": "", 
        "version": "3.28.131", 
        "data": {"identifiers": {}, 
        "value": {}, 
        "specificValue": {}, 
        "time": null, 
        "img": {"id": null, "height": null, "width": null}}, 
        "metadata": {
          "sbTotalMessages": 33501, 
          "sbCurrentMessage": "a512448e-8f9e-4e9b-a3b3-d8071bbaee3f", 
          "ee_timezone": "UTC+3",
          "ee_tz": "Europe/Bucharest", 
          "ee_message_seq": 33501, 
          "sb_id": "dev-1", 
          "sb_event_type": "NOTIFICATION", 
          "module": "VideoStreamDataCapture", 
          "notification_type": "NORMAL", 
          "notification": "Video DCT 'Cam-Radu-1' successfully connected. Overall 8231 reconnects.", 
          "info": "EE v3.28.131, Lib v9.8.62, info text: None", 
          "stream_name": "Cam-Radu-1", 
          "timestamp": "2023-10-19 14:49:03.680131", 
          "error_code": null, 
          "session_id": null, 
          "initiator_id": "cavi2-local-radu", 
          "video_stream_info": {
            "current_interval": null, 
            "fps": 23, 
            "frame_h": 1080, 
            "frame_w": 1920, 
            "frame_count": 429, 
            "frame_current": 3513330, 
            "buffersize": 0.0
          }, 
          "displayed": true
        }, 
        "time": {
          "deviceTime": "", 
          "hostTime": "2023-10-19 14:49:03.982422", 
          "internetTime": ""
        }, 
        "sender": {
          "id": "AiXp-ExecutionEngine", 
          "instanceId": "AiXp-EE-v3.28.131", 
          "hostId": "dev-1"
        }, 
        "demoMode": false, 
        "EE_FORMATTER": "cavi2", 
        "SB_IMPLEMENTATION": "cavi2", 
        "EE_PAYLOAD_PATH": ["dev-1", "Cam-Radu-1", null, null], 
        "EE_MESSAGE_ID": "a512448e-8f9e-4e9b-a3b3-d8071bbaee3f", 


        "EE_SIGN": "MEYCIQC9CRX_NEREr3HOr-VbS0cM9gh5HQabRWMOmNdP-a_AcQIhAIq5Ta1Sq2t6RUX7OEfZTEnQXGsYtfjmRIit3AnfOdnU", 
        "EE_SENDER": "aixp_AgvAra1bUlzgf9BzQUv99KvNq_cqlWfkru3hAAmiSjWs", 
        "EE_HASH": "4fdd5d21c471d2116be08ce7615bb27270f7bed94990b1d112259e80f33bfae3"
      }                 
      const receivedMessage = JSON.stringify(payload);

      expect(mockAiXpandBCEngine.verify(receivedMessage)).toBe(true);
  });

  
  });
