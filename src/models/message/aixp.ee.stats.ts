import { IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPEEVersion } from './aixp.ee.version';
import { AiXPEECounters } from './aixp.ee.counters';
import { Dictionary } from '../dictionary';
import { AiXpandDataCaptureThread } from '../dct';
import { AiXpandPluginInstance } from '../pipeline';

export class AiXPEEStats {
    @IsOptional()
    @IsNumber()
    heartbeatInterval: number;

    @ValidateNested()
    @Type(() => AiXPEEVersion)
    version: AiXPEEVersion;

    @IsString()
    @IsNotEmpty()
    branch: string;

    @IsString()
    @IsNotEmpty()
    conda: string;

    @ValidateNested()
    @Type(() => AiXPEECounters)
    counters: AiXPEECounters;

    @IsNumber({}, { each: true })
    servingPids: number[];

    @IsOptional()
    dataCaptureThreads: Dictionary<AiXpandDataCaptureThread<any>>;

    @IsOptional()
    activePlugins: AiXpandPluginInstance<any>[];

    @IsOptional()
    links: any;
}
