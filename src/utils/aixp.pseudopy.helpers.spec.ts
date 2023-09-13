import { describe, expect, test } from '@jest/globals';
import { decode, encode } from './aixp.pseudopy.helpers';

const pseudopy = `img = plugin.dataapi_image()
if img is not None:
  plugin.int_cache['trimise'] += 1
  plugin.set_default_image(img)
  if plugin.int_cache['trimise'] > plugin.cfg_max_snapshots:
    plugin.cmdapi_archive_pipeline()
    _result = plugin.int_cache
_result = None`;

const encoded =
    'eJx9j0EKwjAQRfc9xexqEQS3Qj2CFxAZhmSaDjRp6EzF45uAbXeu3+f9/yUG6CFPa5B08WREWVAiBT51jQwghYtCmg0ec+JbA1tYkqEjN/KztUWiKLcvOPdwPSLKhp4HWif7OYuuK7yI/1nuG3VDwEgf1ERZx9m09u96F31dS4sb5c2YJfMkqQ6vIVxYS/Hxbq9qDlQ/fQF/6Voo';

describe('PseudoPy Helpers', () => {
    test('encode()', () => {
        return encode(pseudopy).then((result) => {
            expect(result).toBe(encoded);
        });
    });

    test('decode()', () => {
        return decode(encoded).then((result) => {
            expect(result).toBe(pseudopy);
        });
    });
});
