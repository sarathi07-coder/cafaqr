/**
 * Genuine ISO/IEC 15417 Code-128B Barcode SVG generator.
 * Produces compliant bar/space module widths with Start B (104), Mod-103 checksum,
 * Stop (106), and 10-module left/right quiet zones so hardware and camera scanners decode accurately.
 */

// 107 standard Code-128 patterns: [bar1, space1, bar2, space2, bar3, space3 (, bar4 for stop 106)]
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export function encodeCode128B(rawInput = 'KR-000000') {
  const sanitized = String(rawInput || 'KR-000000')
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126 ? ch : '-';
    })
    .join('') || 'KR-000000';

  const values = [104]; // Start Code B
  let checksum = 104;

  for (let i = 0; i < sanitized.length; i += 1) {
    const val = sanitized.charCodeAt(i) - 32;
    values.push(val);
    checksum += val * (i + 1);
  }

  values.push(checksum % 103);
  values.push(106); // Stop pattern

  const quietZone = 10;
  const bars = [];
  let x = quietZone;

  for (const symVal of values) {
    const pattern = CODE128_PATTERNS[symVal];
    if (!pattern) continue;
    for (let j = 0; j < pattern.length; j += 1) {
      const width = Number(pattern[j]);
      if (j % 2 === 0) {
        bars.push({ x, w: width });
      }
      x += width;
    }
  }

  return {
    text: sanitized,
    bars,
    totalWidth: x + quietZone,
  };
}

