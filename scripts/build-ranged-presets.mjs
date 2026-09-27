import fs from "node:fs";
import { fileURLToPath } from "node:url";

const CREATED = {
  created_by: "00000000-0000-0000-0000-000000000000",
  created_at: "2026-09-27T00:00:00.000Z",
};

/** @type {[string, string, string, string, string, string, string, string, string, string, string][]} */
const ROWS = [
  ["AR(M4) 14.5\"", "N", "+0", "5.56x45mm", "350m", "N", "SA / FA", "3.3kg", "采用 14.5 英寸枪管和皮卡汀尼导轨护木的 AR 平台步枪。其包含一个聚合物护木，使用一体式提把瞄具。", "14.5\" 枪管，+0 精度", "M4A1 M1991", ""],
  ["AR(M4) 16\"", "N", "+0", "5.56x45mm", "400m", "N", "SA / FA", "3.5kg", "采用 16 英寸枪管和 M-LOK 护木的 AR 平台非列装模块化步枪。", "16\" 枪管，提供 +1 精度", "DDM4 16\"", ""],
  ["AR(M4) 11.5\"", "N", "-1", "5.56x45mm", "250m", "P", "SA / FA", "3.0kg", "采用 11.5 英寸枪管的 AR 平台短管步枪，配备聚合物护木和可折叠枪托。", "11.5\" 枪管，-1 精度", "AR-15 11.5-inch carbine", ""],
  ["AR(M16) 20\"", "N", "+1", "5.56x45mm", "500m", "N", "SA / FA", "3.9kg", "采用 20 英寸枪管的全尺寸 AR 平台步枪。", "20\" 枪管，+2 精度", "M16A1", "提供一个白板变体，使用 16\" 枪管，精度 -1"],
  ["AR(M4 DMR) 20\"", "N", "+2", "5.56x45mm", "600m", "N", "SA", "4.2kg", "采用 20 英寸精度枪管和半自动击发机构的精确射手步枪。", "20\" 精度枪管", "Mk 12", ""],
  ["ACR 16\"", "N", "+0", "5.56x45mm", "350m", "P", "SA / FA", "3.5kg", "Special Operations Forces Combat Assault Rifle（SOCOM 特种部队战斗突击步枪）。其具有一个自带皮卡汀尼导轨的聚合物枪身，并可使用 STANAG 弹匣。", "聚合物枪身，一体式皮卡汀尼导轨，折叠枪托", "Special Operations Forces Combat Assault Rifle", ""],
  ["P17 9x19", "N", "-1", "9x19mm", "50m", "G", "SA", "0.9kg", "半自动聚合物手枪。使用扳机保险。", "", "Glock 17", ""],
  ["P18 9x19", "N", "-2", "9x19mm", "50m", "G", "SA / FA", "0.9kg", "支持全自动射击，且包含快慢机的紧凑型聚合物枪身 9x19mm 手枪。", "", "Glock 18", ""],
  ["M1911A1", "N", "-1", ".45 ACP", "50m", "G", "SA", "1.1kg", "使用 .45 ACP 弹药的半自动手枪，采用扳机保险和 7 发单排弹匣。", "", "M1911A1", "该型号专利已过期"],
  ["AK 5.45", "V", "+0", "5.45x39mm", "400m", "N", "SA / FA", "3.3kg", "卡拉什尼科夫自动步枪，1991 型，使用 5.45x39mm 弹药。包含聚酰胺聚合物护手、枪托和握把。GRAU 编号：6P34。", "", "AK-74M", ""],
  ["AK 7.62", "V", "-1", "7.62x39mm", "300m", "N", "SA / FA", "3.5kg", "卡拉什尼科夫自动步枪，1959 型，使用 7.62x39mm 弹药。包含木制护手和枪托，电木握把。GRAU 编号：6P1。", "", "AKM", ""],
  ["AK-545(100)", "V", "-1", "5.45x39mm", "300m", "P", "SA / FA", "3.2kg", "使用 5.45x39mm 弹药的短管突击卡宾枪，采用导气式、气冷结构，配备 314mm 枪管、聚合物护手、侧置光学瞄具导轨和可折叠聚合物枪托。GRAU 编号：6P47。", "314mm 枪管、侧置光学瞄具导轨、可折叠聚合物枪托", "AK-105", ""],
  ["SD 54R (100)", "V", "+1", "7.62x54R", "600m", "N", "SA", "4.3kg", "现代化型号的德拉贡诺夫狙击步枪。使用 7.62x54R 口径，包含 AK100 世代的聚合物装具和皮卡汀尼导轨。GRAU 编号：6V11。", "聚合物枪托、机匣皮卡汀尼导轨", "SVDM", ""],
  ["SD Ratnik-54R", "V", "+2", "7.62x54R", "700m", "N", "SA", "4.4kg", "勇士计划下的现代化精确射手步枪，用于取代 SVD。由楚卡文在 2010 年代开发。GRAU 编号：6V14。", "聚合物护手、一体式手枪握把、皮轨防尘盖、可伸缩枪托、两个战术配件槽位", "SVCh", ""],
  ["A-971", "N", "+0", "5.45x39mm", "400m", "P", "SA / FA / B", "3.3kg", "使用 5.45x39mm 弹药的突击步枪，于阿巴坎计划期间由科夫罗夫机械厂开发。采用平衡自动原理、气动和气冷结构，配备聚合物护手与可折叠枪托，支持半自动、全自动和三发点射。GRAU 编号：6P67。", "聚合物护手、可折叠枪托", "AEK-971 / A-545", ""],
  ["XM249 Para", "N", "+0", "5.56x45mm NATO", "600m", "N", "FA", "7.5kg", "使用 5.56x45 NATO 弹药的班组支援轻机枪，于 1984 年列装。采用气动、气冷原理，为空降步兵设计，配备可伸缩铝制枪托。", "可快速更换枪管、可伸缩铝制枪托", "M249 Para", ""],
  ["AW .50", "N", "+3", "12.7x99mm NATO", "1,500m", "N", "M", "15.0kg", "使用 12.7x99mm NATO 弹药的栓动反器材步枪，基于 AW 平台。采用手动旋转后拉式枪机、重型气冷枪管、5 发可拆卸弹匣、可折叠枪托、可调两脚架和全长皮卡汀尼导轨。GRAU 编号：无。", "重型气冷枪管、可折叠枪托、可调两脚架", "AW 平台（12.7mm 变体）", ""],
  ["HMG 12.7", "V", "+0", "12.7x99mm / 12.7x108mm", "1,800m", "N", "SA / FA", "38.2kg", "适合固定阵地或载具使用的 12.7mm 重机枪，具备高穿透力和长时间持续射击能力。", "", "M2 Browning", ""],
  ["Mosin-Nagant M1891/30", "V", "+0", "7.62x54R", "500m", "N", "M", "4.0kg", "苏联制栓动步枪，使用固定式弹仓和长枪管，是二战时期最常见的苏联制式步枪之一。GRAU 编号：56-V-222。", "刺刀座、机械瞄具", "Mosin-Nagant", ""],
  ["Mosin-Nagant M1891/30 PU", "V", "+1", "7.62x54R", "600m", "N", "M", "4.2kg", "M1891/30 的狙击构型，安装侧置 PU 光学瞄具。GRAU 编号：56-V-222A。", "PU 光学瞄具", "Mosin-Nagant M1891/30", ""],
  ["SV-98", "N", "+3", "7.62x54R", "800m", "N", "M", "6.2kg", "俄罗斯现代栓动狙击步枪，采用自由浮置枪管、可调枪托和可拆卸弹匣。GRAU 编号：6V10。", "两脚架、光学导轨、可调枪托", "SV-98", ""],
  ["运动步枪 7.62", "N", "+1", "7.62x39mm", "300m", "P", "M", "2.7kg", "现代轻型栓动卡宾枪，使用短枪管和聚合物枪托。", "光学导轨", "Ruger American", ""],
  ["SKS M1945", "V", "+0", "7.62x39mm", "400m", "N", "SA", "3.9kg", "西蒙诺夫设计的半自动卡宾枪，采用固定式 10 发弹仓和短行程活塞系统。GRAU 编号：56-A-231。", "折叠刺刀", "SKS", ""],
  ["Army 92FS", "N", "-1", "9x19mm", "50m", "G", "SA", "1.0kg", "全尺寸双排弹匣半自动手枪，采用开放式套筒和 DA/SA 击发机构。", "", "Beretta 92", ""],
  ["USP9", "N", "-1", "9x19mm", "50m", "G", "SA", "0.8kg", "聚合物底把军警手枪，采用传统短后坐闭锁系统。", "配件导轨", "USP", ""],
  ["TT-33", "N", "-1", "7.62x25mm", "50m", "G", "SA", "0.85kg", "苏联制单动半自动手枪，使用高速 7.62x25mm 弹药。", "", "TT-33", ""],
  ["XM17", "N", "-1", "9x19mm", "50m", "G", "SA", "0.85kg", "模块化击针击发手枪，美国军用 M17/M18 系列的基础平台。", "模块化火控组件、配件导轨", "P320", ""],
  ["Mk 23", "V", "+0", ".45 ACP", "50m", "C", "SA", "1.2kg", "为特种作战需求开发的大型 .45 ACP 手枪，强调耐久性和抑制器使用能力。", "螺纹枪管、配件接口", "Mk 23", "体积巨大，隐蔽性低于一般手枪"],
  ["AR(416)", "N", "+1", "5.56x45mm", "400m", "N", "SA / FA", "3.5kg", "使用短行程活塞系统的 AR 式突击步枪，配备自由浮置护木和全长顶部导轨。", "14.5\" 枪管、皮轨护木", "HK416", ""],
  ["AR(416) A5 11\"", "N", "+0", "5.56x45mm", "300m", "P", "SA / FA", "3.3kg", "短行程活塞 AR 式突击步枪，11 英寸枪管构型。", "11\" 枪管、皮轨护木", "HK416", ""],
  ["AUR-A3 16\"", "N", "+0", "5.56x45mm", "450m", "P", "SA / FA", "3.3kg", "无托式突击步枪，采用可快速更换枪管和聚合物枪身。", "16\" 快拆枪管、顶部导轨", "AUG", ""],
  ["Gewehr 36 (S)", "N", "+0", "5.56x45mm", "350m", "P", "SA / FA", "3.3kg", "短管卡宾突击步枪。使用聚合物机匣和折叠枪托。", "折叠枪托、光学瞄具接口", "G36", ""],
  ["AK 7.62 (MG)", "V", "+0", "7.62x39mm", "500m", "N", "SA / FA", "4.8kg", "基于 AKM 系统发展的班用轻机枪，采用加长重型枪管、加强机匣和固定两脚架。GRAU编号：6P2", "两脚架、长重枪管", "AKM", ""],
  ["AK 5.45(MG)", "V", "+1", "5.45x39mm", "600m", "N", "SA / FA", "4.7kg", "5.45x39mm 班用自动武器，基于 AK-74 系统发展。GRAU 编号：6P18。", "长重枪管、两脚架", "AK-74", ""],
  ["Ratnik-545(MG)", "V", "+1", "5.45x39mm", "600m", "N", "SA / FA", "4.5kg", "新一代模块化班用自动武器，可使用长短两种枪管以及 95 发弹鼓。", "可更换枪管、顶部导轨、两脚架", "RPK-16", ""],
  ["AK 5.45(SBR)", "V", "-2", "5.45x39mm", "200m", "C", "SA / FA", "2.7kg", "极短枪管 AK-74 卡宾枪，采用折叠枪托和特制膨胀室式枪口装置。GRAU：6P26。", "折叠枪托、短枪管", "AK-74", ""],
  ["AR Virtus .300", "N", "-1", ".300 BLK", "200m", "C", "SA / FA", "2.5kg", "为极短构型和抑制器使用设计的 PDW，采用 5.5 英寸枪管和折叠枪托。", "5.5\" 枪管、折叠枪托", "MCX", ""],
  ["ACR .300 BLK", "N", "-1", ".300 BLK", "250m", "C", "SA / FA", "3.1kg", "ACR 系列超紧凑卡宾枪的 .300 BLK 构型。", "伸缩枪托、全长导轨", "FN SCAR-SC", ""],
  ["Honey Badger 7\"", "N", "-1", ".300 BLK", "200m", "C", "SA", "2.2kg", "极轻型 .300 BLK PDW/SBR，使用 7 英寸枪管并围绕抑制器使用设计。", "伸缩枪托、可调导气系统", "Honey Badger", "军用原型可另设 SA / FA 版本"],
  ["SD 9x39", "V", "+1", "9x39mm", "400m", "P", "SA / FA", "2.6kg", "中央精密机械研究所于 1980 年代开发的微声狙击步枪，1987 年列装。一体式消音器，使用亚音速 9x39mm 弹药。GRAU 编号：6P29。", "一体式消音器、侧置光学瞄具导轨", "VSS", ""],
  ["AS 9x39", "V", "+0", "9x39mm", "300m", "P", "SA / FA", "2.5kg", "与 VSS 同期开发的微声突击步枪，采用一体式消音器、折叠枪托和 20 发弹匣。GRAU 编号：6P30。", "一体式消音器、折叠枪托", "AS Val", ""],
  ["SR 9x39", "V", "-1", "9x39mm", "200m", "C", "SA / FA", "2.2kg", "基于 AS 内部结构发展的紧凑型突击步枪，取消一体式消音器以缩短长度，配备折叠枪托。1990 年代由中央精密机械研究所开发。", "折叠枪托、可加装消音器", "SR-3M", ""],
  ["SD 12.7x55", "N", "+2", "12.7x55mm", "600m", "N", "M", "6.5kg", "图拉中央体育狩猎武器设计局在「排气」计划下为联邦安全局开发的微声栓动狙击步枪，约 2004 年列装。无托布局，一体式消音器，使用亚音速 12.7x55mm 弹药，5 发弹匣。", "一体式消音器、光学导轨", "VKS", ""],
  ["ASh 12.7", "N", "-1", "12.7x55mm", "300m", "P", "SA / FA", "5.2kg", "同一计划下的大口径无托突击步枪，与 VKS 共用 12.7x55mm 弹药，约 2011 年列装。短行程枪管后坐，10/20 发弹匣。复合型号称 ШАК-12。", "可拆消音器、光学导轨", "ASh-12", "含消音器约 6.0kg"],
  ["RSh 12.7", "N", "-1", "12.7x55mm", "50m", "C", "SA", "2.2kg", "「排气」计划的副产品。图拉 KBP 研制的 5 发双动转轮手枪，使用同一 12.7x55mm 弹药。", "", "RSh-12", "体积远大于制式手枪"],
  ["PDW90", "N", "+0", "5.7x28mm", "200m", "C", "SA / FA", "2.8kg", "无托式个人防卫武器，使用顶部横置 50 发弹匣。", "一体式/导轨瞄具接口", "P90", ""],
  ["5-7", "N", "-1", "5.7x28mm", "50m", "G", "SA", "0.68kg", "Five-seveN 的现代化构型，原生支持微型红点瞄具。", "MRD 光学接口", "Five-seveN", ""],
  ["MP-7A1", "N", "+0", "4.6x30", "200m", "C", "SA / FA", "1.9kg", "极紧凑短行程活塞 PDW，使用伸缩枪托和 20/30/40 发弹匣。", "伸缩枪托、折叠前握把", "MP7", ""],
  ["Vector-9", "N", "-1", "9x19mm", "100m", "C", "SA / FA / B2", "3.3kg", "使用 KRISS Super V 延迟反冲系统的短管冲锋枪构型。", "6.5\" 枪管、折叠枪托、M-LOK", "KRISS Vector", ""],
  ["Vector-45", "N", "-1", ".45 ACP", "100m", "C", "SA / FA / B2", "3.3kg", "Vector 的 .45 ACP 构型，使用 Glock 21 系弹匣。", "6.5\" 枪管、折叠枪托、M-LOK", "KRISS Vector", ""],
  ["MP-5(A3)", "V", "+0", "9x19mm", "150m", "P", "SA / FA", "2.9kg", "经典滚柱延迟反冲冲锋枪，A3 使用伸缩枪托。", "伸缩枪托", "MP5", ""],
  ["MP-5K(A4)", "V", "-1", "9x19mm", "100m", "C", "SA / FA / B3", "2.5kg", "MP5K 的 PDW 构型，使用极短枪管和折叠枪托。", "折叠枪托、短枪管", "MP5KA4", ""],
  ["Evolution-3A1", "N", "-1", "9x19mm", "150m", "P", "SA / FA", "2.6kg", "聚合物机匣现代冲锋枪，采用简单反冲式工作原理。", "折叠伸缩枪托、附件导轨", "Scorpion EVO 3", ""],
  ["AK 9mm(Gen 100)", "V", "-1", "9x19mm", "150m", "P", "SA / FA", "2.9kg", "基于 AK 系统人机布局发展的俄罗斯 9mm 冲锋枪。", "折叠枪托、侧置光学导轨", "PP-19-01", ""],
  ["IMI Uzi", "V", "-1", "9x19mm", "150m", "P", "SA / FA", "3.5kg", "经典开放枪机冲锋枪，采用包络式枪机和握把内弹匣。", "折叠枪托", "Uzi", ""],
  ["Arctic MC", "N", "+3", ".338 Lapua Magnum", "1,200m", "N", "M", "7.4kg", "模块化长机匣精确步枪，采用折叠可调枪托和自由浮置重型枪管。", "27\" 枪管、折叠枪托、两脚架接口", "AXSR", ""],
  ["XM107A1", "N", "+2", "12.7x99mm", "1,500m", "N", "SA", "12.5kg", "长后坐式半自动反器材步枪，采用 10 发弹匣和大型枪口制退器。", "两脚架、27 MOA 导轨", "M107 / M82", ""],
  ["HS-50", "N", "+3", "12.7x99mm", "1,500m", "N", "M", "13.8kg", "大型栓动反器材步枪，使用 900mm 重型枪管和侧置 5 发弹匣。", "两脚架、20 MOA 导轨", "HS .50", ""],
  ["NTW-20", "N", "+2", "20x82mm", "1,500m", "N", "M", "26.0kg", "超大口径栓动反器材系统，采用液压/弹簧后坐缓冲机构，可更换为 14.5x114mm 构型。", "两脚架、后脚架、后坐缓冲系统", "NTW-20", "极重，通常拆分运输"],
];

