/** Roster portrait grid layout for character select */
export const ROSTER_SHEETS = {
  'jjk-roster': {
    cols: 4,
    rows: 4,
    header: 68,
    nameBar: 30,
    padX: 8,
    padTop: 6,
  },
  'mha-roster': {
    cols: 5,
    rows: 3,
    header: 0,
    /** Square crop centered on the circular portrait (excludes name text below) */
    circleScale: 0.88,
    circlePadTop: 6,
    circleMarginBottom: 48,
  },
};

function getSheetMetrics(rosterKey, texture) {
  const sheet = ROSTER_SHEETS[rosterKey];
  const texW = texture?.source[0]?.width ?? (rosterKey === 'jjk-roster' ? 735 : 1024);
  const texH = texture?.source[0]?.height ?? (rosterKey === 'jjk-roster' ? 749 : 576);
  const cellW = texW / sheet.cols;
  const cellH = (texH - sheet.header) / sheet.rows;

  return { sheet, cellW, cellH, texW, texH };
}

function getJjkCrop(character, cellW, cellH, sheet) {
  const cropW = Math.floor(cellW - sheet.padX * 2);
  const cropH = Math.floor(cellH - sheet.padTop - sheet.nameBar);

  return {
    cropX: Math.floor(character.gridCol * cellW + sheet.padX),
    cropY: Math.floor(sheet.header + character.gridRow * cellH + sheet.padTop),
    cropW,
    cropH,
  };
}

function getMhaCrop(character, cellW, cellH, sheet) {
  const size = Math.floor(
    Math.min(cellW * sheet.circleScale, cellH - sheet.circleMarginBottom),
  );

  return {
    cropX: Math.floor(character.gridCol * cellW + (cellW - size) / 2),
    cropY: Math.floor(sheet.header + character.gridRow * cellH + sheet.circlePadTop),
    cropW: size,
    cropH: size,
  };
}

export function getPortraitCrop(character, texture) {
  if (!character?.roster) return null;

  const { sheet, cellW, cellH } = getSheetMetrics(character.roster, texture);

  if (character.roster === 'mha-roster') {
    return getMhaCrop(character, cellW, cellH, sheet);
  }

  return getJjkCrop(character, cellW, cellH, sheet);
}
