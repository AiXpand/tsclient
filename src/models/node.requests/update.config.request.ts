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
            case ResponseCodes.PLUGIN_RESUME_OK:
            case ResponseCodes.PLUGIN_PAUSE_OK:
            case ResponseCodes.PLUGIN_WORKING_HOURS_SHIFT_START:
            case ResponseCodes.PLUGIN_WORKING_HOURS_SHIFT_END:
                this.resolve(notification);
                break;
            case ResponseCodes.PIPELINE_FAILED:
            case ResponseCodes.PIPELINE_DATA_FAILED:
            case ResponseCodes.PLUGIN_FAILED:
            case ResponseCodes.PLUGIN_RESUME_FAILED:
            case ResponseCodes.PLUGIN_PAUSE_FAILED:
            case ResponseCodes.PLUGIN_WORKING_HOURS_SHIFT_START_FAILED:
            case ResponseCodes.PLUGIN_WORKING_HOURS_SHIFT_END_FAILED:
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
        this.close();

        console.log(`[Transaction: ${this.id}] Calling OnFail() hook`);

        this.onFail(this.transactionNotifications);
    }

    protected resolve(notification: any) {
        console.log(`[Transaction: ${this.id}] Resolving: ${notification.path.join(', ')} `);

        if (!this.watches(notification.path) || this.isClosed()) {
            return;
        }

        this.updateTarget(notification.path, true, notification.data.notification);

        console.log(`[Transaction: ${this.id}] isComplete: ${this.isComplete()}`);
        console.log(`[Transaction: ${this.id}] canResolve: ${this.canResolve()}`);
        console.log(`[Transaction: ${this.id}] watches: ${JSON.stringify(this.listWatches())}`);

        if (this.isComplete() && this.canResolve()) {
            console.log(`[Transaction: ${this.id}] Calling OnSuccess() hook`);

            this.onSuccess(this.transactionNotifications);
            this.close();
        } else {
            console.log(`[Transaction: ${this.id}] Skipping OnSuccess() hook`);
        }
    }
}
