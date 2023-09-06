import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPEEVersion } from './aixp.ee.version';
import { AiXPEECounters } from './aixp.ee.counters';

export class AiXPHeartbeatNetworkStats {
    @IsOptional()
    @IsNumber()
    in: number;

    @IsOptional()
    @IsNumber()
    out: number;
}

export class AiXPHeartbeatLogs {
    @IsOptional()
    @IsString()
    device: string;

    @IsOptional()
    @IsString()
    error: string;
}

export class AiXPStopLogEntry {
    @IsOptional()
    @IsNumber()
    nr: number;

    @IsOptional()
    @IsString()
    fromStart: string;

    @IsOptional()
    @IsDate()
    when: Date;

    @IsOptional()
    @IsString()
    stage: string;

    @IsOptional()
    @IsDate()
    resume: Date;

    @IsOptional()
    @IsString()
    duration: string;

    @IsOptional()
    @IsNumber()
    iter: number;
}

export class AiXPEEStats {
    @IsString()
    @IsNotEmpty()
    address: string;

    @IsString()
    @IsNotEmpty()
    isAlertRam: boolean;

    @IsString()
    @IsNotEmpty()
    isSupervisor: boolean;

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

    @ValidateNested()
    @Type(() => AiXPHeartbeatNetworkStats)
    network: AiXPHeartbeatNetworkStats;

    @IsOptional()
    loopsTimings: any;

    @IsString()
    @IsOptional()
    timers: string;

    @ValidateNested()
    @Type(() => AiXPHeartbeatLogs)
    logs: AiXPHeartbeatLogs;
}
