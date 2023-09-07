import { IsBoolean, IsDate, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AiXPMessageIdentifiers } from './aixp.message.idendifiers';

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

    @IsOptional()
    identifiers?: AiXPMessageIdentifiers;

    @IsOptional()
    time?: Date;

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
