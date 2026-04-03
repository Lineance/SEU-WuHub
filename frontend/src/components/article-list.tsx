import { ArticleCard } from "@/components/article-card"

const articles = [
  {
    id: "1",
    title: "2024-2025学年第二学期选课通知",
    summary: "本学期选课将于3月15日开始，请同学们提前了解选课规则和时间安排，合理规划自己的课程。",
    time: "2小时前",
    source: "教务处",
    tags: ["选课", "通知"],
  },
  {
    id: "2",
    title: "校园一卡通充值功能升级公告",
    summary: "即日起，校园一卡通支持微信、支付宝在线充值，无需前往服务中心。详情请查看操作指南。",
    time: "5小时前",
    source: "信息中心",
    tags: ["一卡通", "服务"],
  },
  {
    id: "3",
    title: "数学建模竞赛报名开始啦！",
    summary: "全国大学生数学建模竞赛校内选拔赛报名已经开始，欢迎有兴趣的同学踊跃参加。",
    time: "1天前",
    source: "数学学院",
    tags: ["竞赛", "数学建模"],
  },
  {
    id: "4",
    title: "图书馆延长开放时间通知",
    summary: "为满足同学们的学习需求，考试周期间图书馆将延长开放时间至晚上11点。",
    time: "1天前",
    source: "图书馆",
    tags: ["图书馆", "考试周"],
  },
  {
    id: "5",
    title: "新生入门指南：如何快速适应大学生活",
    summary: "从选课到社团，从食堂到宿舍，这篇指南将帮助你快速了解校园生活的方方面面。",
    time: "2天前",
    source: "学生会",
    tags: ["新生", "指南"],
  },
  {
    id: "6",
    title: "校园网使用常见问题解答",
    summary: "包括如何连接校园网、VPN使用方法、网络故障排查等常见问题的详细解答。",
    time: "3天前",
    source: "网络中心",
    tags: ["网络", "FAQ"],
  },
]

export function ArticleList() {
  return (
    <main className="flex-1 p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">最新动态</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          浏览校园最新通知、资源和经验分享
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {articles.map((article, index) => (
          <ArticleCard key={index} {...article} />
        ))}
      </div>
    </main>
  )
}
