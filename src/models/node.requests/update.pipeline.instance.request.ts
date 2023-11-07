import { AiXpNotificationType } from '../message/aixp.notification.type';
import { NodeRequest, ResponseCodes } from './node.request';
import { NodeRequestManager } from './node.request.manager';
import { AiXPMessage, AiXPNotificationData } from '../message';

export class UpdatePipelineInstanceRequest extends NodeRequest {
    private readonly transactionNotifications = [];

    constructor(manager: NodeRequestManager, onSuccess?: any, onFail?: any) {
        super(manager, onSuccess, onFail);
    }

    process(notification: AiXPMessage<AiXPNotificationData>) {
        this.transactionNotifications.push(notification);

        if (notification.data.type === AiXpNotificationType.EXCEPTION) {
            this.reject(notification);
        }

        switch (notification.data.code) {
            case ResponseCodes.PLUGIN_OK:
                this.resolve(notification);
                break;
            case ResponseCodes.PLUGIN_FAILED:
                this.reject(notification);
                break;
        }

        if (this.isComplete() && !this.canResolve()) {
            this.close();
            this.onFail(this.transactionNotifications);
        } else if (this.isComplete() && this.canResolve()) {
            this.close();
            this.onSuccess(this.transactionNotifications);
        }
    }

    protected reject(notification: any) {
        if (!this.watches(notification.path) || this.isClosed()) {
            return;
        }

        this.updateTarget(notification.path, false, notification.data.notification);
    }

    protected resolve(notification: any) {
        if (!this.watches(notification.path) || this.isClosed()) {
            return;
        }

        this.updateTarget(notification.path, true, notification.data.notification);
    }
}
