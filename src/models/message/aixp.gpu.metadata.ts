import { IsBoolean, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPGPUMemoryStats } from './aixp.gpu.memory.stats';
import { AiXPGPUStatus } from './aixp.gpu.status';
import { AiXPGPUProcessStats } from './aixp.gpu.process.stats';

export class AiXPGPUMetadata {
    @IsNotEmpty()
    @IsString()
    name: string;

    @IsBoolean()
    usedByProcess: boolean;

    @ValidateNested()
    @Type(() => AiXPGPUMemoryStats)
    memory: AiXPGPUMemoryStats;

    @ValidateNested()
    @Type(() => AiXPGPUStatus)
    stats: AiXPGPUStatus;

    @ValidateNested()
    @Type(() => AiXPGPUProcessStats)
    processes: AiXPGPUProcessStats[];
}
