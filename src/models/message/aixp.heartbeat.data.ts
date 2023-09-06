import { IsIn, IsIP, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPData } from './aixp.data';
import { AiXPMachineMemoryStats } from './aixp.machine.memory.stats';
import { AiXPMachineDiskStats } from './aixp.machine.disk.stats';
import { AiXPCPUStats } from './aixp.cpu.stats';
import { AiXPEEStats, AiXPStopLogEntry } from './aixp.ee.stats';
import { AiXPGPUsStats } from './aixp.gpu.stats';
import { Dictionary } from '../dictionary';
import { AiXpandDataCaptureThread } from '../dct';
import { AiXpandPluginInstance } from '../pipeline';

export class AiXPHeartbeatData extends AiXPData {
    @IsString()
    @IsIn(['ONLINE', 'OFFLINE'])
    status: string;

    @IsIP(4)
    ip: string;

    @IsNumber()
    uptime: number;

    @ValidateNested()
    @Type(() => AiXPMachineMemoryStats)
    memory: AiXPMachineMemoryStats;

    @ValidateNested()
    @Type(() => AiXPMachineDiskStats)
    disk: AiXPMachineDiskStats;

    @ValidateNested()
    @Type(() => AiXPCPUStats)
    cpu: AiXPCPUStats;

    @ValidateNested()
    @Type(() => AiXPEEStats)
    node: AiXPEEStats;

    @ValidateNested()
    @Type(() => AiXPGPUsStats)
    gpus: AiXPGPUsStats;

    @ValidateNested({ each: true })
    @Type(() => AiXPStopLogEntry)
    stopLog: AiXPStopLogEntry[];

    @IsOptional()
    commStats: any;

    @IsOptional()
    dataCaptureThreads: Dictionary<AiXpandDataCaptureThread<any>>;

    @IsOptional()
    activePlugins: AiXpandPluginInstance<any>[];

    @IsOptional()
    links: any;
}
