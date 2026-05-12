import PropTypes from 'prop-types';
import LevelSeed from './LevelSeed';
import LevelSprout from './LevelSprout';
import LevelSapling from './LevelSapling';
import LevelTree from './LevelTree';
import LevelForest from './LevelForest';

/**
 * LevelIcon — 按答案档位 name 分发到对应五档生长插画。
 *
 * 同时维护"旧档名 → 新档名"的兼容映射，方便业务侧
 * 在迁移期保留 ContentParser 输出的 none/heard/basic/familiar/expert key。
 *
 * @example
 *   <LevelIcon level="sprout" size={32} />
 *   <LevelIcon level="heard"  size={32} />   // 旧 key，自动映射为 sprout
 */
const LEVEL_COMPONENTS = {
  seed: LevelSeed,
  sprout: LevelSprout,
  sapling: LevelSapling,
  tree: LevelTree,
  forest: LevelForest,
};

const LEGACY_LEVEL_ALIAS = {
  none: 'seed',
  heard: 'sprout',
  basic: 'sapling',
  familiar: 'tree',
  expert: 'forest',
};

function LevelIcon({ level, ...rest }) {
  const resolved = LEVEL_COMPONENTS[level] || LEVEL_COMPONENTS[LEGACY_LEVEL_ALIAS[level]];
  if (!resolved) return null;
  const Component = resolved;
  return <Component {...rest} />;
}

LevelIcon.propTypes = {
  level: PropTypes.oneOf([
    ...Object.keys(LEVEL_COMPONENTS),
    ...Object.keys(LEGACY_LEVEL_ALIAS),
  ]).isRequired,
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

export { LEVEL_COMPONENTS, LEGACY_LEVEL_ALIAS };
export default LevelIcon;
