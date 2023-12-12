import { Dictionary } from '../dictionary';
import { v4 as uuidv4 } from 'uuid';
import { NodeRequestManager } from './node.request.manager';
import { AiXPMessage, AiXPNotificationData } from '../message';

export enum ResponseCodes {
    PIPELINE_OK = 1,
    PIPELINE_FAILED = -PIPELINE_OK,
    PIPELINE_DATA_OK = PIPELINE_OK + 1,
    PIPELINE_DATA_FAILED = -PIPELINE_DATA_OK,
    PIPELINE_DCT_CONFIG_OK = PIPELINE_DATA_OK + 1,
    PIPELINE_DCT_CONFIG_FAILED = -PIPELINE_DCT_CONFIG_OK,
    PIPELINE_ARCHIVE_OK = PIPELINE_DCT_CONFIG_OK + 1,
    PIPELINE_ARCHIVE_FAILED = -PIPELINE_ARCHIVE_OK,

    PLUGIN_OK = 100,
    PLUGIN_FAILED = -PLUGIN_OK,
    PLUGIN_PAUSE_OK = 110,
    PLUGIN_PAUSE_FAILED = -PLUGIN_PAUSE_OK,
    PLUGIN_RESUME_OK = 111,
    PLUGIN_RESUME_FAILED = -PLUGIN_RESUME_OK,
    PLUGIN_WORKING_HOURS_SHIFT_START = 112,
    PLUGIN_WORKING_HOURS_SHIFT_START_FAILED = -PLUGIN_WORKING_HOURS_SHIFT_START,
    PLUGIN_WORKING_HOURS_SHIFT_END = 113,
    PLUGIN_WORKING_HOURS_SHIFT_END_FAILED = -PLUGIN_WORKING_HOURS_SHIFT_END,

    PLUGIN_CONFIG_IN_PAUSE_OK = 120,
    PLUGIN_CONFIG_IN_PAUSE_FAILED = -PLUGIN_CONFIG_IN_PAUSE_OK,
}

export class Target {
    status: boolean;

    reason: string;

    constructor() {
        this.status = null;
        this.reason = null;
    }
}

export abstract class NodeRequest {
    private mgr: NodeRequestManager;

    id: string;

    onSuccess: any;

    onFail: any;

    private closed: boolean;

    private targets: Dictionary<Target> = {};

    protected constructor(manager: NodeRequestManager, onSuccess?: any, onFail?: any) {
        this.id = uuidv4();
        this.onSuccess = onSuccess;
        this.onFail = onFail;
        this.closed = false;
        this.mgr = manager;
    }

    public abstract process(notification: AiXPMessage<AiXPNotificationData>);

    protected abstract resolve(notification: any);

    protected abstract reject(notification: any);

    public isClosed() {
        return this.closed;
    }

    public watch(path: string[]) {
        this.targets[path.join(':')] = new Target();
        this.mgr.index(path, this);

        console.log(`[Transaction: ${this.id}] Watches: ${Object.keys(this.targets).join(', ')} `);

        return this;
    }

    public watches(path: string[]) {
        return Object.keys(this.targets).includes(path.join(':'));
    }

    public listWatches() {
        return Object.keys(this.targets).map((key) =>
            key.split(':').map((element) => (element !== '' ? element : null)),
        );
    }

    protected close() {
        this.closed = true;

        return this;
    }

    protected isComplete() {
        return Object.keys(this.targets)
            .map((path) => this.targets[path].status)
            .reduce((result, status) => result && status !== null, true);
    }

    protected canResolve() {
        return Object.keys(this.targets)
            .map((path) => this.targets[path].status)
            .reduce((result, status) => result && status, true);
    }

    protected updateTarget(path: string[], status: boolean, reason: string = null) {
        console.log(`[Transaction: ${this.id}] Updated: ${path.join(':')} `);

        this.targets[path.join(':')].reason = reason;
        this.targets[path.join(':')].status = status;

        return this;
    }
}
