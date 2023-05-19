import { IsNumber } from 'class-validator';

export class AiXPEECounters {
    @IsNumber()
    inferences: number;

    @IsNumber()
    payloads: number;

    @IsNumber()
    streams: number;
}
