# 战斗轮 AI · 四份 Plan

串行：P0 → P1 → P2 → P3。不要四个 agent 并行，会抢同一批文件。

每份拷进**新对话**。权威：`docs/Untitled-1.md`（含 Q1–Q32）。旧 `docs/combat-ai-requirements.md` 作废。

难度：简单=`newstupid`，新手=`novice`，普通=`trained`，困难=`expert`，非常困难=`professional`。无 Master。

测试：`*.test.ts` + `node:test`，`pnpm test` 绿才能收工。

## 接线：什么时候可以接到产品上

库函数已经在。`buildPlanningPayload` 有 `snapshot.intel` 就读 store，不作弊翻角色卡。卡住的是 **谁在回合里调用写入**，不是再等一整期 P1。

| 接点 | 现在 | 开始接线要什么 |
|---|---|---|
| combat-bench 出计划 | 共享 `LocalizationStore`；LOS seed，无图不写满定位。移动/开火/投掷后写 A 范围/声音/`noteTargetMoved`/互给模糊。无精确/完全走 `tickNonCombat`。 | 觉察真骰、expert 0.25 RNG。 |
| `character-sheet-snapshot` | 选项可挂 `intel`/`factionId`；bench 已挂。 | — |
| 觉察真骰 | store 吃注入的 `awareness` | 有 WIL+聆听就可以接；没有就继续注入。 |
| 房间名 / 巡逻落点 | `buildEncounterNav` 遭遇开始一次；FSM 巡逻结束可 `rebuildNav` | bench 还没调用 `tickNonCombat`。 |
| 非战斗巡逻/调查/命令 | `tickNonCombat` 已在 `lib/combat/non-combat-fsm.ts` | **现在就能接。** 无精确/完全敌对时走 tick，不要 `decideRoundPlan`。 |
| 部位/开火模式/伏击/LUK | `combat-policy.ts` 已门控模糊开火、动作上限、伏击、LUK | 开火模式/投回/隐蔽多为表；intent 尚未带 fire mode；bench 未把 randomSeed 传入 expert 0.25。 |

第一根有意义的线：**bench 执行循环 → localization store → 下一拍 payload。** P1/P2 可以后接。

---

---

## P0 — 拆旧搜索 + 信息层 ✅

**状态（2026-09-29）：** 已合。`decideRoundPlanWithSimulation` 已拔；定位是阵营×目标情报记录。`pnpm test` 子代理报 180/180 绿。

**仍留给后面：** 觉察用注入结果不是真骰。


**范围**

1. 拆旧 AI：bench / `run-check` 不再走 `decideRoundPlanWithSimulation`。删除 `lib/combat/stateful-plan-search.ts`、`decide-with-simulation.ts` 及测试。挖掉 `planning.ts` 致死 1.35、压制门、延后 +0.08；`search.ts` 迭代加深；`difficulty.ts` 里 lethality / nextRound / 0.55 统一动作 / 两扇概率门。
2. `localization.ts`：精确定位=效果线可直射；模糊默认不能打（Q7）。墙对面最多精确（Q28）。
3. 新定位存储：同阵营共享；模糊中心=真位置+固定 2.5m 偏置矢量（Q6/Q23）；任一方拿到完全定位则双方阵营互给模糊直到战斗结束（Q32）。
4. SENS=(REF+WIL)×2；A=SENS，开阔 V=10m，S=SENS×0.5（Q24）。声音：100 AR 或 20 SSP 减半；脚步/开火/投掷；枪 5×A 得模糊。每次暴露声音掷觉察（Q22）。
5. 延后/条件等待冻结衰减；解除后再按档 N 轮精确 / M 轮模糊（Q12/Q18）。
6. 移动 utility 去掉 `2 − 0.05×距离`。接战 weight 只留射击/投掷/压制伤害期望。`cover.ts` 的 AI 叠厚度门删掉，穿墙走 ballistic。
7. **情报必须进存储**（见 `docs/Untitled-1.md`「情报：必须写入存储」）：不要只存三档 loc。模糊起写入在场、outgoing 伤害、先攻、战斗位置；精确起写入 incoming 伤害，再按档写入装备/修正/血量（简单档这些为空）。声音事件、A 范围移动轨迹、S 触及、延后冻结标记一并写入。档不够的字段保持空，禁止从完整 snapshot 作弊读取。

