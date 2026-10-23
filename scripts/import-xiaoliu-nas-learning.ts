/**
 * 将「小六 2026年10月22日」NAS 走查笔记拆入学习池。
 * - 只写学习笔记 + 优化建议
 * - 不自动创建需求（可在 UI 一键生成）
 *
 * 用法：npx tsx scripts/import-xiaoliu-nas-learning.ts
 */
import { ensurePmProjectForStudio } from "@/lib/db/local-store";
import {
  createProjectLearningNote,
  listProjectLearningNotes,
  newLearningSuggestion,
} from "@/lib/learning-notes/store";
import { getPmSlugForStudioProject } from "@/lib/project-bridge";

const STUDIO_ID = "proj-e82afb1a";
const SOURCE =
  "来源：小六 2026年10月22日.docx（绿联/NAS 走查 + DeepSeek 术语）";

type NoteSeed = {
  title: string;
  why_text?: string;
  principle?: string;
  protocol?: string;
  tech_background?: string;
  competitors?: string;
  product_thinking?: string;
  suggestions: Array<{ title: string; detail: string }>;
};

const NOTES: NoteSeed[] = [
  {
    title: "存储池 · 个人/公共空间 · RAID 术语",
    why_text:
      "做 NAS 产品必须先分清：物理硬盘 → 存储池 → 个人/公共空间 → 文件。术语不懂就无法设计创建池向导与灰态提示。",
    principle: [
      "个人空间：私有+配额；公共空间：共享+细粒度权限。",
      "硬盘=物理；存储池=逻辑容量池（可汇聚多盘、可做冗余）。",
      "Basic 单盘：无冗余。RAID0 最快无冗余；RAID1 镜像≈半容量（≠真备份）；RAID5 分布式校验≥3盘坏1；RAID6≥4盘坏2；RAID10 先镜像再条带≥4盘；RAIDZ=ZFS 变体。",
      "高级模式需要「完全空闲、未占用」完整盘；已入池/残留分区不可直接组。级别互转宜备份重建。",
      "ZFS 成组扩容可拼类 RAID10/50/60；vdev 间条带、模式可混。",
    ].join("\n"),
    tech_background:
      "ZFS/Btrfs：CoW、快照、校验和。镜像≠备份（误删/勒索双份一起没）。重建窗口期有风险。",
    competitors: "极空间、绿联云、海康存储：偏小白，常隐藏 RAID 术语、用意图问法匹配模式。",
    product_thinking: [
      "面向极客：术语不要乱翻译，要展示代价与收益（容量损失、故障容忍、为何灰掉）。",
      "可做：容量计算器、故障容忍大字、成组扩容可视化、RAID10/50 快捷模板、强风险确认。",
      SOURCE,
    ].join("\n"),
    suggestions: [
      {
        title: "创建存储池：先问意图再推荐 RAID，并保留自定义",
        detail:
          "提问存什么/几块盘/看重安全还是速度 → 推荐方案+解释 → [采纳] / [自己配置]。自定义面板实时显示可用容量、允许故障盘数、性能预估；ZFS 高级参数可折叠。",
      },
      {
        title: "一键类 RAID10/50 模板 + 成组扩容风险提示",
        detail:
          "底层仍是 ZFS 拼装；模板后台执行创建+扩容。必须提示：扩容可能清空池内数据，需备份确认。",
      },
      {
        title: "高级模式灰态写清原因（需≥2块未分配盘等）",
        detail: "不要只灰掉；告诉极客为什么不支持，以及盘已被占用/未格式化时怎么处理。",
      },
    ],
  },
  {
    title: "Agent 引导 · 场景编排（目标驱动而非模块驱动）",
    why_text:
      "绿联体验：引导偏「去配置某某模块」，用户知道名词却不知道有什么用。应先问需求/角色，再推荐分区与能力组合。",
    principle: [
      "用户目标 → Agent → 能力组合 → Docker/应用/配置 → 执行 → 验证。",
      "Docker 应用市场像 App Store：解决安装，未解决「该选哪些服务完成目标」。Agent 应是场景编排入口。",
      "示例：家庭影音 = 搜索→下载→整理→字幕→海报→手机/电视播放。",
    ].join("\n"),
    product_thinking: [
      "首次打开：若用户不需要可不引导；小白需要「这功能有什么用」+ 按画像推荐分区（影视/图片/PRD）。",
      "家庭模式 vs 高级模式信息架构可并存。",
      SOURCE,
    ].join("\n"),
    suggestions: [
      {
        title: "Agent 首次引导：按用户角色推荐分区与配置",
        detail:
          "检测首次打开→问需求/角色→推荐分区与打开方式；避免干巴「去配置某某」。家庭用户可推荐影视/图片分区。",
      },
      {
        title: "场景卡片：电视看电影 / 电脑访问文件 / Linux 挂载",
        detail:
          "例如「给电视看电影」→检测影视文件与网络→建 Movies、开 DLNA/推荐 Emby、索引与海报。协议选择由 Agent 判断（SMB/NFS/DLNA）。",
      },
      {
        title: "调研内部 API：预览、执行、验证与任务状态",
        detail:
          "创建文件夹/权限/装应用/备份等是否可预览、防重复、有成功失败反馈。Agent 不能只靠模型自称「已完成」。",
      },
    ],
  },
  {
    title: "网络 · 链路聚合 bond · 远程访问 / P2P",
    why_text: "bond/P2P/公网穿透对用户应翻译成「速度/故障切换/远程访问」；极客仍要看到通道状态与延迟。",
    principle: [
      "bond6 负载均衡：多设备分流；bond1 主备：断线切换；802.3ad：需交换机 LACP。",
      "远程：优先 P2P，失败走中转；用户看到「远程访问」而非穿透术语。",
      "P2P：主通道 UDP 极速，备用 TCP/中继保底；可智能自动匹配服务区或手动看延迟。",
    ].join("\n"),
    protocol: "P2P / UDP 打洞 / TCP 备用 / 云中继；自定义中继与 ZeroTier/Tailscale 可作为逃生舱提示。",
    product_thinking: SOURCE,
    suggestions: [
      {
        title: "链路聚合：网口数检测 + 人话模式名 + 二次确认",
        detail:
          "仅 1 口时灰掉聚合；列出端口连接状态；bond 旁副标题解释；bond4 等需交换机时二次确认；虚拟机环境提示加第二块网卡。",
      },
      {
        title: "远程访问：智能自动 + 通道状态灯 + 网络诊断",
        detail:
          "默认智能匹配服务区；极客可选手动区看 Ping；主/备通道用信号格；诊断说明为何走中继、建议热点/IPv6。",
      },
      {
        title: "连接云盘文案：在线访问 / 自动备份 / 双向同步",
        detail: "用「连接云盘」替代「添加外部存储」，并问清使用意图。",
      },
    ],
  },
  {
    title: "硬件监控 · S.M.A.R.T. · SSD 缓存",
    why_text: "概览卡片应可下钻；硬盘健康与温度是极客生死线。",
    principle: [
      "S.M.A.R.T. 红线：重映射扇区、待映射扇区、通电时间；温度长期>50℃危险。",
      "虚拟磁盘可能无法取 S.M.A.R.T.，需说明原因。",
      "L2ARC/读缓存需空闲 SSD；已入池/HDD 应置灰并写原因。",
    ].join("\n"),
    product_thinking: SOURCE,
    suggestions: [
      {
        title: "资源卡片可下钻（网络/硬盘/CPU）并显示温度预警色",
        detail: "点网络→链路聚合；点硬盘→存储池/S.M.A.R.T.；CPU 看核心与进程；温度数值+绿黄红。",
      },
      {
        title: "S.M.A.R.T. 健康报告：状态灯 + 重点标红 + 温度曲线",
        detail: "勿只丢原始表；大字状态/温度/通电；重映射异常标红；主视图硬盘旁显示温度。",
      },
      {
        title: "SSD 缓存：空闲盘筛选 + 有数据盘强确认格式化",
        detail: "列出不可用原因；勾选含数据盘时红色二次确认不可逆。快照管理副标题显示上次时间与占用。",
      },
    ],
  },
  {
    title: "文件共享协议 · SMB / FTP / SFTP / WebDAV / NFS",
    why_text: "协议应按场景收纳，默认安全；复制连接与按 OS 一键挂载是体验关键。",
    principle: [
      "局域网：SMB（Win/Mac）、NFS（Linux）、DLNA（媒体）。",
      "跨网：WebDAV；自动化：SFTP；FTP 明文高风险仅兼容老设备。",
      "SMB 默认勿用 NT1；多通道对聚合有用。NFS 靠 IP/UID，仅可信局域网。",
    ].join("\n"),
    protocol: "SMB2/3、SFTP:22、FTP:21、WebDAV HTTPS、NFS。",
    competitors: "绿联侧边「文件服务」收纳协议的方式较好。",
    product_thinking: SOURCE,
    suggestions: [
      {
        title: "系统设置「文件共享协议」Tab/卡片收纳 + SFTP 默认开 / FTP 默认关警告",
        detail: "SSH 放「终端与 SSH」。按场景分组：局域网 / 跨网 / 安全模式。",
      },
      {
        title: "按 OS 一键挂载（Mac Command+K / Windows 映射）+ 文件夹内设 SMB 共享",
        detail: "识别访问者 OS；共享文件夹角标；弹窗设账号与读写权限。",
      },
      {
        title: "WebDAV：复制地址 + RaiDrive/Mountain Duck 教程",
        detail: "配置只需地址/用户/密码；附常用客户端教程。",
      },
      {
        title: "备份：支持备份到自家云端/远程备份（对标飞牛绿联）",
        detail: "文件备份可加产品服务器备份与远程云端备份。",
      },
    ],
  },
  {
    title: "Docker · 容器创建 · 自定义网络",
    why_text: "极客刚需：镜像/容器/Compose；创建流程应防端口冲突、设备挂载傻瓜化、网络自动分配。",
    principle: [
      "镜像=图纸，容器=实例，Compose=多容器调度单。",
      "创建顺序：镜像→网络→端口→存储→环境→资源→启动。",
      "bridge 隔离可映射端口；host 性能高但占 NAS 端口。",
    ].join("\n"),
    product_thinking: SOURCE,
    suggestions: [
      {
        title: "创建容器：端口占用检测、.env 导入、设备快捷挂载/扫描",
        detail: "NAS 端口实时检测冲突；环境变量支持从 .env 导入；核显/NVIDIA/USB 快捷按钮 + 扫描 /dev。",
      },
      {
        title: "自定义网络：自动分配子网 + 冲突检测 + 预设模板",
        detail: "默认自动从 172.17–172.31 选未占用网段；Macvlan 提供推荐配置；高级模式折叠。",
      },
      {
        title: "链路聚合页增加带宽测试按钮",
        detail: "让极客实测当前 bond 模式吞吐。",
      },
    ],
  },
  {
    title: "下载中心 · 任务中心 · 通知",
    why_text: "磁力/BT 流程若过重会劝退；任务中心与下载、消息通知的边界需澄清。",
    principle:
      "可考虑 NAS 内置浏览或粘贴磁力；下载器监听链接。任务中心≠下载应用；通知是否独立应用待定。",
    product_thinking: SOURCE,
    suggestions: [
      {
        title: "简化磁力添加：粘贴识别 + 可选内置浏览器",
        detail: "减少手动步骤；自动匹配端口若适用。",
      },
      {
        title: "厘清任务中心 / 下载 / 消息通知的产品边界",
        detail: "避免三个入口职责重叠；通知是否必须独立应用需结论。",
      },
    ],
  },
];

