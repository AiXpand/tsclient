import { AiXpNotificationType } from '../message/aixp.notification.type';
import { NodeRequest, ResponseCodes } from './node.request';
import { NodeRequestManager } from './node.request.manager';
import { AiXPMessage, AiXPNotificationData } from '../message';

export class UpdateConfigRequest extends NodeRequest {
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
            case ResponseCodes.PIPELINE_OK:
            case ResponseCodes.PIPELINE_DATA_OK:
            case ResponseCodes.PLUGIN_OK:
                this.resolve(notification);
                break;
            case ResponseCodes.PIPELINE_FAILED:
            case ResponseCodes.PIPELINE_DATA_FAILED:
            case ResponseCodes.PLUGIN_FAILED:
                this.reject(notification);
                break;
        }
    }

    protected reject(notification: any) {
        if (!this.watches(notification.path) || this.isClosed()) {
            return;
        }

        this.updateTarget(notification.path, false, notification.data.notification);
        this.close();

        this.onFail(this.transactionNotifications);
    }

    protected resolve(notification: any) {
        if (!this.watches(notification.path) || this.isClosed()) {
            return;
        }

        this.updateTarget(notification.path, true, notification.data.notification);

        if (this.isComplete() && this.canResolve()) {
            this.onSuccess(this.transactionNotifications);
            this.close();
        }
    }
}
