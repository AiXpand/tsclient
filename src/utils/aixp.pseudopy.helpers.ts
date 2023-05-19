import * as zlib from 'node:zlib';
import * as util from 'node:util';

/*
THIS IS A PSEUDO PY EXAMPLE:

const pseudopy = `img = plugin.dataapi_image()
if img is not None:
  plugin.int_cache['trimise'] += 1
  plugin.set_default_image(img)
  if plugin.int_cache['trimise'] > plugin.cfg_max_snapshots:
    plugin.cmdapi_archive_pipeline()
    _result = plugin.int_cache
_result = None`;
 */

const zip = util.promisify(zlib.deflate);
const unzip = util.promisify(zlib.unzip);

export const encode = (code: string): Promise<string> => {
    return zip(code).then((buffer) => {
        return buffer.toString('base64');
    });
};

export const decode = (value: string): Promise<string> => {
    return unzip(Buffer.from(value, 'base64')).then((buffer) => {
        return buffer.toString();
    });
};
