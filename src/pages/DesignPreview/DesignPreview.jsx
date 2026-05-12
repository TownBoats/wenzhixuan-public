import PropTypes from 'prop-types';
import {
  Button,
  Input,
  Textarea,
  Tag,
  Tooltip,
  Icon,
  BrandLogo,
  LevelIcon,
  CoffeeCup,
  Flag,
  Key,
  Hourglass,
  Screwdriver,
  cn,
} from '@/components/ui';

/**
 * DesignPreview — 问知轩重设计可视化预览页
 *
 * 用途：让所有 P0/P1/P2 阶段的设计 token、原子组件、自绘插画
 *      在一张页面上集中展示，方便人工 review 与决策。
 *
 * 访问方式：在浏览器打开 http://127.0.0.1:5174/design
 *
 * 本页本身不属于产品 UI，**主应用代码零修改**。
 */

// ─────────────────────────────────────────────────────────
// 内部小组件
// ─────────────────────────────────────────────────────────

function Section({ id, title, description, children }) {
  return (
    <section id={id} className="space-y-6">
      <header className="space-y-1 border-b border-paper-200 pb-3">
        <h2 className="text-h1 font-display text-ink-900">{title}</h2>
        {description ? (
          <p className="text-body text-ink-500 font-serif">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
Section.propTypes = {
  id: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  children: PropTypes.node,
};

function Swatch({ name, value, hex, textOnDark = false }) {
  return (
    <div className="space-y-1">
      <div
        className={cn(
          'h-16 rounded-md shadow-soft',
          'flex items-end justify-end p-2',
          value,
        )}
      >
        <span
          className={cn(
            'text-caption font-mono',
            textOnDark ? 'text-paper-50' : 'text-ink-900',
          )}
        >
          {hex}
        </span>
      </div>
      <p className="text-caption font-mono text-ink-500">{name}</p>
    </div>
  );
}
Swatch.propTypes = {
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  hex: PropTypes.string.isRequired,
  textOnDark: PropTypes.bool,
};

function GrowthStep({ level, label, hint }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col items-center gap-2 text-center">
      <LevelIcon level={level} size={56} />
      <div className="space-y-0.5">
        <p className="text-body font-serif text-ink-900">{label}</p>
        <p className="text-caption font-sans text-ink-500">{hint}</p>
      </div>
    </div>
  );
}
GrowthStep.propTypes = {
  level: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  hint: PropTypes.string.isRequired,
};

function StatusCard({ icon, name, usage }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-paper-200 bg-paper-50 p-4 shadow-soft">
      <div className="shrink-0 rounded-sm bg-paper-100 p-2">{icon}</div>
      <div className="space-y-0.5 min-w-0">
        <p className="text-body font-medium text-ink-900">{name}</p>
        <p className="text-small font-serif text-ink-500">{usage}</p>
      </div>
    </div>
  );
}
StatusCard.propTypes = {
  icon: PropTypes.node.isRequired,
  name: PropTypes.string.isRequired,
  usage: PropTypes.string.isRequired,
};

// ─────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────

function ColorSection() {
  return (
    <Section
      id="colors"
      title="01 · 配色 Tokens"
      description="6 个 namespace。60% paper（暖中性） + 30% sage（主色） + 10% sun（强调）。"
    >
      <div className="space-y-6">
        <div>
          <p className="text-small font-medium text-ink-700 mb-2">ink — 文字与轮廓</p>
          <div className="grid grid-cols-4 gap-3">
            <Swatch name="ink-900" value="bg-ink-900" hex="#1F2330" textOnDark />
            <Swatch name="ink-700" value="bg-ink-700" hex="#3F4554" textOnDark />
            <Swatch name="ink-500" value="bg-ink-500" hex="#6B7280" textOnDark />
            <Swatch name="ink-300" value="bg-ink-300" hex="#C4C9D2" />
          </div>
        </div>

        <div>
          <p className="text-small font-medium text-ink-700 mb-2">paper — 暖中性底（60%）</p>
          <div className="grid grid-cols-4 gap-3">
            <Swatch name="paper-50" value="bg-paper-50 border border-paper-200" hex="#FBF8F3" />
            <Swatch name="paper-100" value="bg-paper-100" hex="#F4EFE6" />
            <Swatch name="paper-200" value="bg-paper-200" hex="#E9E2D2" />
            <Swatch name="paper-900" value="bg-paper-900" hex="#1C1B1F" textOnDark />
          </div>
        </div>

        <div>
          <p className="text-small font-medium text-ink-700 mb-2">sage — 主色（30%）</p>
          <div className="grid grid-cols-5 gap-3">
            <Swatch name="sage-50" value="bg-sage-50" hex="#EEF2F1" />
            <Swatch name="sage-300" value="bg-sage-300" hex="#A7BFC0" />
            <Swatch name="sage-500" value="bg-sage-500" hex="#6B8E8C" textOnDark />
            <Swatch name="sage-700" value="bg-sage-700" hex="#4F6D7A" textOnDark />
            <Swatch name="sage-900" value="bg-sage-900" hex="#2C3E45" textOnDark />
          </div>
        </div>

        <div>
          <p className="text-small font-medium text-ink-700 mb-2">sun — 强调色（10%）</p>
          <div className="grid grid-cols-3 gap-3">
            <Swatch name="sun-300" value="bg-sun-300" hex="#F4C28A" />
            <Swatch name="sun-500" value="bg-sun-500" hex="#E8A87C" />
            <Swatch name="sun-700" value="bg-sun-700" hex="#C97D4A" textOnDark />
          </div>
        </div>

        <div>
          <p className="text-small font-medium text-ink-700 mb-2">level — 五档生长专属色</p>
          <div className="grid grid-cols-5 gap-3">
            <Swatch name="seed" value="bg-level-seed" hex="#D9D2C5" />
            <Swatch name="sprout" value="bg-level-sprout" hex="#A7C4A0" />
            <Swatch name="sapling" value="bg-level-sapling" hex="#7FA99B" />
            <Swatch name="tree" value="bg-level-tree" hex="#4F8A8B" textOnDark />
            <Swatch name="forest" value="bg-level-forest" hex="#2E5E5C" textOnDark />
          </div>
        </div>

        <div>
          <p className="text-small font-medium text-ink-700 mb-2">state — 反馈色（避免红/绿考试感）</p>
          <div className="grid grid-cols-4 gap-3">
            <Swatch name="state-good" value="bg-state-good" hex="#7FA99B" />
            <Swatch name="state-warn" value="bg-state-warn" hex="#E8A87C" />
            <Swatch name="state-alert" value="bg-state-alert" hex="#C77B68" textOnDark />
            <Swatch name="state-info" value="bg-state-info" hex="#6B8E8C" textOnDark />
          </div>
        </div>
      </div>
    </Section>
  );
}

function TypographySection() {
  return (
    <Section
      id="typography"
      title="02 · 字体与排版"
      description="衬线（思考） · 无衬线（操作） · 等宽（代码）三套人格分工。"
    >
      <div className="space-y-4 rounded-md border border-paper-200 bg-paper-50 p-6">
        <div>
          <p className="text-display font-display text-ink-900">问知轩 · WisClick</p>
          <p className="text-caption font-mono text-ink-500 mt-1">display · 28/36 · font-display</p>
        </div>
        <div>
          <p className="text-h1 font-serif text-ink-900">用提问陪你思考</p>
          <p className="text-caption font-mono text-ink-500 mt-1">h1 · 22/30 · font-serif</p>
        </div>
        <div>
          <p className="text-h2 font-sans font-medium text-ink-900">设置 · 模型配置</p>
          <p className="text-caption font-mono text-ink-500 mt-1">h2 · 18/26 · font-sans</p>
        </div>
        <div>
          <p className="text-body font-serif text-ink-700">
            正文用衬线，让「问题」有「被认真问出」的分量感。这一段是 body 字号下的真实阅读体验。
          </p>
          <p className="text-caption font-mono text-ink-500 mt-1">body · 15/24 · font-serif</p>
        </div>
        <div>
          <p className="text-small font-sans text-ink-700">small：辅助说明、按钮内文字、Tab 项</p>
          <p className="text-caption font-mono text-ink-500 mt-1">small · 13/20 · font-sans</p>
        </div>
        <div>
          <p className="text-caption font-mono text-ink-500">caption：序号、时间戳、调试信息（mono）</p>
          <p className="text-caption font-mono text-ink-500 mt-1">caption · 11/16 · font-mono</p>
        </div>
      </div>
    </Section>
  );
}

function RadiusShadowSection() {
  return (
    <Section
      id="radius-shadow"
      title="03 · 圆角 & 阴影"
      description="圆角四档 + pill；阴影双层柔光，拒绝硬阴影。"
    >
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-small font-medium text-ink-700 mb-3">圆角</p>
          <div className="space-y-3">
            {[
              ['rounded-xs', 'xs · 4px', 'tag / badge'],
              ['rounded-sm', 'sm · 8px', '按钮 / 输入'],
              ['rounded-md', 'md · 12px', '卡片 / 气泡'],
              ['rounded-lg', 'lg · 20px', '浮层 / modal'],
              ['rounded-pill', 'pill · 9999px', '圆胶囊'],
            ].map(([cls, label, usage]) => (
              <div key={cls} className="flex items-center gap-3">
                <div className={cn('h-12 w-20 bg-sage-300', cls)} />
                <div>
                  <p className="text-small font-mono text-ink-700">{label}</p>
                  <p className="text-caption text-ink-500">{usage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-small font-medium text-ink-700 mb-3">阴影</p>
          <div className="space-y-3">
            {[
              ['shadow-soft', 'soft', '常态卡片'],
              ['shadow-lift', 'lift', 'hover 浮起'],
              ['shadow-float', 'float', '浮层 / 弹窗'],
            ].map(([cls, label, usage]) => (
              <div key={cls} className="flex items-center gap-3">
                <div className={cn('h-12 w-20 rounded-sm bg-paper-50', cls)} />
                <div>
                  <p className="text-small font-mono text-ink-700">{label}</p>
                  <p className="text-caption text-ink-500">{usage}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

function ButtonSection() {
  return (
    <Section
      id="buttons"
      title="04 · Button"
      description="4 种意图 × 3 种尺寸；按下 scale 0.98 + 1px 下沉。"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-x-4 gap-y-3">
          {['primary', 'secondary', 'ghost', 'accent'].map((intent) => (
            <p key={intent} className="text-small font-mono text-ink-500 text-center">
              {intent}
            </p>
          ))}
          {['sm', 'md', 'lg'].flatMap((size) =>
            ['primary', 'secondary', 'ghost', 'accent'].map((intent) => (
              <div key={`${intent}-${size}`} className="flex justify-center">
                <Button intent={intent} size={size}>
                  {size === 'sm' ? '发送' : size === 'md' ? '保存设置' : '开始 7 天免费试用'}
                </Button>
              </div>
            )),
          )}
        </div>

        <div className="flex items-center gap-4 pt-2">
          <p className="text-small text-ink-500">iconOnly：</p>
          <Button intent="ghost" size="sm" iconOnly aria-label="设置">
            <Icon name="Settings" />
          </Button>
          <Button intent="ghost" size="md" iconOnly aria-label="历史">
            <Icon name="History" />
          </Button>
          <Button intent="primary" size="md" iconOnly aria-label="发送">
            <Icon name="Send" className="text-white" />
          </Button>
          <Button intent="secondary" size="lg" iconOnly aria-label="清空">
            <Icon name="Trash2" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-small text-ink-500">disabled：</p>
          <Button disabled>不可点击</Button>
          <Button intent="secondary" disabled>不可点击</Button>
        </div>
      </div>
    </Section>
  );
}

function InputSection() {
  return (
    <Section
      id="inputs"
      title="05 · Input & Textarea"
      description="placeholder 用 italic ink-300；聚焦 sage 描边 + 同色光标。"
    >
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-small font-medium text-ink-700">默认 / 错误</p>
          <Input placeholder="把 API Key 给我看一眼" />
          <Input error defaultValue="sk-错的格式" />
          <Input disabled placeholder="不可编辑" />
        </div>
        <div className="space-y-3">
          <p className="text-small font-medium text-ink-700">Textarea</p>
          <Textarea rows={3} placeholder="今天想学点什么？" />
          <Textarea rows={2} error defaultValue="出错时的样式" />
        </div>
      </div>
    </Section>
  );
}

function TagSection() {
  return (
    <Section
      id="tags"
      title="06 · Tag"
      description="5 种语义；caption 字号，避免抢戏。"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Tag variant="neutral">问题 #3</Tag>
        <Tag variant="active">流式中</Tag>
        <Tag variant="good">完成</Tag>
        <Tag variant="warn">提醒</Tag>
        <Tag variant="alert">出错</Tag>
      </div>
    </Section>
  );
}

function TooltipSection() {
  return (
    <Section
      id="tooltip"
      title="07 · Tooltip"
      description="深底浅字，500ms 延迟避免误触。鼠标悬停下方的几个按钮试试。"
    >
      <div className="flex flex-wrap items-center gap-6">
        <Tooltip content="清空所有对话" side="top">
          <Button intent="ghost" iconOnly aria-label="清空">
            <Icon name="Trash2" />
          </Button>
        </Tooltip>
        <Tooltip content="保存配置" side="bottom">
          <Button intent="primary">保存</Button>
        </Tooltip>
        <Tooltip content="切换历史会话" side="left">
          <Button intent="secondary" iconOnly aria-label="历史">
            <Icon name="History" />
          </Button>
        </Tooltip>
        <Tooltip content="搜索" side="right">
          <Button intent="ghost" iconOnly aria-label="搜索">
            <Icon name="Search" />
          </Button>
        </Tooltip>
      </div>
    </Section>
  );
}

function BrandSection() {
  return (
    <Section
      id="brand"
      title="08 · BrandLogo"
      description="戴方框眼镜的小笑脸 — 4 种表情对应助手 4 种状态。"
    >
      <div className="grid grid-cols-4 gap-6">
        {[
          ['default', '常态'],
          ['thinking', '思考中'],
          ['error', '出错了'],
          ['happy', '收到感谢'],
        ].map(([expr, label]) => (
          <div
            key={expr}
            className="flex flex-col items-center gap-3 rounded-md border border-paper-200 bg-paper-50 p-6 shadow-soft"
          >
            <BrandLogo size={64} expression={expr} />
            <div className="text-center">
              <p className="text-body font-serif text-ink-900">{label}</p>
              <p className="text-caption font-mono text-ink-500">{`expression="${expr}"`}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-6 pt-4">
        <p className="text-small text-ink-500">尺寸：</p>
        <BrandLogo size={20} />
        <BrandLogo size={32} />
        <BrandLogo size={48} />
        <BrandLogo size={72} />
      </div>
    </Section>
  );
}

function GrowthChainSection() {
  return (
    <Section
      id="growth"
      title="09 · 五档生长链"
      description="替代 none/heard/basic/familiar/expert 抽象英文标签，用一棵树的五个生长阶段。"
    >
      <div className="rounded-md border border-paper-200 bg-paper-50 p-6">
        <div className="flex items-center gap-2">
          <GrowthStep level="seed" label="种子" hint="第一次听说" />
          <span className="border-t border-dashed border-paper-200 flex-1" />
          <GrowthStep level="sprout" label="嫩芽" hint="听过一点" />
          <span className="border-t border-dashed border-paper-200 flex-1" />
          <GrowthStep level="sapling" label="小树" hint="大致了解" />
          <span className="border-t border-dashed border-paper-200 flex-1" />
          <GrowthStep level="tree" label="大树" hint="比较熟悉" />
          <span className="border-t border-dashed border-paper-200 flex-1" />
          <GrowthStep level="forest" label="森林" hint="可以教别人" />
        </div>
      </div>
      <p className="text-small text-ink-500 font-serif">
        P3 阶段会把 AnswerCard 的横向五卡片替换为这条生长链。
      </p>
    </Section>
  );
}

function StatusIconsSection() {
  return (
    <Section
      id="status"
      title="10 · 状态插画"
      description="替代纯文字提示与 ⚠️ 等系统符号，让「状态」具象成可被理解的小物件。"
    >
      <div className="grid grid-cols-2 gap-3">
        <StatusCard
          icon={<CoffeeCup size={28} />}
          name="CoffeeCup"
          usage="助手思考中。热气可循环上浮。"
        />
        <StatusCard
          icon={<Flag size={28} />}
          name="Flag"
          usage="等一下 / 出错了，替代刺眼的惊叹号。"
        />
        <StatusCard
          icon={<Key size={28} />}
          name="Key"
          usage="API Key 缺失提示，欢迎页配置引导。"
        />
        <StatusCard
          icon={<Hourglass size={28} />}
          name="Hourglass"
          usage="字数 / 时间临界。沙已经流到下半部。"
        />
        <StatusCard
          icon={<Screwdriver size={28} />}
          name="Screwdriver"
          usage="设置 / 调试 Tab 的图形锚点。"
        />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'colors', label: '01 配色' },
  { id: 'typography', label: '02 字体' },
  { id: 'radius-shadow', label: '03 圆角阴影' },
  { id: 'buttons', label: '04 Button' },
  { id: 'inputs', label: '05 Input' },
  { id: 'tags', label: '06 Tag' },
  { id: 'tooltip', label: '07 Tooltip' },
  { id: 'brand', label: '08 Brand' },
  { id: 'growth', label: '09 生长链' },
  { id: 'status', label: '10 状态插画' },
];

function DesignPreview() {
  return (
    <div className="min-h-screen bg-paper-50 text-ink-700 font-sans">
      <header className="sticky top-0 z-50 border-b border-paper-200 bg-paper-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-3">
          <div className="flex items-center gap-3">
            <BrandLogo size={32} expression="happy" />
            <div>
              <p className="text-h2 font-display text-ink-900 leading-tight">问知轩 · 设计预览</p>
              <p className="text-caption font-mono text-ink-500">Susan Kare 风重设计 v1 · P0/P1/P2 集成展示</p>
            </div>
          </div>
          <a
            href="/"
            className="text-small text-sage-700 hover:text-sage-900 font-sans transition-colors duration-fast"
          >
            ← 回到聊天
          </a>
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-1 px-8 pb-3">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-pill bg-paper-100 px-3 py-1 text-caption font-sans text-ink-700 hover:bg-paper-200 transition-colors duration-fast"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl space-y-16 px-8 py-12">
        <div className="rounded-md border border-paper-200 bg-paper-100 p-6">
          <p className="text-body font-serif text-ink-700">
            这一页把 P0（设计 token）、P1（原子组件）、P2（自绘图标）
            的所有产出集中渲染。<strong className="text-ink-900">主应用 ChatPage 不受影响</strong>，
            访问根路径 <code className="font-mono text-small">/</code> 还能看到原版。
            等 P3 业务迁移合入后，这里展示的样式才会出现在真实对话界面上。
          </p>
        </div>

        <ColorSection />
        <TypographySection />
        <RadiusShadowSection />
        <ButtonSection />
        <InputSection />
        <TagSection />
        <TooltipSection />
        <BrandSection />
        <GrowthChainSection />
        <StatusIconsSection />

        <footer className="border-t border-paper-200 pt-8 text-center">
          <p className="text-small font-serif text-ink-500">
            如果这一页看起来「对了」，下一步就是 P3：把 ChatPage 里的业务组件逐个迁过来。
          </p>
        </footer>
      </main>
    </div>
  );
}

export default DesignPreview;
