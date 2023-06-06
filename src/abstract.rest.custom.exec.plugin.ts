import { Bind, Embedable, Embedded } from './decorators';
import { RestCustomExecPlugin } from './decorators/rest.custom.exec.plugin.decorator';

export const REST_CUSTOM_EXEC_SIGNATURE = 'REST_CUSTOM_EXEC_01';

@Embedable(REST_CUSTOM_EXEC_SIGNATURE)
export class RestRequestData {}

@Embedable(REST_CUSTOM_EXEC_SIGNATURE)
export class RestRequest {
    @Bind('TIMESTAMP')
    timestamp: number;

    @Embedded(RestRequestData, 'DATA')
    data: RestRequestData;

    constructor(data: RestRequestData) {
        this.timestamp = new Date().getTime();
        this.data = data;
    }
}

@RestCustomExecPlugin()
export abstract class AbstractRestCustomExec {
    @Bind('PROCESS_DELAY')
    processDelay: number;

    @Bind('ALLOW_EMPTY_INPUTS')
    allowEmptyInputs: boolean;

    @Bind('RUN_WITHOUT_IMAGE')
    runWithoutImage: boolean;

    @Embedded(RestRequest, 'REQUEST')
    request: RestRequest;

    protected constructor(data: RestRequestData, processDelay = 0.1, allowEmptyInputs = true, runWithoutImage = true) {
        this.processDelay = processDelay;
        this.allowEmptyInputs = allowEmptyInputs;
        this.runWithoutImage = runWithoutImage;
        this.request = new RestRequest(data);
    }
}
