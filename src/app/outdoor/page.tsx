import { PageHeader } from "../_components/PageHeader";
import { OutdoorMission } from "./OutdoorMission";

export const dynamic = "force-dynamic";

export default function OutdoorPage() {
  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="户外任务 · 阶段 1"
        title="寻找一个容易被忽略的地方"
        intro="先不用拍照。跟着机器人小伙伴，站定、慢慢观察十秒钟——看看、听听、感受一下。等你真的注意到了什么，再决定要不要把它带回教室。"
      />
      <OutdoorMission />
    </div>
  );
}
