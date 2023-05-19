import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPGPUMetadata } from './aixp.gpu.metadata';

export class AiXPGPUsStats {
    @IsNotEmpty()
    @IsString()
    defaultCuda: string;

    @IsNotEmpty()
    @IsString()
    info: string;

    @ValidateNested({ each: true })
    @Type(() => AiXPGPUMetadata)
    list: AiXPGPUMetadata[];
}
