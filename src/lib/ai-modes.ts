// 纯常量 + 类型，故意从 ai.ts 抽出：
// StoryEditor 等 client 组件需要 CREATIVE_MODES / NARRATIVE_MOVES 这些运行时值，
// 但 ai.ts 会 import store.ts（内含 node:crypto / node:fs），一旦被 client bundle
// 引用就会触发 webpack 的 "node:" scheme 报错。这里只放不依赖服务端模块的东西。

// Persona = 内部使用的 system prompt 分身。孩子不直接选。
export type Persona = 'alchemy' | 'world-witness' | 'story-coach';

// CreativeMode = 需求文档 §3.5.2 的三种创意模式。孩子按困难场景选。
// 每种模式绑定一个主 Persona 与一段模式特定的 system prompt 附加。
export type CreativeMode = 'open-up' | 'build-on' | 'look-again';

export interface CreativeModeInfo {
  mode: CreativeMode;
  label: string;
  scenario: string;         // 适用场景（孩子视角）
  persona: Persona;         // 背后是谁在回应
  personaLabel: string;     // 前端展示的 agent 名字
  focusHint: string;        // 面板里的一句话说明
}

export const CREATIVE_MODES: CreativeModeInfo[] = [
  {
    mode: 'open-up',
    label: 'Open Up · 打开更多可能',
    scenario: '没想法 / 思路单一',
    persona: 'world-witness',
    personaLabel: 'World Witness',
    focusHint: '从你采集的 Traces 出发，给出多重解释（现实 / 幻想 / 情感），并鼓励「如果……会怎样」的追问。',
  },
  {
    mode: 'build-on',
    label: 'Build On · 让故事继续',
    scenario: '有开头没发展 / 缺冲突',
    persona: 'story-coach',
    personaLabel: 'Story Coach',
    focusHint: '结合抽象情节模型（计划失败、新线索、意外发现），给出可以往下走的两三条路径。',
  },
  {
    mode: 'look-again',
    label: 'Look Again · 回去重看',
    scenario: '脱离素材 / 需要更多细节',
    persona: 'world-witness',
    personaLabel: 'World Witness',
    focusHint: '并排看故事与 Trace，把描写扎回真实感官——观察、还是想象？',
  },
];

// 设计文档 §"Narrative Move Library"（Build On 模式下的叙事动作参考）
// 每个 move 展示一个纯抽象的叙事动作，视频/文字帮助儿童"看到一次变化"。
export interface NarrativeMove {
  id: string;
  label: string;         // 简短名字
  scenario: string;      // 一句话情境描述
  question: string;      // 观看后必须回答的问题
}

export const NARRATIVE_MOVES: NarrativeMove[] = [
  {
    id: 'plan-fails',
    label: '第一次计划失败',
    scenario: '主人公按自己的想法尝试了一次，但事情没有按预期发生——不是因为失败得彻底，而是因为世界给了另一种回应。',
    question: '你的哪条 trace，可以在故事里让主人公第一次的方法不成立？',
  },
  {
    id: 'new-clue',
    label: '新线索出现',
    scenario: '在停下来喘口气的瞬间，主人公注意到一个之前忽略过的细节——它悄悄改变了下一步的方向。',
    question: '你的哪条 trace 可能是这条新线索？主人公会因为它改做什么？',
  },
  {
    id: 'misunderstanding',
    label: '误解被揭开',
    scenario: '主人公原以为的事情，突然被另一个视角推翻了——之前所有的行动因此有了新的含义。',
    question: '你的故事里，主人公可能一直误解了哪条 trace 的意思？',
  },
  {
    id: 'choice-consequence',
    label: '一个选择产生后果',
    scenario: '主人公做出了一个决定。它看起来很小，但它带来的连锁反应改变了故事的走向。',
    question: '主人公做的这个决定，和你的哪条 trace 有关？后果会怎样蔓延？',
  },
  {
    id: 'inner-shift',
    label: '内心动摇',
    scenario: '外面什么都没变，但主人公心里的某样东西松动了——他/她重新想了想自己为什么走到这里。',
    question: '哪条 trace 让主人公开始怀疑自己？他/她想到了什么？',
  },
];