async function main() {
  const slug = getPmSlugForStudioProject({ id: STUDIO_ID });
  const project = await ensurePmProjectForStudio({
    slug,
    name: "NAS",
    description:
      "保留专业能力，增加按用户目标进入的 Agent 入口（学习池导入自小六笔记）。",
  });

  const existing = await listProjectLearningNotes(project.id);
  const titles = new Set(existing.map((n) => n.title));

  let created = 0;
  let skipped = 0;
  for (const seed of NOTES) {
    if (titles.has(seed.title)) {
      skipped += 1;
      console.log("skip (exists):", seed.title);
      continue;
    }
    const note = await createProjectLearningNote({
      project_id: project.id,
      title: seed.title,
      why_text: seed.why_text,
      principle: seed.principle,
      protocol: seed.protocol,
      tech_background: seed.tech_background,
      competitors: seed.competitors,
      product_thinking: seed.product_thinking,
      suggestions: seed.suggestions.map((s) =>
        newLearningSuggestion({ title: s.title, detail: s.detail })
      ),
    });
    created += 1;
    console.log(
      "created:",
      note.id,
      note.title,
      `suggestions=${note.suggestions.length}`
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectId: project.id,
        slug: project.slug,
        created,
        skipped,
        totalNotes: (await listProjectLearningNotes(project.id)).length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
