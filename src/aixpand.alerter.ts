import { Alerter, Bind } from './decorators';
import { AiXpandAlertModes } from './models/client/aixpand.alert.modes';

@Alerter()
export class AixpandAlerter {
    @Bind('ALERT_DATA_COUNT')
    protected dataCount: number;

    @Bind('ALERT_RAISE_CONFIRMATION_TIME')
    protected raiseConfirmationTime: number;

    @Bind('ALERT_LOWER_CONFIRMATION_TIME')
    protected lowerConfirmationTime: number;

    @Bind('ALERT_RAISE_VALUE')
    protected raiseValue: number;

    @Bind('ALERT_LOWER_VALUE')
    protected lowerValue: number;

    @Bind('ALERT_MODE')
    protected alertMode: AiXpandAlertModes;

    @Bind('ALERT_REDUCE_VALUE')
    protected reduceValue: boolean;

    constructor(
        dataCount = 2,
        raiseConfirmationTime = 2,
        lowerConfirmationTime = 6,
        raiseValue = 0.65,
        lowerValue = 0.25,
        alertMode = AiXpandAlertModes.MEAN,
        reduceValue = false,
    ) {
        this.dataCount = dataCount;
        this.raiseConfirmationTime = raiseConfirmationTime;
        this.lowerConfirmationTime = lowerConfirmationTime;
        this.raiseValue = raiseValue;
        this.lowerValue = lowerValue;
        this.alertMode = alertMode;
        this.reduceValue = reduceValue;
    }
}
