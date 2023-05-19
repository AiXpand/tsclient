import { AiXPData } from './aixp.data';
import { AiXPMessageIdentifiers } from './aixp.message.idendifiers';

export class AiXPPayloadData extends AiXPData {
    identifiers: AiXPMessageIdentifiers;
    id_tags?: any;
    time: Date;
}
