export class AiXPTimingValues {
    download_time?: string | null;
    ai_engine_time?: string | null;
    movie_write_time?: string | null;
    upload_time?: string | null;
    '01_prepare'?: string | null;
    '02_blur_movie'?: string | null;
    '02_inference': string | null;
    '03_reduce'?: string | null;
    '04_upload'?: string | null;
    '05_total'?: string | null;
}
