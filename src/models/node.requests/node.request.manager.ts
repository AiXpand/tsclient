import { Dictionary } from '../dictionary';
import { NodeRequest } from './node.request';
import { UpdateConfigRequest } from './update.config.request';
import { AiXpandCommandAction } from '../pipeline/aixpand.command';
import { ArchiveConfigRequest } from './archive.config.request';
import { UpdatePipelineInstanceRequest } from './update.pipeline.instance.request';

export class NodeRequestManager {
    private pendingRequests: Dictionary<NodeRequest> = {};

    private requestsIndexes: Dictionary<NodeRequest> = {};

    create(message: any, onSuccess?: any, onFail?: any) {
        let request;

        switch (message['ACTION']) {
            case AiXpandCommandAction.UPDATE_PIPELINE_INSTANCE:
                request = new UpdatePipelineInstanceRequest(this, onSuccess, onFail);
                break;
            case AiXpandCommandAction.UPDATE_CONFIG:
                request = new UpdateConfigRequest(this, onSuccess, onFail);
                break;
            case AiXpandCommandAction.ARCHIVE_CONFIG:
                request = new ArchiveConfigRequest(this, onSuccess, onFail);
                break;
            case AiXpandCommandAction.BATCH_UPDATE_PIPELINE_INSTANCE:
                request = new UpdatePipelineInstanceRequest(this, onSuccess, onFail);
                break;
        }

        this.pendingRequests[request.id] = request;

        return request;
    }

    index(path: string[], request: NodeRequest) {
        this.requestsIndexes[path.join(':')] = request;

        return this;
    }

    find(path: string[]) {
        return this.requestsIndexes[path.join(':')] ?? null;
    }

    destroy(path: string[]) {
        const request = this.find(path);
        if (!request) {
            // already closed.
            return this;
        }

        request.listWatches().forEach((watch) => {
            delete this.requestsIndexes[watch.join(':')];
        });
        delete this.pendingRequests[request.id];

        return this;
    }
}