**不要做：** 房间图、FSM 五态、五档接战政策表（部位/开火模式/伏击/LUK）。

**完成：** `pnpm test` 绿；没有 `decideRoundPlanWithSimulation`；精确可直射；情报字段按档可见/不可见有测试。

---

## P1 — 房间 + 巡逻图 + 猎杀 ✅

**状态（2026-09-29）：** 已合。`rooms.ts` / `patrol.ts`；bench 遭遇开始 `buildEncounterNav` 一次，推进回合不重算。子代理报 `pnpm test` 187/187 绿。

**仍留给后面：** 守点/撤离/夺取；P2 才在巡逻结束 rebuild；检测中断。

**前置：** P0 已合。

**范围**

- 墙外侧半封闭 ≥3 面墙成房间，开口也算；邻房重叠带同时属于两房（Q8）。
- 遭遇开始算房间+路网；每次巡逻结束重算。打穿掩体（射全身掩体或墙后单位）不重算房间（Q19）。
- 无寻路惩罚/奖励权重。
- 任务（Q25）：**这期只做猎杀 `hunt`。** 无配置当猎杀。守点/撤离/夺取留到以后。杀光敌对仍算完成。
- 各档单机巡逻形状按 Untitled-1 正文（全图/角落/对侧/…），这期只出路线，不写侦测中断。

**不要做：** Leader/Slave、调查状态、接战 override。

**完成：** 开口房间、重叠带、巡逻结束重算、猎杀路线与清场完成判定有测试；`pnpm test` 绿。守点/撤离/夺取不做。

---

## P2 — 非战斗五态 + Leader/Slave ✅

**状态（2026-09-29）：** 已合。`tickNonCombat` 在 `lib/combat/non-combat-fsm.ts`。bench 无精确/完全敌对时走 tick。

**仍留给后面：** 守卫/战斗/解除。


**前置：** P0+P1 已合。

**范围**

状态：巡逻、调查（去上次看见的位置）、搜索、协助、侦察。

- 有 Leader 则其余全是 Slave（Q21）。没命令走自己那档巡逻（Q21b）。有命令先执行；进战斗可更新命令（Q9）。
- 搜索：全图一份 BFS，分头走未搜房间，整图完才完成；过程可自由交火（Q29）。守卫/战斗/解除不实现。
- 抗命（25/20/10/5/0%）：本轮清槽自由行动；下轮没新令回巡逻（Q30）。
- 按该档侦测条件中断巡逻（Q5）。没有敌对精确/完全定位=战斗结束，回巡逻；只剩模糊可按档调查（Q20）。调查走到点没人且没新信息→回巡逻（Q26）。
- 0.5x=走，1x=跑，1.5x=冲；脚步声不随倍率变（Q31）。

**不要做：** 接战部位/开火模式/LUK/投回手雷；不要把接战子策略加成新状态。

**完成：** 命令抢占、抗命、空调查回巡逻、整图搜索完成有测试；`pnpm test` 绿。

---

## P3 — 接战 override + 五档政策 ✅

**状态（2026-09-29）：** 已合。`lib/combat-ai/combat-policy.ts` 门控合法性；weight 仍只选动作和落点。子代理报 216/216 绿。旧搜索门未回来。

**仍留给后面：** LUK 真检定消耗；fire mode 写进 intent；投回/隐蔽执行；bench RNG。


**前置：** P0–P2 已合。

**范围**

状态机只改合法性和策略门；现有 weight 只选动作和落点（Q1/Q2）。

- 动作上限：简单 move XOR 标准；新手移+攻；普通最多 2 标准；困难最多 3；非常困难任意个（命中预期为正时）。
- 模糊开火按各档正文；困难对精确定位穿墙算效果线是故意的（Q15）。
- 预期：默认过线概率×伤害骰；普通及以下正文优先（Q10）。
- 伏击两套（Q16）：无定位=额外轮/第一轮额外动作；有定位=条件动作或路径压制/手雷。
- LUK 仅 professional：关键检定可连重，每次 1 点（Q17）。
- 投回手雷、瞄准、隐蔽、Burst/FA/SA 按各档正文。

**完成：** 各档模糊合法性、动作上限、无定位伏击、professional LUK 有测试；`pnpm test` 绿。旧搜索/概率门不能从后门回来。
