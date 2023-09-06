import { IsBoolean, IsDate, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AiXpandMessageDetailsMetadata {
    @IsString()
    signature: string;

    @IsString()
    hash: string;

    @IsString()
    format: string;
}

export class AiXPMessageMetadata {
    @ValidateNested()
    @Type(() => AiXpandMessageDetailsMetadata)
    message: AiXpandMessageDetailsMetadata;

    @IsString()
    @IsOptional()
    signature?: string;

    @IsString()
    @IsOptional()
    category?: string;

    @IsDate()
    @IsOptional()
    executionTimestamp: Date;

    @IsOptional()
    plugin?: any;

    @IsOptional()
    capture?: any;

    @IsOptional()
    @IsBoolean()
    datasetBuilderUsed?: boolean;

    @IsOptional()
    @IsBoolean()
    debugPayloadSaved?: boolean;
}