const MODS_BY_OLD_ID = {
  "opcode-ranged-ar-a1-145": "AR(M4) 14.5\"",
  "opcode-ranged-ar-a1-16": "AR(M4) 16\"",
  "opcode-ranged-ar-a1-115": "AR(M4) 11.5\"",
  "opcode-ranged-ar-m16-20": "AR(M16) 20\"",
  "opcode-ranged-ar-dmr-20": "AR(M4 DMR) 20\"",
  "opcode-ranged-acr-16": "ACR 16\"",
  "opcode-ranged-ak545-100": "AK-545(100)",
  "opcode-ranged-sd-54r-100": "SD 54R (100)",
  "opcode-ranged-sd-ratnik-54r": "SD Ratnik-54R",
  "opcode-ranged-a971": "A-971",
  "opcode-ranged-xm249-para": "XM249 Para",
  "opcode-ranged-aw-50": "AW .50",
};

function slug(name) {
  return name.toLowerCase().replaceAll("x", "x").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function parseRange(raw) {
  return raw.replaceAll(",", "").replace(/m$/i, "").trim();
}

function parseWeight(raw) {
  return raw.replace(/kg$/i, "").trim();
}

const CONCEALABILITY = { E: 0, G: 1, C: 2, P: 3, N: 4 };
const RELIABILITY = { V: 0, N: 1, U: 2 };

function localeDesc(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return undefined;
  return /[\u4e00-\u9fff]/.test(trimmed) ? { zh: trimmed } : { en: trimmed };
}

function parseAccuracy(raw) {
  const match = String(raw).match(/[+-]?\d+/);
  return match ? Number(match[0]) : 0;
}

function fireMode(raw) {
  const text = raw.trim();
  if (text === "M") return "0";
  let mode = 0;
  if (/\bSA\b/.test(text)) mode |= 1;
  if (/\bFA\b/.test(text)) mode |= 2;
  if (/\bB\d?\b|\bB\b/.test(text)) mode |= 4;
  return String(mode);
}

/** Rounds per minute (or manual shots/min for M). */
const ROF_BY_NAME = {
  "AR(M4) 14.5\"": "900",
  "AR(M4) 16\"": "900",
  "AR(M4) 11.5\"": "900",
  "AR(M16) 20\"": "900",
  "AR(M4 DMR) 20\"": "900",
  "ACR 16\"": "750",
  "P17 9x19": "1100",
  "P18 9x19": "1200",
  "M1911A1": "450",
  "AK 5.45": "650",
  "AK 7.62": "600",
  "AK-545(100)": "650",
  "SD 54R (100)": "600",
  "SD Ratnik-54R": "600",
  "A-971": "900",
  "XM249 Para": "800",
  "AW .50": "8",
  "HMG 12.7": "550",
  "Mosin-Nagant M1891/30": "8",
  "Mosin-Nagant M1891/30 PU": "8",
  "SV-98": "8",
  "运动步枪 7.62": "8",
  "SKS M1945": "450",
  "Army 92FS": "450",
  "USP9": "600",
  "TT-33": "480",
  "XM17": "600",
  "Mk 23": "450",
  "AR(416)": "850",
  "AR(416) A5 11\"": "850",
  "AUR-A3 16\"": "750",
  "Gewehr 36 (S)": "750",
  "AK 7.62 (MG)": "600",
  "AK 5.45(MG)": "650",
  "Ratnik-545(MG)": "800",
  "AK 5.45(SBR)": "650",
  "AR Virtus .300": "900",
  "ACR .300 BLK": "750",
  "Honey Badger 7\"": "900",
  "SD 9x39": "700",
  "AS 9x39": "900",
  "SR 9x39": "900",
  "SD 12.7x55": "8",
  "ASh 12.7": "500",
  "RSh 12.7": "30",
  "PDW90": "900",
  "5-7": "600",
  "MP-7A1": "950",
  "Vector-9": "1100",
  "Vector-45": "1100",
  "MP-5(A3)": "800",
  "MP-5K(A4)": "900",
  "Evolution-3A1": "1100",
  "AK 9mm(Gen 100)": "650",
  "IMI Uzi": "600",
  "Arctic MC": "8",
  "XM107A1": "60",
  "HS-50": "8",
  "NTW-20": "8",
};

function rofFor(name, mode, weight) {
  if (ROF_BY_NAME[name]) return ROF_BY_NAME[name];
  const m = Number(mode);
  const w = Number(weight);
  if (m === 0) return "8";
  if (m === 2 && w >= 7) return "800";
  if (w <= 1.5) return m & 2 ? "900" : "450";
  if (w <= 3.5 && m === 3) return "900";
  return "600";
}

const AMMO_CALIBER = {
  "5.56x45mm": "5.56x45",
  "5.56x45mm NATO": "5.56x45",
  "9x19mm": "9x19",
  ".45 ACP": ".45ACP",
  "5.45x39mm": "5.45x39",
  "7.62x39mm": "7.62x39",
  "12.7x99mm NATO": "12.7x99",
  "12.7x99mm / 12.7x108mm": "12.7x99",
  "7.62x25mm": "7.62x25TT",
  ".300 BLK": ".300BLK",
  "9x39mm": "9x39",
  "12.7x55mm": "12.7x55",
  "5.7x28mm": "5.7x28",
  ".338 Lapua Magnum": ".338LM",
  "12.7x99mm": "12.7x99",
  "20x82mm": "20x82",
};

function ammoCaliber(caliber) {
  return (AMMO_CALIBER[caliber] ?? caliber).replaceAll("x", "x");
}

export { ROWS, ROF_BY_NAME, rofFor, fireMode, parseWeight };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (!isMain) {
  // imported by sync-weapon-doc-rof.mjs
} else {
const path = "lib/character-sheets/item-presets.json";
const catalog = JSON.parse(fs.readFileSync(path, "utf8"));
const modsByName = new Map();
for (const entry of Object.values(catalog.ranged || {})) {
  const name = entry.data?.name;
  const mods = entry.data?.weapon?.modifications;
  if (typeof name === "string" && mods && typeof mods === "object" && !mods.attachment?.["70000000-0000-4000-8000-000000000099"])
    modsByName.set(name, mods);
}
for (const [oldId, name] of Object.entries(MODS_BY_OLD_ID)) {
  const mods = catalog.ranged?.[oldId]?.data?.weapon?.modifications;
  if (mods) modsByName.set(name, mods);
}

const ranged = {};
for (const row of ROWS) {
  const [name, reliability, accuracy, caliber, range, conceal, modes, weight, desc, attachment, baseModel, notes] = row;
  const id = `opcode-ranged-${slug(name)}`;
  const mode = fireMode(modes);
  const weapon = {
    type: "ranged",
    caliber: ammoCaliber(caliber),
    accuracy: parseAccuracy(accuracy),
    reliability: RELIABILITY[reliability.trim().toUpperCase()] ?? 1,
    rof: Number(rofFor(name, mode, parseWeight(weight))),
    mode: Number(mode),
    range: Number(parseRange(range)),
    concealability: CONCEALABILITY[conceal.trim().toUpperCase()] ?? 4,
    weight: Number(parseWeight(weight)),
    damage: {},
  };
  const savedMods = modsByName.get(name);
  if (savedMods) weapon.modifications = savedMods;
  else if (attachment.trim()) {
    weapon.modifications = {
      attachment: {
        "70000000-0000-4000-8000-000000000099": {
          name: "Default loadout",
          ...(localeDesc(attachment) ? { description: localeDesc(attachment) } : {}),
          effects: {},
        },
      },
    };
  }
  const descText = [desc, notes].map((part) => String(part || "").trim()).filter(Boolean).join("\n\n");
  const descI18n = localeDesc(descText);
  ranged[id] = {
    ...CREATED,
    data: {
      id,
      name,
      type: "weapon",
      count: 1,
      ...(descI18n ? { desc: descI18n } : {}),
      weapon,
    },
  };
}

if (Object.keys(ranged).length !== ROWS.length) throw new Error("count mismatch");
const start = fs.readFileSync(path, "utf8").indexOf('  "ranged": ');
const end = fs.readFileSync(path, "utf8").indexOf('  "attachments": ');
const body = JSON.stringify(ranged, null, 2).split("\n").map((line, i) => (i === 0 ? line : `  ${line}`)).join("\n");
const raw = fs.readFileSync(path, "utf8");
const next = `${raw.slice(0, start)}  "ranged": ${body},\n${raw.slice(end)}`;
JSON.parse(next);
fs.writeFileSync(path, next);
console.log("ranged", Object.keys(ranged).length);
}
