import { AiXpNotificationType } from '../message/aixp.notification.type';
import { NodeRequest, ResponseCodes } from './node.request';
import { NodeRequestManager } from './node.request.manager';
import { AiXPMessage, AiXPNotificationData } from '../message';

export class ArchiveConfigRequest extends NodeRequest {
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
            case ResponseCodes.PIPELINE_ARCHIVE_OK:
                this.resolve(notification);
                break;
            case ResponseCodes.PIPELINE_ARCHIVE_FAILED:
                this.reject(notification);
                break;
        }
    }

    protected reject(notification: any) {
        console.log(`[Transaction: ${this.id}] Rejecting: ${notification.path.join(', ')} `);

        if (!this.watches(notification.path) || this.isClosed()) {
            return;
        }

        this.updateTarget(notification.path, false, notification.data.notification);

        if (this.isComplete() && !this.canResolve()) {
            this.close();
            this.onFail(this.transactionNotifications);
        }
    }

    protected resolve(notification: any) {
        console.log(`[Transaction: ${this.id}] Resolving: ${notification.path.join(', ')} `);

        if (!this.watches(notification.path) || this.isClosed()) {
            return;
        }

        this.updateTarget(notification.path, true, notification.data.notification);

        if (this.isComplete() && this.canResolve()) {
            this.close();
            this.onSuccess(this.transactionNotifications);
        }
    }
}
