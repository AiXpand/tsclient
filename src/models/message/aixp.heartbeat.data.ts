import { IsIn, IsIP, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPData } from './aixp.data';
import { AiXPMachineMemoryStats } from './aixp.machine.memory.stats';
import { AiXPMachineDiskStats } from './aixp.machine.disk.stats';
import { AiXPCPUStats } from './aixp.cpu.stats';
import { AiXPEEStats } from './aixp.ee.stats';
import { AiXPGPUsStats } from './aixp.gpu.stats';

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
    ee: AiXPEEStats;

    @ValidateNested()
    @Type(() => AiXPGPUsStats)
    gpus: AiXPGPUsStats;
}
